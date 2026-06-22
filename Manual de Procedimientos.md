# Manual de Procedimiento: Sistema de Planificación "SFH ITEO" (Supabase & FTPS Synchronizer)

Este manual describe el funcionamiento, la arquitectura y los procedimientos operativos del sistema de planificación **SFH ITEO** tras la migración completa a la base de datos Supabase de **Hermes-Tesoreria-ITEO**, haciendo de Supabase la fuente única de verdad y relegando el FTP únicamente a sincronizaciones bajo demanda.

---

## 1. Descripción General del Sistema

**SFH ITEO** es un planificador interactivo de turnos, simulador de demanda y gestor de personal para admisores de la clínica. 
Tras la última actualización, el sistema opera bajo una arquitectura centralizada en la nube:
1. **Fuente Única de Verdad (Supabase)**: Todos los datos, incluidos la planificación, los empleados y los turnos clínicos de pacientes, se almacenan y consultan en **Supabase**. Se ha eliminado el uso de archivos Excel (`Turnos.xlsx`) o conexiones FTP en tiempo real para las operaciones diarias de consulta.
2. **Sincronización a Demanda (FTPS)**: Mediante un botón dedicado en la interfaz de usuario, el sistema se conecta de manera segura a la turnera por FTPS para descargar, deduplicar e importar nuevos turnos históricos a Supabase de forma incremental.

---

## 2. Arquitectura de Almacenamiento y Datos

### 2.1. Base de Datos Supabase (Proyecto: Hermes-Tesoreria-ITEO)
Toda la base de datos operativa y de demanda del planificador reside en Supabase:
* **Endpoint API**: `https://fwsnaasfxfzacchsyijx.supabase.co`
* **Tablas Utilizadas**:
  1. **`planning_areas`**: Listado de las áreas de trabajo activas en el planificador (ej. Admisión).
  2. **`planning_employees`**: Registro de colaboradores (legajo, nombre, área, disponibilidad horaria, color de interfaz y turnos posibles).
  3. **`planning_shifts`**: Turnos de trabajo asignados a cada empleado (fecha, duración y hora de inicio).
  4. **`planning_targets`**: Objetivos de cobertura (cantidad de admisores requeridos) por área y día de la semana.
  5. **`planning_attendance`**: Registro de asistencia (presentismo) a los turnos planificados.
  6. **`planning_patient_appointments`**: Tabla que contiene la totalidad de los turnos clínicos históricos de los pacientes.
  7. **`turnera_profesionales`**: Tabla de mapeo de profesionales y especialidades, utilizada para clasificar o excluir consultas.

### 2.2. Filtro de Especialidades (Exclusión de Kinesiología / Rehabilitación)
Para alinear la demanda del panel de planificación con la aplicación de escritorio local de la clínica (por ejemplo, reportando exactamente **187 turnos el 23 de junio de 2026**), el sistema filtra y excluye las citas pertenecientes a kinesiología/rehabilitación. 
Los pacientes de estos profesionales no pasan por la mesa de entrada principal. Se excluyen dinámicamente los profesionales que figuren con `tipo_consulta = 'REHABILITACION'` en `turnera_profesionales` (ej. `LIMONGI MERCEDES`, `MENDOZA MARIA VIVIANA` y `BRUNO DELFINA MARIA`).

### 2.3. Vista de Base de Datos (`planning_patient_demand_view`)
Para maximizar el rendimiento, la demanda horaria no se calcula procesando miles de filas en el servidor backend. Se creó una vista agregada en Supabase que realiza la agrupación y filtrado a nivel de motor PostgreSQL:
```sql
CREATE OR REPLACE VIEW planning_patient_demand_view AS
SELECT 
  TO_CHAR(turno, 'YYYY-MM-DD') AS date_string,
  EXTRACT(HOUR FROM turno)::integer AS hour,
  (UPPER(cobertura) LIKE '%ART%') AS is_art,
  COUNT(*)::integer AS count
FROM planning_patient_appointments
WHERE profesional NOT IN (
  SELECT profesional 
  FROM turnera_profesionales 
  WHERE tipo_consulta = 'REHABILITACION'
)
GROUP BY 1, 2, 3;
```

---

## 3. Lógica del Servidor y Gestión de Datos

### 3.1. Consulta Instantánea (`GET /api/db`)
Cuando el planificador se carga o el usuario navega por los días, el frontend realiza una petición `GET /api/db`.
* El backend sirve **inmediatamente** los datos consolidados desde su caché en memoria (tiempo de respuesta **< 20ms**).
* De forma asíncrona (en segundo plano), el backend realiza una consulta paginada a Supabase para refrescar la memoria caché con cualquier cambio de último momento, asegurando que la interfaz esté siempre actualizada sin penalizar la velocidad de navegación del usuario.

### 3.2. Sincronización de Citas bajo Demanda (`POST /api/sync-demand`)
Al presionar el botón **"Sincronizar Turnos"** en la interfaz:
1. El backend se conecta vía FTPS segura a la turnera (`turnera-040626z.iteosrl.com.ar`).
2. Descarga el archivo `Turnos.xlsx`.
3. Procesa e identifica los registros de citas.
4. **Deduplicación Estricta**: Genera una clave única basada en `paciente_profesional_turno` y realiza un `upsert` por lotes de 1000 registros en la tabla `planning_patient_appointments` de Supabase.
5. Invalida y refresca el caché en memoria del backend consultando la vista actualizada.
6. El frontend actualiza los gráficos de demanda de forma automática.

---

## 4. Manual de Operación en la Interfaz (Frontend)

### 4.1. Sincronización Manual de Turnos
1. Haz clic en el botón **"Sincronizar Turnos"** (ubicado en el encabezado junto al botón de guardar).
2. El botón mostrará un spinner giratorio y cambiará su texto a **"Sincronizando..."**. Durante este proceso, las consultas FTP y la subida en lotes a Supabase se ejecutarán de fondo de forma segura.
3. Al finalizar, recibirás una alerta de éxito indicando que la base de datos fue actualizada y los nuevos datos se cargarán en pantalla de inmediato.

### 4.2. Guardado de Planificación
* Al arrastrar turnos o modificar la cuadrícula, aparecerá el botón **"Guardar Planificación"** en color naranja de manera parpadeante (indicando cambios pendientes).
* Al hacer clic, se guardarán los turnos y asistencia directamente en Supabase (tarda menos de 50ms). Una vez confirmado, el botón volverá a su estado verde como **"Sincronizado"**.

---

## 5. Procedimiento de Operación Diario y Mantenimiento

### 5.1. Arrancar el Planificador
El sistema incluye scripts automatizados para el inicio y apagado limpio:
* **Iniciar el Planificador**: Ejecuta el archivo `Iniciar_Planificador_Oculto.vbs` en la raíz. Esto levantará los servidores backend (puerto `3021`) y frontend (puerto `3020`) de forma invisible en segundo plano, y abrirá automáticamente tu navegador predeterminado en `http://localhost:3020`.
* **Detener el Planificador**: Ejecuta el archivo `Detener_Planificador.bat` en la raíz para cerrar de forma segura todos los procesos colgados de Node.js o Vite y liberar los puertos.

### 5.2. Copias de Seguridad de Versiones (`Versiones anteriores`)
Antes de cada compilación de distribución (`npm run build`), se debe copiar la carpeta `dist` anterior a la carpeta `Versiones anteriores/` asignándole un nombre de versión claro (ej. `dist_pre_supabase_single_source_of_truth`). Esto garantiza la posibilidad de un rollback inmediato en caso de fallos.

---

## 6. Monitoreo y Solución de Problemas

* **Los gráficos de demanda muestran 0 pacientes o curvas vacías**:
  * Verifica tu conexión a Internet. El planificador ahora consulta Supabase en la nube en cada inicio.
  * Si es la primera vez que inicializas el sistema en una base limpia, asegúrate de presionar el botón **"Sincronizar Turnos"** para cargar los datos históricos desde la turnera FTP.
* **Error de conexión FTPS**:
  * Si la sincronización manual falla, comprueba que las credenciales FTP en el archivo `.env` o en `server.ts` siguen vigentes y que el servidor `turnera-040626z.iteosrl.com.ar` se encuentra en línea.
* **Puerto en uso (Bloqueo al iniciar)**:
  * Si al abrir el planificador los datos no cargan o sale pantalla de error, ejecuta `Detener_Planificador.bat` para limpiar los procesos colgados de Node y vuelve a iniciarlo.

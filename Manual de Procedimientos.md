# Manual de Procedimiento: Sistema de Planificación "SFH ITEO" (Supabase & FTPS Synchronizer)

Este manual describe el funcionamiento, la arquitectura y los procedimientos operativos del sistema de planificación **SFH ITEO** tras la migración completa a la base de datos Supabase de **Hermes-Tesoreria-ITEO**, haciendo de Supabase la fuente única de verdad, y la incorporación de la sincronización automática directa y el servidor integrado.

---

## 1. Descripción General del Sistema

**SFH ITEO** es un planificador interactivo de turnos, simulador de demanda y gestor de personal para admisores de la clínica.
El sistema opera bajo una arquitectura centralizada en la nube:
1. **Fuente Única de Verdad (Supabase)**: Todos los datos, incluidos la planificación, los empleados, asistencia y turnos clínicos de pacientes, se almacenan y consultan en **Supabase** bajo el esquema dedicado **`control_de_horas`**.
2. **Sincronización a Demanda (FTPS)**: Mediante el botón de acciones **"Actualizador de turnos"** en la interfaz, el sistema solicita de forma automatizada al servidor que se conecte a la turnera FTPS para descargar, deduplicar e importar nuevos turnos históricos a Supabase de forma incremental.

---

## 2. Arquitectura de Almacenamiento y Datos

### 2.1. Base de Datos Supabase (Proyecto: `wbguwmbwutvhqsirtjps`)
Toda la base de datos operativa y de demanda del planificador reside en Supabase en el esquema `control_de_horas`:
* **Endpoint API**: `https://wbguwmbwutvhqsirtjps.supabase.co`
* **Tablas Utilizadas**:
  1. **`planning_areas`**: Listado de las áreas de trabajo activas en el planificador (ej. Admisión).
  2. **`planning_employees`**: Registro de colaboradores (legajo, nombre, área, disponibilidad horaria, color de interfaz y turnos posibles).
  3. **`planning_shifts`**: Turnos de trabajo asignados a cada empleado (fecha, duración y hora de inicio).
  4. **`planning_targets`**: Objetivos de cobertura (cantidad de admisores requeridos) por área y día de la semana.
  5. **`planning_attendance`**: Registro de asistencia (presentismo) a los turnos planificados.
  6. **`planning_patient_appointments`**: Tabla que contiene la totalidad de los turnos clínicos históricos de los pacientes.
  7. **`turnera_profesionales`**: Tabla de mapeo de profesionales y especialidades, utilizada para clasificar o excluir consultas.

### 2.2. Filtro de Especialidades (Exclusión de Kinesiología / Rehabilitación)
Para alinear la demanda del panel de planificación con la aplicación de escritorio local de la clínica (por ejemplo, reportando exactamente **187 turnos el 23 de junio de 2026**), el sistema filtra y excluye las citas pertenecientes a kinesiología/rehabilitación. Se excluyen dinámicamente los profesionales que figuren con `tipo_consulta = 'REHABILITACION'` en `turnera_profesionales` (ej. `LIMONGI MERCEDES`, `MENDOZA MARIA VIVIANA` y `BRUNO DELFINA MARIA`).

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

### 3.1. Servidor Único Integrado (Express)
El backend (`backend/server.ts`) está configurado para servir los archivos de distribución compilados del frontend (`dist/`) de forma unificada.
* **Puerto de Producción**: `3021`
* **Acceso**: `http://localhost:3021`
* Al correr en un servidor único, se evitan errores de tipo *Cross-Origin (CORS)* y el sistema se auto-sustenta de forma local o en la nube sin requerir un hosting estático adicional.

### 3.2. Consulta Instantánea con Caché (`GET /api/db`)
Cuando el planificador se carga o el usuario navega por los días:
* El backend sirve **inmediatamente** los datos consolidados desde su caché en memoria (tiempo de respuesta **< 20ms**).
* De forma asíncrona (en segundo plano), el backend realiza una consulta paginada a Supabase para refrescar la memoria caché con cualquier cambio de último momento, asegurando que la interfaz esté siempre actualizada.

### 3.3. Sincronización Automática e Incremental de Citas (`POST /api/sync-demand`)
Al presionar el botón **"Actualizador de turnos"** en la interfaz:
1. El frontend realiza un consumo a la API del backend `/api/sync-demand`.
2. El backend se conecta vía FTPS segura a la turnera (`turnera-040626z.iteosrl.com.ar`).
3. Descarga el archivo `Turnos.xlsx`.
4. Procesa e identifica los registros de citas.
5. **Deduplicación Estricta**: Genera una clave única basada en `paciente_profesional_turno` y realiza un `upsert` por lotes de 1000 registros en la tabla `planning_patient_appointments` de Supabase.
6. Invalida y refresca el caché en memoria del backend consultando la vista de base de datos actualizada.
7. El frontend actualiza de inmediato el planificador sin recargar la página.

---

## 4. Manual de Operación en la Interfaz (Frontend)

### 4.1. Botón "Actualizador de turnos" (Sincronización Inteligente)
* **Ubicación**: En el encabezado superior derecho del planificador, posiciona el cursor sobre **`🛠️ Herramientas`** para desplegar el panel flotante y haz clic en **"Actualizador de turnos"**.
* **Proceso**: El botón cambiará de estado a **"Actualizando..."** y el ícono comenzará a girar. Durante este tiempo el servidor realiza de forma invisible toda la descarga FTP e importación a Supabase.
* **Fallback Interactivo**: Si el servidor backend integrado no estuviera encendido, el sistema capturará el error de red y te ofrecerá de forma interactiva la opción de hacer una sincronización manual subiendo directamente un archivo Excel local desde tu computadora.

### 4.2. Gráficos de Frecuencia con Agrupamiento Horario (HH:00)
* En la pestaña **"Análisis Estadístico e Histórico"**, el gráfico de barra de frecuencias horarias agrupa automáticamente las citas por horas completas.
* *Ejemplo:* Si tienes citas programadas a las `13:00`, `13:15` y `13:30`, todas se agruparán dentro de la barra de la hora **`13:00`**, permitiendo ver de manera clara e intuitiva los picos reales de demanda por hora en la clínica.

### 4.3. Selección de Temas Estéticos
El sistema cuenta con un catálogo de **11 temas de color estéticos** ajustables desde el menú lateral izquierdo (botón con ícono de paleta ⚙️/🎨).
Se añadieron los siguientes temas premium solicitados por el usuario:
* **Vichy**: Un estilo corporativo basado en tonos teal/verde azulado y grises profesionales.
* **Sorbet**: Una estética otoñal cálida con combinación de verde salvia y rosa viejo/mauve.
* **Frozen Mist**: Una paleta de alto contraste con acentos naranja vibrantes sobre grises y aceituna oscuro.

### 4.4. Scroll Único de Página Completa
* La cuadrícula de turnos se dibuja en su totalidad de arriba a abajo.
* No existen barras de desplazamiento vertical internas dentro de la grilla. Para ver todos los admisores y horarios, se utiliza la barra de scroll general del navegador.
* El **Monitor de Cobertura y Densidad** se ubica al pie de la página, accesible deslizando la página web hacia abajo.

---

## 5. Procedimiento de Operación Diario y Mantenimiento

### 5.1. Arrancar el Planificador
* **Iniciar el Planificador**: Ejecuta el archivo `Iniciar_Planificador_Oculto.vbs` o `Iniciar_Planificador.bat` in la raíz. Esto levantará los servidores backend y abrirá automáticamente tu navegador en `http://localhost:3021` (o en `http://localhost:3020` en modo desarrollo).
* **Detener el Planificador**: Ejecuta el archivo `Detener_Planificador.bat` en la raíz para cerrar de forma segura todos los procesos colgados de Node.js o Vite y liberar los puertos.

### 5.2. Copias de Seguridad de Versiones (`Versiones anteriores`)
Antes de cada compilación de distribución (`npm run build`) o cambios críticos, se realiza una copia de seguridad del directorio `dist/` a la carpeta `Versiones anteriores/` asignándole un nombre de versión descriptivo (ej. `dist_pre_automatic_sync_button`).

### 5.3. Gestión de Repositorios (Git Multi-Remoto)
El código fuente de este proyecto se gestiona de forma centralizada en dos repositorios remotos:
1. **`origin`**: Repositorio principal de desarrollo (`https://github.com/AstudillaJS/Planificador-de-turnos.git`).
2. **`lynxok`**: Repositorio de la organización/cuenta Lynx (`https://github.com/lynxok/Planificador-de-turnos-.git`).

Para empujar los cambios de la rama activa:
```bash
git push origin Reloj-de-horas-1
git push lynxok Reloj-de-horas-1
```

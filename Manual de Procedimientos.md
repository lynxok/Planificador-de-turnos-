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

### 4.2. Botón "Cargar Principales" (Asignación Automática Inteligente)
* **Ubicación**: En el encabezado superior derecho, dentro del menú de **`🛠️ Herramientas`**.
* **Proceso**: Escanea a todos los colaboradores del departamento activo en el día seleccionado. Si no cuentan con turnos asignados ni ausencias programadas, les genera de forma automática un turno de trabajo real aplicando el horario que el usuario haya tildado como **⭐️ Principal** en su ficha.

### 4.3. Registro de Ausencias (Vacaciones y Enfermedad)
* **Atajos Rápidos**: Al programar un turno en el modal de edición, cuentas con los botones **`🏝️ Vacaciones`** y **`🤒 Enfermedad`**.
* **Configuración Automática**: Al hacer clic en uno de ellos, el sistema configura el turno para que dure 24 horas y le asigna el área especial correspondiente.
* **Aspecto Visual en Turnera**: Se dibujan bloques completos con rayas diagonales degradadas:
  * **Vacaciones**: Fondo rayado gris oscuro con etiqueta `🏝️ VACACIONES`.
  * **Enfermedad**: Fondo rayado rojo con etiqueta `🤒 ENFERMEDAD / LICENCIA`.
* **Seguridad**: Estos bloques de ausencia están bloqueados para edición rápida (drag/resize) y previenen automáticamente que el botón de carga de principales les asigne turnos de trabajo, asegurando que se respete la licencia del personal.

### 4.4. Selección de Temas Estéticos
El sistema cuenta con un catálogo de **11 temas de color estéticos** ajustables desde el menú lateral izquierdo (botón con ícono de paleta ⚙️/🎨).
Se añadieron los siguientes temas premium solicitados por el usuario:
* **Vichy**: Un estilo corporativo basado en tonos teal/verde azulado y grises profesionales.
* **Sorbet**: Una estética otoñal cálida con combinación de verde salvia y rosa viejo/mauve.
* **Frozen Mist**: Una paleta de alto contraste con acentos naranja vibrantes sobre grises y aceituna oscuro.

### 4.5. Scroll Único de Página Completa
* La cuadrícula de turnos se dibuja en su totalidad de arriba a abajo.
* No existen barras de desplazamiento vertical internas dentro de la grilla. Para ver todos los admisores y horarios, se utiliza la barra de scroll general del navegador.
* El **Monitor de Cobertura y Densidad** se ubica al pie de la página, accesible deslizando la página web hacia abajo.

---

## 5. Módulo de Reportes, Dashboards y Filtros Avanzados

El sistema integra un completo generador de reportes consolidado y dashboards estadísticos dinámicos:

### 5.1. Dashboards de Análisis con Filtro Desde-Hasta
* **Ubicación**: En la pestaña **`Análisis de Turnera`**.
* **Filtros Interactivos**: Reemplaza el selector de fecha única por dos campos de fecha interactivos (`Desde` y `Hasta`). Al modificarse, todos los KPI's, gráficos de Chart.js y análisis de frecuencias se recalculan en tiempo real para el rango de fechas seleccionado.
* **Exportación a PDF**: El generador de informes en PDF declara automáticamente el rango de fechas seleccionado en el encabezado del documento impreso.
* **Ventana de Turnos Programados (Grilla Detallada)**: Al hacer clic en el botón flotante verde **`📋 Ver Turnos Programados`** en el encabezado, se abre una ventana modal interactiva para consultar la lista pormenorizada de turnos de la fecha seleccionada. Cuenta con buscador en tiempo real por **Apellido y nombres** de pacientes, selectores rápidos de fecha y médico, un checkbox para filtrar solo turnos confirmados por WhatsApp y un diseño estético idéntico a la turnera nativa (mostrando Hora con íconos informativos/WhatsApp, Paciente, Médico, Cobertura, Asistencia, Atención e Historia Clínica).

### 5.2. Reportes con Gráficos Nativos Premium
* **Gráfico de Embudo (Funnel) de Obras Sociales**: Muestra el Top 5 de atenciones confirmadas por cobertura, ordenadas jerárquicamente con barras horizontales de ancho proporcional y degradados, acompañadas de tooltips.
* **Histograma de Frecuencia por Día**: Un gráfico cronológico con barras verticales que ilustra el volumen de turnos por fecha. Cuenta con scroll horizontal adaptativo para soportar de forma legible análisis de largos períodos.
* **Opción "TODOS" (Por Defecto)**: En el selector de profesionales del generador de reportes, la opción **`'TODOS'`** se encuentra seleccionada por defecto al cargar el componente. Esto permite consolidar las estadísticas de la clínica completa e inyectar de inmediato una columna dinámica **"Profesional"** en la grilla de datos, eliminando la necesidad de seleccionar médicos manualmente para obtener un panorama global.

---

## 6. Procedimiento de Operación Diario y Mantenimiento

### 6.1. Arrancar el Planificador
* **Iniciar el Planificador**: Ejecuta el archivo `Iniciar_Planificador_Oculto.vbs` o `Iniciar_Planificador.bat` en la raíz. Esto levantará los servidores backend y abrirá automáticamente tu navegador en `http://localhost:3021` (o en `http://localhost:3020` en modo desarrollo).
* **Detener el Planificador**: Ejecuta el archivo `Detener_Planificador.bat` en la raíz para cerrar de forma segura todos los procesos colgados de Node.js o Vite y liberar los puertos.

### 6.2. Configuración del Horario Principal de Colaboradores
1. Ve al menú lateral izquierdo y selecciona **`Gestión de Personal`**.
2. Haz clic en **Editar** (icono de lápiz ✏️) en el colaborador deseado.
3. Desplázate al pie del modal hasta la sección **`Plantillas de Turnos Posibles`**.
4. Cada turno posible posee una casilla circular de tipo **Radio Button**. Haz clic en el círculo del turno que deseas marcar como **⭐️ Principal**.
5. Presiona **`Guardar Cambios`** para registrar la prioridad en Supabase.

### 6.3. Copias de Seguridad de Versiones (`Versiones anteriores`)
Antes de cada compilación de distribución (`npm run build`) o cambios críticos, se realiza una copia de seguridad del directorio `dist/` a la carpeta `Versiones anteriores/` asignándole un nombre de versión descriptivo (ej. `dist_pre_primary_radio_indicator_2026_07_23`).

### 6.4. Gestión de Repositorios (Git Multi-Remoto)
El código fuente de este proyecto se gestiona de forma centralizada en dos repositorios remotos:
1. **`origin`**: Repositorio principal de desarrollo (`https://github.com/AstudillaJS/Planificador-de-turnos.git`).
2. **`lynxok`**: Repositorio de la organización/cuenta Lynx (`https://github.com/lynxok/Planificador-de-turnos-.git`).

Para empujar los cambios de la rama activa:
```bash
git push origin Reloj-de-horas-1
git push lynxok Reloj-de-horas-1
```

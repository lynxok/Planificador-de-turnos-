# Manual de Procedimiento: Sistema de Planificación "SFH ITEO" (Supabase & FTP Hybrid)

Este manual describe el funcionamiento, la arquitectura y los procedimientos operativos del sistema de planificación **SFH ITEO** tras la migración del almacenamiento de planificación a la base de datos Supabase de **Hermes-Tesoreria-ITEO** y la conservación de la demanda mediante archivos FTP.

---

## 1. Descripción General del Sistema

**SFH ITEO** es un planificador interactivo de turnos, simulador de demanda y gestor de personal para admisores de la clínica. 
Su arquitectura de almacenamiento es **híbrida**:
1. **Demanda e historial de citas médicas**: Se cargan de manera dinámica desde el archivo **`Turnos.xlsx`** alojado en el servidor FTP de la clínica (solo lectura).
2. **Estructura y Planificación (Colaboradores, áreas, turnos y presentismo)**: Se almacenan de manera persistente en la base de datos relacional de **Supabase**, eliminando problemas de concurrencia y pérdidas de datos por sobrescritura de archivos.

---

## 2. Arquitectura de Almacenamiento y Datos

### 2.1. Conexión FTP (Citas Médicas e Historial)
El sistema accede al FTP únicamente para leer el archivo de citas médicas. **Este archivo es de solo lectura para la aplicación**.
* **Host**: `turnera-040626z.iteosrl.com.ar`
* **Directorio Destino**: `/public_html/turnera-040626z`
* **Archivo de Citas**: `Turnos.xlsx`
* **Hoja utilizada**: `Sheet1` (contiene el registro de turnos clínicos históricos y activos).

### 2.2. Conexión Supabase (Planificación y Colaboradores)
Toda la base de datos operativa del planificador reside en el proyecto **Hermes-Tesoreria-ITEO** de Supabase:
* **Endpoint API**: `https://fwsnaasfxfzacchsyijx.supabase.co`
* **Tablas Utilizadas**:
  1. **`planning_areas`**: Listado de las áreas de trabajo activas en el planificador.
  2. **`planning_employees`**: Registro completo de colaboradores (legajo, nombre, área, disponibilidad horaria, color de interfaz y plantillas de turnos sugeridas).
  3. **`planning_shifts`**: Turnos de trabajo asignados a cada empleado (fecha, duración y hora de inicio).
  4. **`planning_targets`**: Objetivos de cobertura (cantidad de admisores requeridos) por área y día de la semana.
  5. **`planning_attendance`**: Registro de asistencia (presentismo) a los turnos planificados.

---

## 3. Lógica del Servidor y Gestión de Datos

### 3.1. Agregación Dinámica de la Demanda
La demanda de pacientes por hora no se guarda en una tabla física. El backend descarga `Turnos.xlsx` de forma asíncrona, procesa las miles de filas de `Sheet1` mapeando fechas seriales a horas `0-23`, y las clasifica dinámicamente:
* **Pacientes ART**: Si la columna `Cobertura` contiene las siglas **"ART"**.
* **Pacientes Obra Social (OS)**: Para cualquier otra cobertura registrada.

El frontend recibe esta información consolidada y calcula la dotación teórica de admisores necesarios aplicando las ecuaciones **Erlang C**.

### 3.2. Sincronización y Guardado Ultra Rápido
* **Lectura (`GET /api/db`)**: El backend realiza una descarga transparente de `Turnos.xlsx` del FTP para actualizar la demanda y lee de Supabase las tablas de planificación para responder al frontend de manera integrada.
* **Escritura (`POST /api/db`)**: Al guardar cambios (por ejemplo, arrastrar un turno), el frontend envía únicamente las modificaciones al backend. El backend escribe estas actualizaciones directamente en Supabase de forma atómica. Dado que no requiere descargar ni subir archivos pesados por FTP en las escrituras, el proceso de guardado es prácticamente instantáneo (menos de 50ms) y evita condiciones de carrera.

---

## 4. Módulo de Gestión de Personal (Alta y Baja de Colaboradores)

El sistema incorpora un nuevo módulo completo para la administración del personal, accesible desde la pestaña **"Gestión de Personal"**:
1. **Buscar Colaboradores**: Permite filtrar empleados por su nombre, legajo o departamento específico.
2. **Alta de Colaborador (Crear Nuevo)**: Al hacer clic en `+ Alta de Colaborador`, se abre una ficha limpia donde se ingresa:
   * Nombre Completo y Número de Legajo/ID.
   * Área o Departamento asignado.
   * Límite de horas sugeridas y rango de disponibilidad horaria.
   * Color personalizado de identificación (para la línea de tiempo).
   * Plantillas de turnos sugeridas para facilitar la asignación posterior.
3. **Modificar o Dar de Baja**: Permite alterar las fichas de personal en cualquier momento o eliminarlos de forma permanente de la base de datos de Supabase.

---

## 5. Procedimiento de Operación Diario y Mantenimiento

### 5.1. Arrancar el Planificador
Para iniciar el sistema en modo de desarrollo local:
1. Ejecutar el archivo **`Iniciar_Planificador.bat`** en la carpeta raíz del proyecto.
2. Esto levantará:
   - El servidor backend en el puerto `3021`.
   - El servidor de desarrollo Vite en el puerto `3020` (se abrirá automáticamente el navegador).
3. Mantenga abierta la terminal de comandos mientras trabaje en la aplicación.

### 5.2. Respaldos y Despliegues de Producción
Cada vez que se realiza una modificación del código y se compila para producción (`npm run build`), el sistema realiza un respaldo del compilado de distribución anterior dentro de la carpeta `Versiones anteriores/` con un nombre descriptivo de la versión. Esto permite realizar rollbacks instantáneos copiando el contenido de la carpeta elegida hacia la carpeta `dist`.

---

## 6. Monitoreo y Solución de Problemas

* **Error de conexión a la base de datos**: Si el planificador muestra una pantalla de error, verifica tu conexión a internet. Supabase requiere conexión a internet para poder leer y escribir los empleados y los turnos.
* **La demanda de pacientes no carga**: Si las curvas de pacientes ART/OS del gráfico inferior no se dibujan, comprueba el estado del servidor FTP de la clínica. Si está fuera de servicio o las credenciales expiraron, el backend no podrá descargar el archivo `Turnos.xlsx`.
* **Puerto en uso**: Si los puertos `3020` o `3021` están bloqueados por procesos Node colgados en segundo plano, abre una consola de comandos de Windows y ejecuta:
  `taskkill /F /IM node.exe`
  Luego, vuelve a iniciar el planificador normalmente.

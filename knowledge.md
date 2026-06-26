# Registro de Conocimiento (Knowledge.md)

Este archivo registra las decisiones de arquitectura, integraciones de base de datos y mejoras realizadas en el proyecto **Planificador de Turnos**.

---

## 1. Migración a Supabase (Backend RPC)
Se reemplazó la persistencia local en memoria / archivo (`/api/db`) por una conexión directa a **Supabase** a través de funciones RPC (Remote Procedure Calls) seguras, centralizadas y transaccionales.

* **Cliente Supabase:** Creado en [`src/supabase.ts`](file:///c:/Users/ignac/OneDrive/LYNX/Turnos/src/supabase.ts). Utiliza la base de datos oficial del proyecto.
* **Carga de Datos (`fetchDb`):** 
  * Se consume la función RPC `fetch_planning_data` para recuperar personas, turnos, objetivos de cobertura (`planning_targets`) y registros de asistencia.
  * Se consume la función RPC `fetch_planning_demand` para recuperar la cantidad de pacientes agendados por hora y tipo (ART vs. Obra Social).
* **Guardado de Datos (`saveDb`):** 
  * Se realiza mediante la función RPC `save_planning_data`, enviando el payload modificado en una transacción única.

## 2. Indicadores de Cobertura y Demanda (Erlang C)
* **Teoría de Colas:** La interfaz calcula el tiempo teórico de espera basándose en la llegada de pacientes tipo **ART** (duración estimada de **6 minutos**) y **Obra Social / OS** (duración estimada de **4 minutos**), cruzado con la cantidad de colaboradores planificados por hora en su puesto.
* **Ajuste en `CoverageChart`:** Se actualizó la lógica en [`src/components/CoverageChart.tsx`](file:///c:/Users/ignac/OneDrive/LYNX/Turnos/src/components/CoverageChart.tsx) para buscar los registros de demanda y emparejarlos correctamente con el área activa del planificador.

## 3. Persistencia de Preferencias de Interfaz
* Se agregó persistencia en `localStorage` del área de cobertura activa (`cov_active_area`) en [`src/App.tsx`](file:///c:/Users/ignac/OneDrive/LYNX/Turnos/src/App.tsx) para evitar que el usuario deba re-seleccionar su área de trabajo tras refrescar la página.

## 4. Sincronización Automática y On-Demand de Turnos (FTPS a Supabase)
Se implementó un sistema para importar citas de pacientes desde un servidor FTP externo de forma automática y manual:
* **Script de Sincronización ([sync-ftp.js](file:///c:/Users/ignac/OneDrive/LYNX/Turnos/scripts/sync-ftp.js)):** Script Node.js que se conecta vía FTPS, descarga el archivo `Turnos.xlsx`, procesa las filas deduplicando duplicados (por clave `paciente_profesional_turno`) y las upserta en Supabase en lotes de 1000 usando la función RPC `upsert_patient_appointments` con el esquema por defecto `public`.
* **Automatización en la Nube (GitHub Actions):** Se creó el workflow [sync-turnos.yml](file:///c:/Users/ignac/OneDrive/LYNX/Turnos/.github/workflows/sync-turnos.yml) ejecutando Node 22 que se dispara cada 6 horas automáticamente o bajo demanda (`workflow_dispatch`).
* **Logs y Auditoría:** La tabla `planning_sync_logs` (y su vista expuesta en `public`) almacena los resultados de cada ejecución.
* **Interfaz de Usuario (React):** 
  * Botón 🕒 de historial que despliega [SyncLogsModal.tsx](file:///c:/Users/ignac/OneDrive/LYNX/Turnos/src/components/SyncLogsModal.tsx) con los últimos 15 registros de sincronización.
  * El botón actualizador en [App.tsx](file:///c:/Users/ignac/OneDrive/LYNX/Turnos/src/App.tsx) corre localmente descargando el archivo o, en producción, realiza un fallback disparando la función RPC `trigger_github_sync()` para iniciar el workflow de GitHub de manera remota.

---
*Última actualización: 26 de Junio, 2026 (Sincronización FTP e Integración GitHub).*
*

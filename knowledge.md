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

---
*Última actualización: 26 de Junio, 2026.*

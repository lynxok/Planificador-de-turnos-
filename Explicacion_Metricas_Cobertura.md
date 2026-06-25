# Explicación de Métricas y Gráfico de Cobertura (SFH ITEO)

Este documento detalla el funcionamiento y los algoritmos utilizados por el **Gráfico de Cobertura por Hora y Flujo de Turnos** para calcular las barras, flujos y tiempos de espera en la interfaz de planificación.

---

## 1. Las Barras de Cobertura (Fondo y Colores)

Cada una de las 24 barras representa una hora del día (de `00:00` a `23:00`). Su altura y color se determinan cruzando el **personal real planificado** contra el **objetivo mínimo requerido (bocas necesarias)**:

* **Línea de Meta (Línea Horizontal Amarilla/Dorada)**: Representa el objetivo mínimo de personal para esa hora (`target`).
* **Color de la Barra**:
  * **Rojo (Deficiente - Subcobertura)**: Cuando el personal funcionando es **menor** que el objetivo requerido en esa hora (`actual < target`). Muestra que faltan puestos por cubrir.
  * **Dorado (Óptimo - Cobertura exacta)**: Cuando el personal funcionando es **exactamente igual** al objetivo (`actual === target`).
  * **Azul/Púrpura (Exceso beneficioso)**: Cuando el personal funcionando es **mayor** que el objetivo (`actual > target`).
* **Diferencia inferior (`+1`, `+2`, `-1`, `OK`)**: Es el balance matemático neto (`Personal Real - Objetivo`).

---

## 2. Flujo de Turnos (Microindicadores ▲ y ▼)

Indican el movimiento de personal en tiempo real al inicio de cada hora:
* **▲ Verde**: Cantidad de colaboradores que **inician** su turno en esa hora exacta.
* **▼ Rojo**: Cantidad de colaboradores que **finalizan** su jornada laboral en esa hora.
* *Nota: Al pasar el cursor sobre cualquier barra en la interfaz, un panel flotante (Tooltip) revela los nombres y apellidos específicos de los colaboradores que ingresan o egresan en ese bloque.*

---

## 3. Las Métricas Inferiores

Al pie del gráfico se muestran tres indicadores clave calculados hora por hora:

### A. Cantidad de bocas de atenciones necesarias (Teórico) — *Color Dorado*
* Es el objetivo de cobertura para cada hora. Se lee directamente de la configuración guardada en Supabase (`planning_targets`) o se extrae dinámicamente de la demanda histórica calculada para ese día si hay datos cargados.

### B. Cantidad de bocas de atención funcionando (En su puesto) — *Color Verde*
* Es la cantidad real de empleados que tienen un turno asignado y activo durante esa hora.

### C. Tiempo teórico de espera (Cola estimada) — *Color Celeste*
Este es un cálculo predictivo inteligente basado en la teoría de colas utilizando el **modelo matemático Erlang C** (`calculateTheoreticalWaitTime`):

* **Variables de entrada**:
  * La cantidad de pacientes que llegan en esa hora de tipo **ART** (con un tiempo de atención estimado de **6 minutos** por paciente).
  * La cantidad de pacientes de tipo **Obra Social (OS)** (con un tiempo de atención estimado de **4 minutos** por paciente).
  * La cantidad de colaboradores reales activos en su puesto (`bocas funcionando`).
* **Resultados en pantalla**:
  * Si no hay pacientes agendados en esa hora, muestra **`0m`** (gris).
  * Si hay pacientes pero **no hay personal planificado**, se muestra **`Sat.`** (Saturado en rojo parpadeante).
  * Si hay personal, calcula la probabilidad de cola y arroja el tiempo estimado en minutos (ej: **`14.5m`** o **`2.2m`**), coloreándose en verde, amarillo o rojo según la gravedad de la espera.

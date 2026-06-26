# Plan de Migración a Arquitectura Serverless y Esquema Dedicado

Este documento registra las decisiones de diseño para resolver el problema de conexión a la base de datos tras subir el frontend a producción (`dist` en `www.controldehoras.iteosrl.com.ar`).

---

## 1. Diagnóstico Actual
Actualmente, el sistema depende de una arquitectura híbrida en desarrollo:
* **Frontend (Vite):** Se compila a la carpeta `/dist` y se sube como archivos estáticos.
* **Backend (Node/Express):** Corre localmente en el puerto `3021`. Se encarga de conectarse con Supabase, descargar archivos de un FTP, parsear planillas de Excel e inicializar la memoria caché.
* **Problema:** En producción (`www.controldehoras.iteosrl.com.ar`), no existe un servidor Node/Express ejecutando el backend. Las llamadas a `/api/db` fallan porque el proxy de Vite no existe en producción y no hay un endpoint escuchando en ese dominio.

---

## 2. Decisión de Diseño: Opción A (Cliente Directo + Supabase)
Se ha decidido eliminar la necesidad de un servidor backend (VPS) en producción y operar directamente desde el navegador (Client-side puro).

### A. Consultas Directas a Supabase
* Se integrará `@supabase/supabase-js` directamente en la aplicación de React.
* Se realizarán las consultas CRUD (empleados, turnos, objetivos, asistencia) directamente a Supabase utilizando la *Anon Key*.

### B. Aislamiento por Esquema en Supabase
* **Proyecto Destino:** "Control de Personal" (o similar).
* **Nuevo Esquema:** Se creará un esquema específico en la base de datos PostgreSQL llamado `control_de_horas` (separado de `public`) para mantener las tablas organizadas y no ensuciar otros desarrollos.
* **Inicialización:** El cliente de Supabase se configurará en el frontend indicando este esquema:
  ```typescript
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: 'control_de_horas' }
  });
  ```

### C. Reemplazo del FTP (Importación de Excel)
* Dado que el navegador no puede conectarse por protocolo FTP directo por motivos de seguridad:
  * Se diseñará un botón en la interfaz web de la aplicación (ej. *"Importar Turnos"*).
  * El usuario subirá de forma manual el archivo `.xlsx` (Excel) correspondiente.
  * La aplicación procesará el Excel directamente en el navegador usando la librería `xlsx` (JS) y subirá el lote de registros procesados a la tabla de Supabase en caliente.

---

## 3. Próximos Pasos (Hoja de Ruta)
1. **Creación del Esquema en Supabase:**
   * Crear el esquema `control_de_horas`.
   * Migrar/crear la estructura de tablas necesarias en este nuevo esquema (ej. `planning_employees`, `planning_shifts`, etc.).
   * Configurar permisos en Supabase para permitir el acceso al esquema `control_de_horas` por parte del rol `anon`/`authenticated`.
2. **Refactorización del Frontend (React):**
   * Configurar el cliente de Supabase apuntando al nuevo esquema.
   * Modificar `src/api.ts` para usar consultas directas de Supabase en lugar de `fetch('/api/db')`.
   * Implementar el componente de carga de archivo Excel en el frontend usando `xlsx`.
3. **Seguridad y RLS (Pendiente a futuro):**
   * Actualmente las tablas en el esquema `control_de_horas` tienen RLS desactivado.
   * Si en el frontend se accede directamente usando la clave `anon`, se debe evaluar activar RLS y configurar las políticas de acceso (políticas SELECT, INSERT, etc.) para restringir el acceso a usuarios autorizados.
   * Si todo el acceso se centraliza a través de un servicio de backend seguro o conexión administrativa directa (bypass RLS), se puede dejar desactivado.

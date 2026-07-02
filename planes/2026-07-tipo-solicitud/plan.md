# Plan: Clasificación normalizada de Solicitudes (Grupo / Centro / Administración / Externos)

> Estado: **Implementado y desplegado en `dev`** (2026-07-02). Ver `todo.md` en esta misma carpeta para el detalle de lo ejecutado.

## Contexto

Hoy el "origen" de una solicitud (¿la creó un grupo o un centro?) es un valor **derivado en SQL** (`CASE WHEN creado_por_grupo_id IS NOT NULL THEN 'grupo' ELSE 'centro' END`), no una columna real. Te están pidiendo que esta clasificación quede **normalizada en la base de datos** (tabla catálogo + FK).

Además de Grupo/Centro hace falta cubrir el caso en que una solicitud no tiene ni grupo ni centro asociado: hoy eso pasa exactamente cuando un **admin/coordinador crea una solicitud directamente** desde `ModuloSolicitudes.jsx` (el formulario no tiene selector de grupo destino, así que `creado_por_grupo_id` y `creado_por_centro_id` quedan **ambos NULL**). Con el CASE actual, esas solicitudes se muestran incorrectamente como `origen.tipo = 'centro'` con nombre vacío (bug existente).

En vez de un único "Otro" genérico, ese caso se separa en dos tipos:
- **Administración**: quien la creó tiene rol `admin` (el único camino que hoy produce ambos IDs en NULL).
- **Externos**: reservado para cualquier otro caso futuro que tampoco tenga grupo/centro/admin asociado (hoy no hay ningún flujo de la UI que lo dispare, pero queda modelado en el catálogo para no requerir otra migración cuando aparezca, p.ej. una vía de ingreso externa).

Decisiones confirmadas:
- El tipo se asigna **automáticamente** según quién crea la solicitud. Sin selector manual en el formulario.
- Catálogo de **4 valores fijos** (Grupo, Centro, Administración, Externos), sin pantalla de administración.
- Se mantienen las columnas actuales `creado_por_grupo_id` / `creado_por_centro_id` tal cual (con su FK real e inequívoca cada una) — **no** se abstraen en un id de creador genérico: `grupos_trabajo.id` y `centros_atencion.id` son secuencias independientes que arrancan ambas en 1, así que un id genérico sin tabla fija sería ambiguo (un grupo #3 y un centro #3 serían indistinguibles) y obligaría a que cada query que hoy filtra sin ambigüedad por `creado_por_grupo_id`/`creado_por_centro_id` (ownership checks en editar/eliminar, notificaciones, filtros de listado) se reescriba para depender siempre de una condición doble (id + tipo) — más superficie de bug que beneficio. `tipo_solicitud_id` se agrega como clasificación **independiente**, no como discriminador de un id polimórfico.
- Todo se ejecuta contra el **esquema `dev`** de Supabase (`DB_SCHEMA=dev`), sin tocar `public` (producción), siguiendo la misma estrategia aditiva ya usada en `migrate_tareas_solicitudes.py` (ver `../2026-07-tareas-solicitudes/`).

## Cambios de base de datos

**Tabla nueva** `tipos_solicitud`:
```sql
CREATE TABLE IF NOT EXISTS tipos_solicitud (
    id     SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE
);
```
Seed: `Grupo`, `Centro`, `Administración`, `Externos`.

**Columna nueva** en `solicitudes`: `tipo_solicitud_id INT NOT NULL REFERENCES tipos_solicitud(id)`.

**Backfill**: filas existentes con `creado_por_grupo_id`/`creado_por_centro_id` se clasifican directo; las que tienen ambos en NULL se revisan contra `solicitud_log` (evento `'creada'`, columna `rol`) y si no hay log se asumen `Administración` (único camino histórico posible).

**Script**: `backend/migrate_tipos_solicitud.py`, mismo estilo que `migrate_tareas_solicitudes.py` (aditivo, idempotente).

## Backend (`backend/app/routes/solicitudes.py`)

- Helper `_tipo_solicitud_id(cur, nombre)`.
- `crear_solicitud()`: resuelve el tipo automáticamente (`Grupo` si hay `grupo_id`, `Centro` si hay `centro_id`, `Administración` si el rol es `admin`, si no `Externos`).
- `_select_base()` / `_row_to_dict()`: exponen `tipo_solicitud` en cada solicitud devuelta por la API.
- De paso se corrigió el CASE de `origen.tipo` (antes caía en `'centro'` por defecto cuando ambos IDs eran NULL, mostrando un centro fantasma con nombre vacío).
- Sin endpoint de catálogo nuevo ni cambios en filtros de query — el filtrado por tipo se hace en el cliente, igual que ya hacía `ModuloSolicitudesAprobadas.jsx` con `filtroOrigen`.

## Frontend

- `ModuloSolicitudes.jsx`: fila de botones de filtro por tipo (`TIPOS_SOLICITUD`), visible solo para admin/coordinador.
- `ModuloSolicitudesAprobadas.jsx`: filtro por tipo junto al filtro por origen existente (ambos combinables).
- Badge de origen en las tarjetas: si no hay grupo/centro asociado, muestra el `tipo_solicitud` (Administración/Externos) en vez de un centro vacío.
- No se tocó `client.js` ni `VistaCentro.jsx`.

## Verificación realizada

Ver detalle en `todo.md`. Resumen: migración corrida dos veces contra `dev` (segunda vez 100% idempotente), backfill sin filas nulas (10 Grupo / 3 Centro / 26 Administración / 0 Externos — esperado, ningún flujo de UI genera Externos hoy), creación de solicitud de prueba como admin/grupo/centro verificada vía API con tokens JWT firmados localmente (sin exponer contraseñas reales), build de frontend limpio, datos de prueba eliminados al terminar.

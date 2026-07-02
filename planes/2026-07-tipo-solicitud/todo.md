# TODO — Clasificación normalizada de Solicitudes

> Ver plan completo en `plan.md` de esta misma carpeta. Rama: `dev`, esquema BD: `dev`.

## Base de datos
- [x] Tabla `tipos_solicitud` (id, nombre) + seed (Grupo, Centro, Administración, Externos)
- [x] Columna `solicitudes.tipo_solicitud_id` (FK, NOT NULL tras backfill)
- [x] Script `backend/migrate_tipos_solicitud.py` (aditivo, idempotente)
- [x] Backfill de solicitudes existentes (usando `solicitud_log` para las que tienen grupo/centro en NULL)
- [x] Actualizar `backend/app/schema_supabase.sql` con la tabla y columna nuevas
- [x] Ejecutar migración contra `dev` y confirmar 0 filas con `tipo_solicitud_id` NULL
- [x] Re-ejecutar la migración una segunda vez para confirmar idempotencia

## Backend
- [x] Helper `_tipo_solicitud_id()` en `solicitudes.py`
- [x] Asignación automática del tipo en `crear_solicitud()` según quién crea (grupo/centro/admin/otro)
- [x] Exponer `tipo_solicitud` en `_select_base()` / `_row_to_dict()`
- [x] Corregir el CASE de `origen.tipo` para que no muestre un centro falso cuando ambos IDs son NULL
- [x] Probar `POST /api/solicitudes` como admin, grupo y centro contra `dev` (vía JWT firmados localmente, sin usar contraseñas reales) y confirmar el `tipo_solicitud` correcto en cada caso
- [x] Confirmar que `GET /api/solicitudes` y `GET /api/solicitudes/aprobadas` devuelven `tipo_solicitud`

## Frontend
- [x] `ModuloSolicitudes.jsx`: filtro por tipo (solo admin/coordinador)
- [x] `ModuloSolicitudesAprobadas.jsx`: filtro por tipo combinado con el filtro de origen existente
- [x] Badge de origen: fallback a `tipo_solicitud` cuando no hay grupo/centro asociado
- [x] `npm run build` sin errores

## Cierre
- [x] Eliminar las 3 solicitudes de prueba creadas en `dev` durante la verificación
- [x] Commit y push a `dev` (hecho por el usuario vía mobile)
- [ ] Incluir esta migración en el checklist de despliegue a producción (ver `../2026-07-tareas-solicitudes/todo.md`, sección "Despliegue a Producción") antes de mergear `dev` → `main`

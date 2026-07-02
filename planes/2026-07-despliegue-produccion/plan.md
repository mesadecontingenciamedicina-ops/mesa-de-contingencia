# Plan: Despliegue a Producción (consolidado)

> Estado: **Planeado, sin ejecutar.** No se ha corrido ninguna migración contra `public` ni se ha hecho merge a `main`. Este documento organiza el despliegue; la ejecución es un paso aparte y deliberado.

## Contexto

`dev` lleva divergiendo de `main` desde `a39ae15` (separación de Tareas y Solicitudes) a través de varias sesiones de trabajo. Se acumularon **5 iniciativas** encadenadas, cada una construida sobre la anterior, todas ya implementadas y (salvo la última) probadas en el esquema `dev` de Supabase. Nunca se tocó `public` (producción) en ninguna de ellas — se siguió siempre la misma estrategia aditiva: tablas/columnas nuevas, nada se borra ni se rompe.

Este plan consolida el despliegue de las 5 en un solo evento, en vez de desplegar iniciativa por iniciativa, porque están en la misma rama `dev` y dependen unas de otras en el código (ej. Solicitudes Aprobadas ya asume que existe `tipo_solicitud`).

## Qué se va a desplegar

| # | Iniciativa | Carpeta | Cambios de BD | Probada en `dev` |
|---|---|---|---|---|
| 1 | Separar Tareas y Solicitudes (reemplaza Actividades) | [`../2026-07-tareas-solicitudes/`](../2026-07-tareas-solicitudes/) | Sí — tablas nuevas + columnas nuevas en `solicitudes` | Sí (E2E con Playwright) |
| 2 | Clasificación por tipo de solicitud (Grupo/Centro/Administración/Externos) | [`../2026-07-tipo-solicitud/`](../2026-07-tipo-solicitud/) | Sí — tabla `tipos_solicitud` + columna | Sí |
| 3 | Rediseño de Solicitudes Aprobadas (sin modal, bloquear/desbloquear) | [`../2026-07-cambio-vista-solicitudes-aprobadas/`](../2026-07-cambio-vista-solicitudes-aprobadas/) | No | Sí |
| 4 | Mensaje general al resolver + historial visible | [`../2026-07-mensaje-general-resolucion/`](../2026-07-mensaje-general-resolucion/) | No (reutiliza `solicitud_log`) | Sí |
| 5 | Mejoras a VistaCentro (autocompletar contacto, ítems visibles, notificaciones) | [`../2026-07-mejoras-vista-centro/`](../2026-07-mejoras-vista-centro/) | No (reutiliza `notificaciones.para_grupo_id`) | **No — pendiente, el usuario la prueba directamente** |

**Punto de atención antes de arrancar**: la iniciativa #5 fue implementada pero no probada en navegador por el agente (a pedido explícito). No debería incluirse en el despliegue a producción hasta que el usuario confirme que la validó en `dev`.

## Migraciones de base de datos requeridas contra `public`

Solo dos de las cinco iniciativas tocan el esquema. Ambos scripts son aditivos e idempotentes (se pueden re-ejecutar sin duplicar nada — cada paso se salta si ya existe):

1. `backend/migrate_tareas_solicitudes.py` — crea `tareas`, `tarea_miembros`, `tarea_comentarios`, `solicitud_item_aportes`, `solicitud_log`; agrega columnas de flujo de aprobación a `solicitudes`; migra datos históricos de `actividades` → `tareas`.
2. `backend/migrate_tipos_solicitud.py` — crea `tipos_solicitud` (seed Grupo/Centro/Administración/Externos) y columna `solicitudes.tipo_solicitud_id`; hace backfill de las filas existentes.

**Deben correr en ese orden** (el segundo asume que `solicitud_log` ya existe, porque su backfill lo consulta para las filas históricas con ambos `creado_por_*` en NULL).

Ninguna otra iniciativa requiere `ALTER TABLE` ni tablas nuevas.

## Cambios de código a tener en cuenta

- `backend/app/routes/actividades.py` fue **eliminado** en `dev` (reemplazado por `tareas.py`). Tras el deploy, los endpoints viejos `/api/actividades*` dejan de existir. El frontend ya está migrado por completo a `/api/tareas`, así que no hay nada que dependa de la ruta vieja.
- Las tablas viejas `actividades`, `actividad_miembros`, `actividad_comentarios` **no se tocan ni se borran** en esta migración — quedan huérfanas pero inertes en `public`, igual que ya quedaron en `dev`. Su limpieza es una decisión aparte, ya explícitamente diferida (ver `../2026-07-tareas-solicitudes/todo.md`).

## Orden de ejecución recomendado

1. **Backup** de la base `public` (Supabase → Database → Backups, o `pg_dump`).
2. Correr `migrate_tareas_solicitudes.py` contra `public` (`DB_SCHEMA=public`).
3. Correr `migrate_tipos_solicitud.py` contra `public` (`DB_SCHEMA=public`).
4. Verificar los datos migrados (conteos, muestra manual — ver `todo.md`).
5. Merge `dev` → `main`.
6. Deploy backend (Railway): confirmar variables de entorno, esperar el deploy, probar `/api/health`.
7. Deploy frontend (Vercel): confirmar variables de entorno de Production (nunca `DB_SCHEMA=dev`), esperar el deploy.
8. Validación end-to-end en producción, una iniciativa a la vez (ver `todo.md`).
9. Avisar al equipo del cambio de flujo.

## Plan de rollback

- Como toda la migración de BD es aditiva (nunca hay `DROP`/`ALTER ... DROP COLUMN`), revertir el **código** (redeploy de la versión anterior en Railway/Vercel) deja la aplicación funcionando exactamente como antes, sin pérdida de datos — las tablas/columnas nuevas quedan sin usar pero no rompen nada.
- Si una migración falla a mitad de camino, ambos scripts son seguros de re-ejecutar (cada paso hace `try/except` con commit/rollback individual e imprime `OK`/`SKIP`).
- No hay ningún paso destructivo en todo el plan — el peor caso es quedar con tablas nuevas vacías/parciales en `public`, que no afectan el funcionamiento del código viejo si se revierte el deploy.

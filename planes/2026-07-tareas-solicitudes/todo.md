# TODO — Separación de Tareas y Solicitudes

> Ver plan completo en `plan.md` (misma carpeta). Rama: `dev`.
> Regla: al terminar cada Fase, me detengo para que revises antes de seguir con la siguiente.

## Fase 1 — Base de Datos y Modelado
- [x] Agregar a `schema_supabase.sql`: tablas `tareas`, `tarea_miembros`, `tarea_comentarios`
- [x] Agregar a `schema_supabase.sql`: tabla `solicitud_item_aportes`
- [x] Agregar a `schema_supabase.sql`: tabla `solicitud_log`
- [x] Agregar a `schema_supabase.sql`: columnas nuevas en `solicitudes` (estado, receptor_nombre, receptor_telefono, reclamado_por_grupo_id, reclamado_en, aprobado_por_username, aprobado_en, rechazo_motivo) + constraint de estado
- [x] Agregar a `schema_supabase.sql`: columna `cantidad_flexible` en `solicitud_items`
- [x] Agregar a `schema_supabase.sql`: `tarea_id` (renombrado) + `solicitud_id` en `notificaciones`
- [x] Script `backend/migrate_tareas_solicitudes.py`: crear tablas/columnas nuevas de forma aditiva (sin tocar tablas viejas)
- [x] Script de migración de datos: copiar `actividades` → `tareas` (con datos heredados de su solicitud), `actividad_miembros` → `tarea_miembros`, `actividad_comentarios` → `tarea_comentarios`
- [x] Script de migración de datos: poner todas las `solicitudes` existentes en estado `Pendiente`
- [x] Ejecutar migración contra la BD real y validar con `check_db.py` o consultas manuales

## Fase 2 — Backend
- [x] Nuevo `backend/app/routes/tareas.py` (GET/POST /api/tareas, PUT estado, PUT miembros, DELETE soft-delete)
- [x] Mover/adaptar comentarios de actividad → `tarea_comentarios` en `comentarios.py`
- [x] Actualizar `notificaciones` (routes) para usar `tarea_id` y nuevo `solicitud_id`
- [x] Reescribir `backend/app/routes/solicitudes.py`: estado inicial `Pendiente`, campos receptor, `cantidad_flexible` en items
- [x] Nuevas rutas: `PUT /api/solicitudes/:id/aprobar`, `PUT /api/solicitudes/:id/rechazar` (motivo obligatorio)
- [x] Nuevas rutas: `GET /api/solicitudes/aprobadas`, `PUT /api/solicitudes/:id/reclamar`, `PUT /api/solicitudes/:id/liberar`, `PUT /api/solicitudes/:id/marcar-resuelta`
- [x] Bloquear edición (`PUT /api/solicitudes/:id`) cuando está reclamada (409)
- [x] Registrar eventos en `solicitud_log` en cada transición de estado
- [x] Quitar `POST /api/actividades/rapida` y el blueprint viejo de `actividades.py` (dejar comentado o eliminar según se decida en revisión)
- [x] Probar endpoints nuevos con curl/Postman antes de tocar frontend

## Fase 3 — Frontend: Tareas y Solicitudes
- [x] Renombrar `ModuloActividades.jsx` → `ModuloTareas.jsx`, quitar cualquier UI de ítems, conectar a `/api/tareas`
- [x] Botón "Nueva tarea": admin/coordinador elige grupo, grupo se autoasigna
- [x] Actualizar `ModuloSolicitudes.jsx`: campos receptor_nombre/receptor_telefono, checkbox "cualquier cantidad" por ítem
- [x] Vista grupo/centro: lista de solicitudes propias con estado, edición habilitada solo si Pendiente/Rechazada
- [x] Vista admin/coordinador: filtro por estado + botones Aprobar/Rechazar (motivo obligatorio en modal)
- [x] Actualizar `client.js` con los nuevos métodos de API

## Fase 4 — Frontend: Solicitudes Aprobadas
- [x] Nuevo `ModuloSolicitudesAprobadas.jsx`: tablero de solicitudes `Aprobada`, filtros por centro/grupo
- [x] Indicador "En Proceso" + grupo que reclamó, solo lectura para los demás
- [x] Modal/acordeón: reclamar, aportar cantidad + comentario por ítem, liberar / marcar resuelta
- [x] Actualizar navegación en `App.jsx` (agregar tab, quitar referencias viejas a Actividades donde corresponda)
- [x] Ajustar `VistaCentro.jsx` con los campos nuevos del formulario de solicitud

## Fase 5 — Pruebas y Despliegue
- [x] Prueba E2E en dev: Grupo A crea solicitud → Coordinador aprueba → Grupo B reclama y aporta parcial → libera → Grupo B reclama de nuevo y marca Resuelta (verificado con `requests` + Playwright real en navegador)
- [x] Prueba E2E en dev: creación y ciclo de vida completo de una Tarea (creación, cambio de estado, permisos, miembros, comentarios, archivar)
- [x] Prueba: rechazo con motivo obligatorio (400 sin motivo) + reenvío de solicitud rechazada (vuelve a Pendiente)
- [x] Limpieza de datos de prueba creados durante la verificación en `dev` (4 tareas + 4 solicitudes de prueba eliminadas; se confirmó que no se tocó ningún dato real)
- [x] Revisar que `contexto.md` quede actualizado con el nuevo modelo
- [ ] Confirmar plan de limpieza de tablas viejas (`actividades`, `actividad_miembros`, `actividad_comentarios`) antes de eliminarlas — **pendiente, se dejan por ahora** (hay uso real activo en `dev`, se decide más adelante)
- [ ] Despliegue a producción (ver checklist detallado abajo)

### Checklist detallado — Despliegue a Producción

> ⚠️ **Superado por `../2026-07-despliegue-produccion/todo.md`.** Se acumularon más iniciativas sobre `dev` después de escribir esto (tipo de solicitud, rediseño de Solicitudes Aprobadas, mensaje general, VistaCentro), así que el checklist de despliegue vivo y actualizado es el de esa carpeta — este queda solo como el borrador original.

**1. Base de datos (`public`, producción)**
- [ ] Hacer un respaldo/export de la base `public` antes de tocar nada (Supabase → Database → Backups, o `pg_dump`)
- [ ] Ejecutar `backend/migrate_tareas_solicitudes.py` contra `public` (con `DB_SCHEMA=public`, es aditivo — no toca `actividades` ni nada existente)
- [ ] Verificar migración de datos: contar `tareas` migradas vs `actividades` originales, y confirmar que todas las `solicitudes` quedaron en `Pendiente`
- [ ] Revisar manualmente 2-3 tareas migradas al azar para confirmar que heredaron bien descripción/ubicación/miembros/comentarios de su solicitud de origen

**2. Backend (Railway)**
- [ ] Confirmar que Railway despliega desde la rama `main` (o la que corresponda) — hacer merge de `dev` → `main` cuando esté todo aprobado
- [ ] Verificar variables de entorno de Railway: `DATABASE_URL`, `DB_SCHEMA` (debe quedar en `public` o sin setear, nunca `dev`), `JWT_SECRET`
- [ ] Tras el deploy, probar `GET /api/health` y un login real contra producción

**3. Frontend + proxy serverless (Vercel)**
- [ ] Verificar variables de entorno de Vercel para el ambiente **Production**: sin `DB_SCHEMA=dev` (debe usar `public` por defecto)
- [ ] Si se dejó `DB_SCHEMA=dev` en Preview para probar la rama `dev`, confirmar que ese scope NO aplica a Production
- [ ] Deploy de `main` a producción (automático si Vercel está conectado al repo, o manual)

**4. Validación post-deploy**
- [ ] Login como admin, grupo y centro real en producción — confirmar que todo carga sin errores de consola
- [ ] Verificar que las solicitudes/tareas migradas se ven correctamente (datos reales, no de prueba)
- [ ] Probar el flujo completo una vez en producción con una solicitud real de bajo riesgo: crear → aprobar → reclamar → resolver
- [ ] Confirmar que las notificaciones llegan correctamente (comentario de tarea, aprobar/rechazar/resolver solicitud)
- [ ] Avisar al equipo del cambio de flujo (Tareas y Solicitudes ya no están acopladas — ver `contexto.md` actualizado)

**5. Plan de rollback (por si algo sale mal)**
- [ ] Como la migración es aditiva y no borra `actividades`/columnas viejas, revertir el código (deploy de la versión anterior en Railway/Vercel) deja la app funcionando como antes sin pérdida de datos
- [ ] Las tablas nuevas (`tareas`, `solicitud_log`, etc.) quedarían huérfanas pero inertes — no rompen nada si se revierte el código

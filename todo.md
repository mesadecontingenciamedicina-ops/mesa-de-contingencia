# TODO — Separación de Tareas y Solicitudes

> Ver plan completo en `plan-tareas-solicitudes.md`. Rama: `dev`.
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
- [ ] Nuevo `ModuloSolicitudesAprobadas.jsx`: tablero de solicitudes `Aprobada`, filtros por centro/grupo
- [ ] Indicador "En Proceso" + grupo que reclamó, solo lectura para los demás
- [ ] Modal/acordeón: reclamar, aportar cantidad + comentario por ítem, liberar / marcar resuelta
- [ ] Actualizar navegación en `App.jsx` (agregar tab, quitar referencias viejas a Actividades donde corresponda)
- [ ] Ajustar `VistaCentro.jsx` con los campos nuevos del formulario de solicitud

## Fase 5 — Pruebas y Despliegue
- [ ] Prueba E2E en dev: Grupo A crea solicitud → Coordinador aprueba → Grupo B reclama y aporta parcial → Grupo C completa y libera → Resuelta
- [ ] Prueba E2E en dev: creación y ciclo de vida completo de una Tarea (creación, cambio de estado, miembros, comentarios, archivar)
- [ ] Prueba: rechazo con motivo obligatorio + reenvío de solicitud rechazada
- [ ] Revisar que `contexto.md` quede actualizado con el nuevo modelo
- [ ] Confirmar plan de limpieza de tablas viejas (`actividades`, etc.) antes de eliminarlas
- [ ] Migración a producción + deploy

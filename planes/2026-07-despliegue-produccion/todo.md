# TODO — Despliegue a Producción (consolidado)

> Ver plan completo en `plan.md` de esta misma carpeta. **Nada de esto se ha ejecutado todavía.**
> Reemplaza/consolida el checklist de despliegue que había quedado en `../2026-07-tareas-solicitudes/todo.md` — ese sigue ahí como registro histórico, pero desde ahora el checklist vivo es este.

## 0. Antes de arrancar

- [ ] Confirmar que la iniciativa `../2026-07-mejoras-vista-centro/` fue probada y validada por el usuario en `dev` (el agente no la probó en navegador a pedido explícito). Si aún no se probó, decidir si se despliega junto con las otras 4 o se difiere.
- [ ] Confirmar que no queda trabajo sin commitear en `dev` (`git status` limpio).
- [ ] Confirmar quién tiene acceso/credenciales para: Supabase (BD `public`), Railway (backend), Vercel (frontend).

## 1. Base de datos (`public`, producción)

- [ ] Backup/export de la base `public` (Supabase → Database → Backups, o `pg_dump`)
- [ ] Ejecutar `DB_SCHEMA=public python backend/migrate_tareas_solicitudes.py`
- [ ] Ejecutar `DB_SCHEMA=public python backend/migrate_tipos_solicitud.py` (después del anterior, no antes — su backfill depende de `solicitud_log`)
- [ ] Verificar migración de datos: contar `tareas` migradas vs `actividades` originales, y confirmar que todas las `solicitudes` quedaron en `Pendiente` (comportamiento esperado y ya documentado — es intencional que trabajo ya resuelto como Actividad reaparezca como Solicitud Pendiente)
- [ ] Revisar manualmente 2-3 tareas migradas al azar para confirmar que heredaron bien descripción/ubicación/miembros/comentarios de su solicitud de origen
- [ ] Verificar que `tipos_solicitud` quedó con las 4 filas (Grupo/Centro/Administración/Externos) y que ninguna `solicitud` quedó con `tipo_solicitud_id` NULL

## 2. Backend (Railway)

- [ ] Confirmar que Railway despliega desde la rama `main` — hacer merge de `dev` → `main` cuando el punto 1 esté validado
- [ ] Verificar variables de entorno de Railway: `DATABASE_URL`, `DB_SCHEMA` (debe quedar en `public` o sin setear — **nunca `dev`**), `JWT_SECRET`
- [ ] Tras el deploy, probar `GET /api/health` y un login real contra producción

## 3. Frontend + proxy serverless (Vercel)

- [ ] Verificar variables de entorno de Vercel para el ambiente **Production**: sin `DB_SCHEMA=dev`
- [ ] Si se dejó `DB_SCHEMA=dev` en algún ambiente de Preview, confirmar que ese scope no aplica a Production
- [ ] Deploy de `main` a producción

## 4. Validación post-deploy — por iniciativa

**Tareas y Solicitudes (separación)**
- [ ] Login como admin, grupo y centro real — todo carga sin errores de consola
- [ ] Las tareas/solicitudes migradas se ven correctamente (datos reales, no de prueba)
- [ ] Flujo completo con una solicitud real de bajo riesgo: crear → aprobar → bloquear → resolver

**Tipo de Solicitud**
- [ ] Los filtros por tipo (Grupo/Centro/Administración/Externos) funcionan en Solicitudes y Solicitudes Aprobadas
- [ ] Una solicitud creada por admin directamente queda como "Administración" (no muestra badge de centro fantasma)

**Solicitudes Aprobadas (rediseño)**
- [ ] Bloquear/desbloquear una solicitud aprobada funciona inline, sin modal
- [ ] "Terminar y guardar" y "Resolver y guardar" guardan aportes correctamente

**Mensaje general + historial**
- [ ] El mensaje libre al resolver queda guardado y visible en "Ver historial"
- [ ] La notificación al creador incluye el mensaje

**VistaCentro** *(solo si se incluyó en este despliegue — ver punto 0)*
- [ ] El botón "Usar datos de contacto del centro" rellena receptor/teléfono
- [ ] La tarjeta de solicitud muestra la lista de ítems
- [ ] La campanita de notificaciones aparece y se actualiza para un centro real al cambiar el estado de su solicitud

**General**
- [ ] Confirmar que las notificaciones llegan correctamente (comentarios de tarea, aprobar/rechazar/resolver solicitud, y ahora también a centros)
- [ ] Avisar al equipo del cambio de flujo (Tareas y Solicitudes ya no están acopladas — ver `contexto.md`)

## 5. Plan de rollback (si algo sale mal)

- [ ] Confirmado: revertir el deploy de código (Railway/Vercel a la versión anterior) es seguro — la migración es aditiva, no borra nada
- [ ] Las tablas nuevas (`tareas`, `tipos_solicitud`, `solicitud_log`, etc.) quedarían huérfanas pero inertes si se revierte el código — no rompen nada

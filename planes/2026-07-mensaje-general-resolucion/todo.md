# TODO — Mensaje general al resolver una solicitud

> Ver plan completo en `plan.md` de esta misma carpeta. Rama: `dev`, esquema BD: `dev`. Sin cambios de esquema (se reutiliza `solicitud_log.detalle`, ya existente).

## Backend
- [x] `_detalle_con_mensaje()` helper para concatenar el resumen autogenerado + mensaje libre
- [x] `PUT /solicitudes/:id/liberar` acepta `mensaje` opcional, lo guarda en el log y en la notificación
- [x] `PUT /solicitudes/:id/marcar-resuelta` acepta `mensaje` opcional, lo guarda en el log y en la notificación
- [x] Nuevo `GET /solicitudes/:id/historial` con control de acceso (privilegiado, grupo dueño o cualquier grupo si Aprobada/Resuelta, centro dueño)

## Frontend
- [x] `client.js`: `liberarSolicitud`/`marcarResueltaSolicitud` mandan `mensaje`; `getHistorialSolicitud(id)` nuevo
- [x] `ModuloSolicitudesAprobadas.jsx`: textarea de mensaje general antes de los botones de cierre
- [x] `ModuloSolicitudesAprobadas.jsx`: botón "Ver historial" por tarjeta, fetch on-demand
- [x] `ModuloSolicitudes.jsx`: historial se carga y muestra en el modal de detalle existente
- [x] `VistaCentro.jsx`: historial se carga y muestra en el modal de detalle existente
- [x] `npm run build` sin errores

## Verificación
- [x] Mensaje guardado correctamente en `solicitud_log` vía "Terminar y guardar" (liberar)
- [x] Mensaje guardado correctamente vía "Resolver y guardar" (marcar-resuelta)
- [x] Notificación al creador incluye el mensaje
- [x] Historial visible tanto para el grupo que resolvió como para el grupo/centro creador
- [x] Historial visible en el modal de `ModuloSolicitudes.jsx` (confirmado por contenido, ya que queda bajo el scroll interno del modal)
- [x] `console --errors` limpio
- [x] Datos de prueba eliminados de `dev`
- [ ] Revisar visualmente en el navegador propio antes de dar por cerrado
- [ ] Incluir en el checklist de despliegue a producción antes de mergear `dev` → `main`

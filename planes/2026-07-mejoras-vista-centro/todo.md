# TODO — Mejoras a VistaCentro

> Ver plan completo en `plan.md` de esta misma carpeta. Rama: `dev`. Sin cambios de esquema.

## Backend
- [x] `GET /api/centros/mis-contactos` (rol centro)
- [x] `_notificar_creador()` notifica también a centros (reutiliza `para_grupo_id` para `centro_id` cuando `para_rol='centro'`)
- [x] `GET /api/notificaciones` y `POST /api/notificaciones/leer-todas` soportan rol `centro`
- [x] Sintaxis verificada (`ast.parse`) y `app.url_map` sin conflictos de rutas

## Frontend
- [x] `client.js`: `getMisContactos()`
- [x] `VistaCentro.jsx`: `<PanelNotificaciones />` en el header
- [x] `VistaCentro.jsx`: botón "Usar datos de contacto del centro" en formulario de creación
- [x] `VistaCentro.jsx`: mismo botón en formulario de edición
- [x] `VistaCentro.jsx`: tarjeta de solicitud muestra lista de ítems (no solo el conteo)
- [x] `npm run build` sin errores

## Verificación
- [ ] **Pendiente — la hace el usuario al probar tras el push** (no se levantaron servidores ni se corrió Playwright en esta iteración, por pedido explícito)
- [ ] Confirmar visualmente que el botón de autocompletar funciona con centros que tienen 1 y con centros que tienen 0 contactos
- [ ] Confirmar que la campanita aparece y se actualiza para un centro tras aprobar/rechazar/resolver una de sus solicitudes
- [ ] Confirmar que la lista de ítems se ve bien en la tarjeta con solicitudes de 1, varios, y cero ítems
- [ ] Incluir en el checklist de despliegue a producción antes de mergear `dev` → `main`

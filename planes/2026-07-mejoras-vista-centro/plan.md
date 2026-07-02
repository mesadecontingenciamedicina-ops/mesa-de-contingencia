# Plan: Mejoras a VistaCentro (autocompletar receptor, ítems visibles, notificaciones)

> Estado: **Implementado en `dev`, sin probar por el agente** — el usuario pidió explícitamente probarlo él mismo al hacer push, no se levantaron servidores ni se corrió Playwright en esta iteración.

## Contexto

Tres pedidos sobre la interfaz de `VistaCentro.jsx` (rol `centro`, ver captura de referencia adjunta al pedido):

1. Un botón para rellenar "Nombre de quien recibe" / "Teléfono de quien recibe" con los datos de un contacto asociado al centro.
2. Que la tarjeta de una solicitud (en "Mis Solicitudes") muestre la lista de ítems, no solo la cantidad ("📦 2 ítems").
3. Que los centros (hospitales) vean la campanita de notificaciones cuando hay un cambio en su solicitud — **preguntando explícitamente si era posible sin tocar el esquema de BD**.

## Factibilidad de cada punto (confirmado antes de codear, verbalmente en el chat)

1. **Autocompletar receptor**: la tabla `centro_contactos` (id, centro_id, nombre, cargo, telefono, email) ya existe, pero el rol `centro` no tenía ningún endpoint para leer sus propios contactos (`GET /api/centros` es admin-only). Solo hacía falta un endpoint nuevo de solo lectura, sin tocar el esquema.
2. **Lista de ítems en la tarjeta**: dato que ya viaja en la respuesta de `GET /api/solicitudes/mis-centro` (`s.items`), solo no se renderizaba. Cambio puramente de frontend.
3. **Notificaciones para centros**: la tabla `notificaciones` no tiene columna `para_centro_id`, y `para_rol` solo admitía `'admin'`/`'grupo'`. Pero `para_grupo_id` **no tiene FK real** (columna `INT` simple, sin `REFERENCES`), y cada consulta sobre esa tabla ya filtra siempre por `(para_rol, para_grupo_id)` juntos — nunca por el id solo. Eso permite reutilizar `para_grupo_id` para guardar el `centro_id` cuando `para_rol = 'centro'`, sin ambigüedad (a diferencia de la propuesta de "id de creador genérico" que se descartó para `solicitudes` — ver `../2026-07-tipo-solicitud/plan.md` — porque ahí no todas las queries iban emparejadas con el discriminador de tipo; acá sí, siempre). **Factible sin migración.**

## Cambios de backend

- `centros.py`: nuevo `GET /api/centros/mis-contactos` (rol `centro`), reutiliza el helper `_get_contactos()` ya existente.
- `solicitudes.py`: `_notificar_creador()` ahora también inserta una notificación `para_rol='centro'` (reutilizando `para_grupo_id` para el `centro_id`) cuando la solicitud la creó un centro. Se dispara en los mismos eventos que ya notificaban a grupos: aprobar, rechazar, liberar (parcial/total), marcar-resuelta.
- `comentarios.py`: `GET /api/notificaciones` y `POST /api/notificaciones/leer-todas` agregan una rama explícita para `rol == 'centro'`, filtrando por `para_rol='centro' AND para_grupo_id = user.centro_id`.

## Cambios de frontend (`VistaCentro.jsx`)

- Import de `PanelNotificaciones` (componente ya existente, reutilizado tal cual — solo llama a `api.getNotificaciones()`/`marcarLeida`/`leerTodas`, agnóstico de rol) en el header, junto al botón "Cambiar Contraseña". `onNotifClick` abre el modal de detalle de la solicitud referenciada si está en la lista cargada.
- Botón "📇 Usar datos de contacto del centro" en el formulario de "Nueva Solicitud" y en el de "Editar solicitud", que llama a `GET /api/centros/mis-contactos` y usa el primer contacto devuelto para rellenar `receptor_nombre`/`receptor_telefono`. Si no hay contactos registrados, muestra un mensaje de error en vez de fallar silenciosamente.
- La tarjeta de cada solicitud en la lista ahora muestra `📦 Ítems: Nombre (cantidad), ...` en vez de solo el conteo.
- `client.js`: nuevo `getMisContactos()`.

## Verificación pendiente (la hace el usuario)

- `python3 -c "import ast; ..."` sobre los tres archivos backend tocados: sin errores de sintaxis.
- `npm run build`: sin errores.
- `app.url_map`: confirmado que `/api/centros/mis-contactos` se registra sin chocar con rutas existentes.
- **No se probó en navegador ni se ejecutaron flujos end-to-end** — el usuario probará directamente al hacer push, según pidió explícitamente.

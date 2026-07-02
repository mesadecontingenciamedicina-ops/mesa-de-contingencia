# Plan: Mensaje general al resolver una solicitud (parcial o completa)

> Estado: **Implementado y verificado en `dev`** (2026-07-02). Ver `todo.md` en esta misma carpeta.

## Contexto

Al resolver una solicitud (parcial vía "Terminar y guardar" o completa vía "Resolver y guardar"), cada ítem ya admite un comentario individual (`solicitud_item_aportes.comentario`). Faltaba un mensaje libre **general** para la resolución en sí — no atado a un ítem en particular — para explicar cosas como "se coordinó la entrega con tal persona" o "no se consiguió el resto a tiempo".

**Pregunta del usuario antes de implementar**: ¿es factible sin tocar el esquema de BD?

**Respuesta**: sí. La tabla `solicitud_log` (creada en el cambio de Tareas/Solicitudes) ya tiene una columna `detalle TEXT` libre, usada hasta ahora solo para un resumen autogenerado ("2 ítem(s) aportado(s)"). Como es una tabla *append-only* (una fila por evento), sirve perfecto para guardar el mensaje de cada resolución sin perder el historial de resoluciones parciales anteriores. No hizo falta ninguna tabla ni columna nueva.

Lo único que sí requería una decisión de alcance (no de BD) era **dónde se ve** el mensaje después de guardado, porque `solicitud_log` era una tabla de solo-escritura (nada la leía de vuelta). Se decidió: notificación al creador + historial visible para cualquiera con acceso a la solicitud.

## Cambios de backend (`solicitudes.py`)

- `PUT /solicitudes/:id/liberar` y `PUT /solicitudes/:id/marcar-resuelta` aceptan ahora un campo opcional `mensaje` en el body.
- El mensaje se concatena al `detalle` autogenerado de `solicitud_log` (helper `_detalle_con_mensaje`), y se agrega al texto de la notificación que ya se le manda al creador (truncado a 200 caracteres).
- Nuevo endpoint `GET /solicitudes/:id/historial`: devuelve todas las filas de `solicitud_log` de esa solicitud (evento, usuario, rol, detalle, fecha), ordenadas cronológicamente. Control de acceso: privilegiados ven cualquiera; un grupo ve las suyas propias o cualquier `Aprobada`/`Resuelta` (mismo criterio que ya rige el tablero colaborativo); un centro solo ve las suyas.

## Cambios de frontend

- `client.js`: `liberarSolicitud`/`marcarResueltaSolicitud` ahora mandan `mensaje`; nuevo `getHistorialSolicitud(id)`.
- `ModuloSolicitudesAprobadas.jsx`: textarea "Mensaje general de esta resolución (opcional)" justo antes de los botones "Terminar y guardar"/"Resolver y guardar" (solo si la solicitud está bloqueada por el propio grupo). Botón "🕘 Ver historial" por tarjeta (fetch on-demand, no se precarga para todas las tarjetas a la vez).
- `ModuloSolicitudes.jsx` y `VistaCentro.jsx`: el modal de detalle (que ya existía en ambos, a diferencia de Aprobadas) ahora carga el historial automáticamente al abrirse y lo muestra al final, para que el creador (grupo o centro) vea cómo se resolvió su propia solicitud.

## Verificación realizada

Contra `dev`, combinando Playwright (UI) y llamadas directas a la API (para no depender de capturas de un modal con scroll interno, donde Playwright no expande el overflow):
1. Bloqueo + aporte parcial + mensaje general ("Se coordinó con el chofer...") vía "Terminar y guardar" → confirmado en `solicitud_log` (evento `liberada`, detalle con el mensaje concatenado) y en la notificación al creador (texto incluye "Mensaje: ...").
2. Historial consultado como el grupo que resolvió y como el grupo creador → mismo resultado en ambos, confirma el control de acceso.
3. Vista del creador (`ModuloSolicitudes.jsx`): el modal de detalle muestra la sección "Historial" con el mensaje (confirmado vía `inner_text()`, ya que el contenido queda debajo del scroll interno del modal).
4. "Resolver y guardar" (`marcar-resuelta`) con mensaje, sin aportes → confirmado que el evento `resuelta` en el log incluye el mensaje.
5. `console --errors` limpio en todas las capturas. Build de frontend limpio.
6. Datos de prueba (1 solicitud + log + notificaciones) eliminados de `dev` al terminar.

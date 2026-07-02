# Plan: Rediseño de tarjetas en Solicitudes Aprobadas

> Estado: **Implementado y verificado en `dev`** (2026-07-02). Ver `todo.md` en esta misma carpeta.
> Referencia visual del pedido: `vista previa/image.png`.

## Contexto

El tablero de "Solicitudes Aprobadas" (`ModuloSolicitudesAprobadas.jsx`) mostraba tarjetas resumidas que, al hacer clic, abrían un modal con el detalle completo y las acciones de reclamar/aportar/liberar/marcar-resuelta. Se pidió aplanar esa interacción: que toda la información y las acciones vivan directamente en la tarjeta, sin modal.

Diseño pedido:
- Cabecera arriba a la izquierda con los datos primordiales de la solicitud.
- Arriba a la derecha, un botón **Bloquear** que se transforma en **Desbloquear** (y viceversa) según el estado de reclamo.
- Debajo, la lista de ítems/insumos de la solicitud.
- Al final, dos botones: **Terminar y guardar** y **Resolver y guardar**.

## Mapeo a las acciones existentes

El backend ya tenía tres endpoints (`reclamar`, `liberar`, `marcar-resuelta`); no hizo falta inventar nuevos verbos, solo remapear la UI:

| Botón nuevo | Acción | Endpoint |
|---|---|---|
| 🔒 Bloquear | Reclama la solicitud para el grupo | `PUT /solicitudes/:id/reclamar` (sin cambios) |
| 🔓 Desbloquear (arriba) | Guarda los aportes tipeados y libera el reclamo | `PUT /solicitudes/:id/liberar` — **misma acción** que "Terminar y guardar" |
| 💾 Terminar y guardar (abajo) | Guarda los aportes tipeados y libera el reclamo (auto-resuelve si quedó todo cubierto) | `PUT /solicitudes/:id/liberar` |
| ✅ Resolver y guardar (abajo) | Guarda los aportes tipeados **y fuerza el cierre**, sin soltar el reclamo a mitad de camino | `PUT /solicitudes/:id/marcar-resuelta` (extendido, ver abajo) |

**Decisión de diseño**: "Desbloquear" (arriba) hace exactamente lo mismo que "Terminar y guardar" (abajo) en vez de descartar lo tipeado — para no arriesgar que alguien llene cantidades y pierda el trabajo por tocar el botón de arriba en vez del de abajo. Es intencional que ambos boteen a la misma acción.

## Cambio de backend necesario

`PUT /api/solicitudes/:id/marcar-resuelta` antes forzaba el cierre sin guardar ningún aporte. Para que "Resolver y guardar" también persista lo tipeado, se le agregó un payload opcional `{ aportes: [...] }` (mismo formato que `/liberar`), usando el mismo helper de inserción (`_guardar_aportes`, extraído de la lógica que ya tenía `/liberar`). Esto evita un problema real: llamar primero a `/liberar` (que suelta el reclamo si no quedó todo cubierto) y luego a `/marcar-resuelta` fallaría con 409 porque el reclamo ya no sería tuyo — y en el tiempo entre medio, otro grupo podría reclamarla. Con el cambio, ambos pasos (guardar aporte + forzar cierre) son una sola llamada atómica, sin ventana de carrera.

`client.js`: `marcarResueltaSolicitud(id, aportes = [])` ahora manda el payload.

## Frontend

`ModuloSolicitudesAprobadas.jsx` reescrito: se eliminó el modal (`detalle`/`abrirDetalle`/`DetalleRow`). Cada tarjeta ahora es autosuficiente:
- Fila superior: `card-body` con badges/descripción/meta a la izquierda, botón Bloquear/Desbloquear a la derecha (solo si el usuario es de rol `grupo` y la solicitud está libre o bloqueada por su propio grupo).
- Tabla de ítems siempre visible (progreso); columnas de "Aportar ahora" y "Comentario" solo si la bloqueó tu propio grupo.
- Fila inferior con los dos botones de cierre, solo si la bloqueó tu propio grupo.
- El estado de los aportes tipeados pasó de ser un solo objeto (para el modal de una solicitud a la vez) a un objeto indexado por `solicitud_id → item_id → {cantidad, comentario}`, porque ahora varias tarjetas pueden estar bloqueadas por tu grupo simultáneamente.

## Verificación realizada

Con Playwright (Python) contra `dev`, sesión inyectada vía JWT firmado localmente (sin exponer contraseñas reales):
1. Tablero con 3 solicitudes de distintos tipos — capturas de la vista colapsada.
2. Bloqueo de una solicitud con ítems → aparecen "Desbloquear" arriba, inputs de aporte, y los dos botones de cierre abajo.
3. Se tipeó un aporte parcial (Guantes: 20) y "Terminar y guardar" → el progreso quedó en 20/50 (y 40/50 tras repetir, confirmando que los aportes son acumulativos) y la tarjeta volvió a "Disponible para bloquear".
4. Verificado por API (sin UI) que "Resolver y guardar" con un aporte parcial real deja el ítem con el aporte guardado (30/100) y el estado en `Resuelta` en una sola llamada, sin pasar por un estado intermedio "liberada".
5. `console --errors` sin errores en ninguna captura. Build de frontend limpio.
6. Datos de prueba (2 solicitudes + sus aportes/logs) eliminados de `dev` al terminar.

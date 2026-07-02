# TODO — Rediseño de tarjetas en Solicitudes Aprobadas

> Ver plan completo en `plan.md` de esta misma carpeta. Rama: `dev`, esquema BD: `dev`.

## Backend
- [x] Extraer `_guardar_aportes()` de `liberar_solicitud()` para reutilizarla
- [x] `marcar_resuelta_solicitud()` acepta `{ aportes: [...] }` opcional y los guarda antes de forzar `Resuelta`
- [x] `client.js`: `marcarResueltaSolicitud(id, aportes)` envía el payload

## Frontend
- [x] Quitar el modal de detalle (`detalle`/`abrirDetalle`/`DetalleRow`)
- [x] Tarjeta: cabecera (datos primordiales) a la izquierda, botón Bloquear/Desbloquear arriba a la derecha
- [x] Tarjeta: tabla de ítems siempre visible, columnas de aporte solo si la bloqueó el propio grupo
- [x] Tarjeta: botones "Terminar y guardar" y "Resolver y guardar" abajo, solo si la bloqueó el propio grupo
- [x] Estado de aportes tipeados indexado por solicitud (soporta varias tarjetas bloqueadas a la vez)
- [x] `npm run build` sin errores

## Verificación
- [x] Playwright contra `dev` (sesión vía JWT firmado localmente, sin exponer contraseñas): captura del tablero colapsado
- [x] Captura de una tarjeta bloqueada por el propio grupo (inputs + botones de cierre visibles)
- [x] "Terminar y guardar" con aporte parcial: progreso se actualiza, aportes acumulativos confirmados (20 → 40/50), tarjeta vuelve a "Disponible"
- [x] "Resolver y guardar" (vía API) con aporte parcial real: aporte queda guardado y estado pasa a `Resuelta` en una sola llamada, sin soltar el reclamo a mitad de camino
- [x] `console --errors` limpio en todas las capturas
- [x] Datos de prueba eliminados de `dev`
- [ ] Revisar visualmente en el navegador propio (no solo capturas) antes de dar por cerrado
- [ ] Incluir en el checklist de despliegue a producción antes de mergear `dev` → `main`

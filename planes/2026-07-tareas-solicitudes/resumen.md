# Resumen — Separación de Tareas y Solicitudes

> Basado en `plan.md` y `todo.md` (misma carpeta). Estado a 2026-07-02: implementación completa en `dev` (Fases 1-4 y la mayor parte de la 5), pendiente solo el despliegue a producción.

---

## 1. Qué cambió, en una frase

Antes, "Actividades" (el trabajo en terreno) dependía de una "Solicitud" para existir. Ahora son **dos sistemas independientes**: **Tareas** (asignación directa de trabajo) y **Solicitudes** (pedido de insumos con flujo de aprobación), sin relación en vivo entre ambas.

## 2. Resumen de cambios por capa

**Base de datos**
- Tablas nuevas: `tareas`, `tarea_miembros`, `tarea_comentarios` (reemplazan a `actividades` y sus tablas satélite).
- Tablas nuevas de soporte a solicitudes: `solicitud_item_aportes` (aportes parciales por ítem) y `solicitud_log` (auditoría de cada transición de estado).
- `solicitudes` gana columnas de estado y flujo: `estado`, `receptor_nombre`, `receptor_telefono`, `reclamado_por_grupo_id`, `reclamado_en`, `aprobado_por_username`, `aprobado_en`, `rechazo_motivo`.
- `solicitud_items` gana `cantidad_flexible` (ítems sin cantidad exacta, "cualquier cantidad").
- `notificaciones` gana `tarea_id` y `solicitud_id`.
- Migración aditiva: no se tocan ni borran `actividades`/`actividad_miembros`/`actividad_comentarios`; cada actividad existente se copió a una `tarea` nueva, y todas las solicitudes existentes quedaron en estado `Pendiente`. Las tablas viejas siguen intactas en `dev` a la espera de decidir su limpieza.

**Backend**
- Blueprint nuevo `tareas.py` con CRUD simple (crear, cambiar estado, asignar miembros, soft-delete, comentarios).
- `solicitudes.py` reescrito con máquina de estados de 4 valores (`Pendiente/Aprobada/Rechazada/Resuelta`) y rutas nuevas: aprobar, rechazar (motivo obligatorio), listar aprobadas, reclamar, liberar, marcar-resuelta.
- Cada transición de estado queda registrada en `solicitud_log`.
- Edición de una solicitud reclamada por otro grupo devuelve 409.

**Frontend**
- `ModuloActividades.jsx` → `ModuloTareas.jsx` (kanban de 3 columnas, sin ítems).
- `ModuloSolicitudes.jsx` actualizado con campos de receptor y checkbox "cualquier cantidad".
- Módulo nuevo `ModuloSolicitudesAprobadas.jsx`: tablero colaborativo donde los grupos reclaman, aportan y liberan solicitudes aprobadas.
- Navegación y `client.js` actualizados.

**Pendiente**
- ~~Actualizar `contexto.md` con el nuevo modelo.~~ Hecho (2026-07-02).
- Decidir cuándo eliminar las tablas viejas (`actividades` y satélites) — se dejan por ahora porque siguen en uso real en `dev`.
- Despliegue a producción (checklist detallado ya armado en `todo.md`: backup de BD, migración aditiva contra `public`, verificar variables de entorno en Railway/Vercel, validación post-deploy, plan de rollback).

---

## 3. Ciclo de vida de una Tarea

Una Tarea es trabajo asignado directamente, sin pasar por aprobación.

1. **Creación**: admin/coordinador la asigna a cualquier grupo, o un grupo la crea para sí mismo. Lleva descripción, ubicación, fecha/hora, prioridad y miembros — ya no tiene "ítems".
2. **Estados**: `Por ejecutar → En ejecución → Ejecutado` (transición simple, sin flujo de aprobación).
3. **Colaboración**: se pueden agregar miembros y comentarios en cualquier momento.
4. **Cierre**: eliminar una tarea es un soft-delete (`archivada = true`) sin efectos secundarios — a diferencia del modelo viejo, ya no "revive" ninguna solicitud, porque el acoplamiento desapareció.

## 4. Ciclo de vida de una Solicitud

Una Solicitud es un pedido de insumos/recursos que sí requiere aprobación y puede resolverse en partes.

1. **Creación** (`Pendiente`): un grupo o un centro pide insumos, con ítems (cada uno puede marcarse "cualquier cantidad") y datos de receptor (nombre/teléfono en texto libre).
2. **Aprobación**: un privilegiado (admin/coordinador) aprueba (`→ Aprobada`) o rechaza (`→ Rechazada`, con motivo obligatorio). Si se rechaza, quien la creó puede editarla y reenviarla, y vuelve a `Pendiente`.
3. **Tablero de "Solicitudes Aprobadas"**: solo grupos de trabajo participan (los centros no reclaman ni resuelven solicitudes de terceros). Ahí ven todas las solicitudes en estado `Aprobada`.
4. **Reclamar**: un grupo reclama la solicitud completa (no por ítem) → queda marcada "En Proceso" (derivado de `Aprobada` + `reclamado_por_grupo_id` seteado). Mientras está reclamada, los demás grupos la ven de solo lectura y no pueden reclamarla ni editarla (409 si lo intentan).
5. **Aportar y liberar**: el grupo que reclamó registra aportes parciales por ítem (cantidad + comentario) y libera la solicitud:
   - Si todos los ítems no-flexibles quedaron cubiertos → pasa a `Resuelta`.
   - Si queda algo pendiente → vuelve a `Aprobada` (disponible) para que cualquier grupo (incluido el mismo) la vuelva a reclamar más adelante y siga aportando.
   - Para solicitudes sin ítems o con ítems "cualquier cantidad", el grupo puede forzar `marcar-resuelta` manualmente.
6. **Notificaciones**: se avisa al creador cuando se aprueba, se rechaza o se resuelve (con los aportes). El simple reclamo no notifica.
7. **Trazabilidad**: cada evento (creada, aprobada, rechazada, reenviada, reclamada, liberada, resuelta) queda en `solicitud_log`, y cada aporte parcial queda en `solicitud_item_aportes` — la cantidad resuelta de un ítem se calcula sumando esos aportes, no se guarda como columna redundante.

## 5. Diferencia clave con el modelo anterior

Antes, Tareas (Actividades) y Solicitudes estaban acopladas: resolver una solicitud generaba la actividad, y borrar la actividad podía "revivir" la solicitud. Ahora son independientes: una Tarea nunca depende de una Solicitud para existir, y viceversa. Como consecuencia intencional, el trabajo que hoy ya está resuelto como Actividad también aparece como Solicitud "Pendiente" esperando aprobación en el nuevo tablero — son sistemas distintos ahora, no hay vínculo en vivo entre ellos.

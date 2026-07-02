# Plan: Separación de Tareas y Solicitudes

> Rama de trabajo: `dev`
> Basado en `actualizacion.md` + decisiones tomadas en conversación (2026-07-02)
> Estado: **Aprobado — listo para implementar**

---

## 1. Decisiones ya tomadas (confirmadas contigo)

| Tema | Decisión |
|------|----------|
| Relación Tareas ↔ Solicitudes | **Desacopladas por completo.** Tareas = asignación directa de trabajo (admin/coordinador → grupo, o grupo → sí mismo). Solicitudes = pedido de insumos/recursos con flujo de aprobación. No hay relación en vivo entre ambas. |
| Evitar duplicidad de esfuerzo | Mecanismo de **"Reclamar" por solicitud completa** (no por ítem). Un grupo reclama toda la solicitud aprobada → pasa a "En Proceso" → solo ese grupo la resuelve mientras está reclamada. |
| Cantidades parciales | Sí. Cada ítem puede recibir aportes parciales de uno o varios grupos a lo largo del tiempo. Al **liberar** la solicitud, se restan las cantidades resueltas y la solicitud vuelve a "Aprobada" (disponible) si quedó algo pendiente. Los ítems soportan un flag **"cualquier cantidad"** para pedidos sin cantidad exacta. |
| Campo receptor | `receptor_nombre` y `receptor_telefono` como texto libre (no vinculado a tablas existentes). |
| Quién crea Tareas | Admin/Coordinador asigna a cualquier grupo. Un grupo también puede crear tareas para sí mismo. |
| Solicitud Rechazada | Editable y reenviable por quien la creó (vuelve a estado "Pendiente"). |
| Rol "centro" en resolución | Los centros **no** reclaman/resuelven solicitudes de otros. Solo grupos de trabajo participan del tablero de "Solicitudes Aprobadas". Los centros siguen pudiendo crear solicitudes y ver su propio estado. |
| Datos existentes | Se **preserva el historial**: cada actividad actual se migra a una Tarea propia (copiando descripción/ubicación/fecha/prioridad/miembros/comentarios de la solicitud vinculada, ya que Tareas deja de depender de Solicitudes). Todas las solicitudes existentes (tengan o no actividad hoy) quedan en estado **"Pendiente"** para pasar por el nuevo flujo de aprobación. |
| Eliminar una Tarea | Deja de "revivir" ninguna solicitud (ese acoplamiento desaparece). Ahora es simplemente un soft-delete (`archivada = true`), sin efectos secundarios. |

> ⚠️ **Nota a confirmar de nuevo, por si acaso:** como pediste preservar el historial completo, el mismo trabajo que hoy ya está resuelto como Actividad va a **también** aparecer como Solicitud "Pendiente" esperando aprobación (son sistemas distintos ahora, sin vínculo). Esto es exactamente lo que describiste, solo lo dejo explícito para que no sea sorpresa al ver el tablero de Solicitudes con pedidos "viejos" reapareciendo como pendientes.

---

## 2. Modelo de Datos

### 2.1 Tabla `tareas` (reemplaza a `actividades`)

```sql
CREATE TABLE tareas (
    id                  SERIAL PRIMARY KEY,
    descripcion         TEXT NOT NULL,
    grupo_id            INT NOT NULL REFERENCES grupos_trabajo(id),
    creado_por_rol      VARCHAR(50),         -- 'admin' | 'coordinador' | 'grupo'
    creado_por_username VARCHAR(100),
    ubicacion           VARCHAR(500),
    fecha_hora          TIMESTAMPTZ,
    prioridad           VARCHAR(20) DEFAULT 'Normal',
    lat                 DOUBLE PRECISION,
    lng                 DOUBLE PRECISION,
    estado              VARCHAR(50) NOT NULL DEFAULT 'Por ejecutar',
    archivada           BOOLEAN DEFAULT FALSE,
    solicitud_origen_id INT,                 -- histórico, sin FK viva — solo referencia informativa post-migración
    fecha_asignacion    TIMESTAMPTZ DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT ck_tarea_estado CHECK (estado IN ('Por ejecutar', 'En ejecución', 'Ejecutado'))
);

CREATE TABLE tarea_miembros (
    tarea_id   INT NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
    miembro_id INT NOT NULL REFERENCES miembros(id) ON DELETE CASCADE,
    PRIMARY KEY (tarea_id, miembro_id)
);

CREATE TABLE tarea_comentarios (   -- reemplaza actividad_comentarios
    id              SERIAL PRIMARY KEY,
    tarea_id        INT NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
    autor_username  VARCHAR(100),
    autor_rol       VARCHAR(50),
    grupo_id        INT,
    texto           TEXT NOT NULL,
    fecha_creacion  TIMESTAMPTZ DEFAULT NOW()
);
```

Se elimina el concepto de "ítems" en tareas — solo descripción + miembros + estado, como pediste.

### 2.2 Tabla `solicitudes` (modificada)

Campos nuevos:

```sql
ALTER TABLE solicitudes
    ADD COLUMN estado               VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
    ADD COLUMN receptor_nombre      VARCHAR(200),
    ADD COLUMN receptor_telefono    VARCHAR(50),
    ADD COLUMN reclamado_por_grupo_id INT REFERENCES grupos_trabajo(id),
    ADD COLUMN reclamado_en         TIMESTAMPTZ,
    ADD COLUMN aprobado_por_username VARCHAR(100),
    ADD COLUMN aprobado_en          TIMESTAMPTZ,
    ADD COLUMN rechazo_motivo       TEXT,
    ADD CONSTRAINT ck_sol_estado CHECK (estado IN ('Pendiente', 'Aprobada', 'Rechazada', 'Resuelta'));
```

"En Proceso" es un estado derivado en la UI: `estado = 'Aprobada' AND reclamado_por_grupo_id IS NOT NULL`. No es un valor propio de `estado` para no complicar la máquina de estados (aprobar/rechazar/resolver siguen siendo transiciones simples de 4 valores).

### 2.3 Tabla `solicitud_items` (modificada)

```sql
ALTER TABLE solicitud_items
    ADD COLUMN cantidad_flexible BOOLEAN DEFAULT FALSE;  -- "cualquier cantidad" — sin objetivo exacto
```

`cantidad` sigue siendo la cantidad objetivo cuando `cantidad_flexible = FALSE`. Cuando es `TRUE`, se ignora como objetivo (se acepta cualquier aporte) y el ítem se marca resuelto manualmente por quien libera la solicitud.

### 2.4 Tabla nueva `solicitud_item_aportes` (trazabilidad + parcialidad)

```sql
CREATE TABLE solicitud_item_aportes (
    id             SERIAL PRIMARY KEY,
    item_id        INT NOT NULL REFERENCES solicitud_items(id) ON DELETE CASCADE,
    grupo_id       INT NOT NULL REFERENCES grupos_trabajo(id),
    cantidad       INT NOT NULL,
    comentario     TEXT,             -- "texto de cómo lo resuelve"
    fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);
```

`cantidad_resuelta` de un ítem = `SUM(solicitud_item_aportes.cantidad)`. No se guarda como columna redundante; se calcula al leer (patrón ya usado en el proyecto, ver `_get_items`).

### 2.5 Tabla nueva `solicitud_log` (trazabilidad, recomendación #4 del doc)

```sql
CREATE TABLE solicitud_log (
    id             SERIAL PRIMARY KEY,
    solicitud_id   INT NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
    evento         VARCHAR(50) NOT NULL,  -- creada | aprobada | rechazada | reeenviada | reclamada | liberada | resuelta
    usuario        VARCHAR(100),
    rol            VARCHAR(50),
    detalle        TEXT,
    fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.6 Tabla `notificaciones`

```sql
ALTER TABLE notificaciones ADD COLUMN tarea_id INT REFERENCES tareas(id) ON DELETE CASCADE;
ALTER TABLE notificaciones ADD COLUMN solicitud_id INT REFERENCES solicitudes(id) ON DELETE CASCADE;
```

> Nota (consistente con la estrategia de "tablas en paralelo" de la sección 5): se **agrega** `tarea_id` en vez de renombrar `actividad_id`, para no romper el código viejo mientras ambos conviven. `actividad_id` queda en desuso y se elimina junto con `actividades` en la limpieza final (Fase 5).

Nuevos eventos que notifican: solicitud aprobada/rechazada (al creador), solicitud reclamada (opcional, informativo), solicitud resuelta/liberada con aportes (al creador).

### 2.7 Migración de datos existentes (preservando historial)

Script `backend/migrate_tareas_solicitudes.py`:
1. Crear tablas nuevas (`tareas`, `tarea_miembros`, `tarea_comentarios`, `solicitud_item_aportes`, `solicitud_log`).
2. Por cada fila de `actividades` (archivada o no): insertar en `tareas` copiando `descripcion, ubicacion, fecha_hora, prioridad, lat, lng` desde la `solicitud` vinculada, más `estado`, `archivada`, `grupo_id`, `fecha_asignacion/actualizacion`, y guardando `solicitud_origen_id` como referencia histórica.
3. Copiar `actividad_miembros` → `tarea_miembros`, `actividad_comentarios` → `tarea_comentarios`.
4. Poner **todas** las filas de `solicitudes` en `estado = 'Pendiente'`.
5. Dejar `actividades`/`actividad_miembros`/`actividad_comentarios` intactas (no se borran) por seguridad, hasta validar en `dev`; se eliminan en una migración de limpieza posterior una vez confirmado que todo funciona.

---

## 3. Backend — Endpoints

### 3.1 Tareas (nuevo blueprint `tareas.py`, reemplaza `actividades.py`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/tareas` | Auth | Listar (privileged: todas; grupo: solo las suyas) |
| POST | `/api/tareas` | Auth | Crear tarea directa (privileged: a cualquier grupo; grupo: solo para sí mismo) |
| PUT | `/api/tareas/:id` | Auth | Cambiar estado |
| PUT | `/api/tareas/:id/miembros` | Auth | Asignar miembros |
| DELETE | `/api/tareas/:id` | Auth | Soft-delete simple (sin efectos secundarios) |
| GET/POST | `/api/tareas/:id/comentarios` | Auth | Comentarios (igual que hoy, renombrado) |

Se elimina `POST /api/actividades/rapida` (ya no tiene sentido: crear una tarea directa ya no requiere pasar por una solicitud).

### 3.2 Solicitudes (modificado `solicitudes.py`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/solicitudes` | Auth | Listar (privileged: todas con filtro `?estado=`; grupo/centro: solo las suyas) |
| POST | `/api/solicitudes` | Auth | Crear (agrega `receptor_nombre`, `receptor_telefono`, items con `cantidad_flexible`). Estado inicial `Pendiente`. |
| PUT | `/api/solicitudes/:id` | Auth | Editar (dueño; permitido si `Pendiente` o `Rechazada`; si estaba Rechazada, vuelve a `Pendiente`) |
| DELETE | `/api/solicitudes/:id` | Privileged u dueño si sigue `Pendiente` | Eliminar |
| PUT | `/api/solicitudes/:id/aprobar` | Privileged | `Pendiente → Aprobada`, guarda `aprobado_por/en`, log |
| PUT | `/api/solicitudes/:id/rechazar` | Privileged | `Pendiente → Rechazada`, requiere `rechazo_motivo` (400 si viene vacío), log |
| GET | `/api/solicitudes/aprobadas` | Grupo/Privileged | Tablero colaborativo: todas las `Aprobada` (incluye "En Proceso"), con filtros `?centro_id=&grupo_id=` |
| PUT | `/api/solicitudes/:id/reclamar` | Grupo | Solo si `Aprobada` y sin reclamar → set `reclamado_por_grupo_id` |
| PUT | `/api/solicitudes/:id/liberar` | Grupo reclamante | Recibe aportes por ítem `[{item_id, cantidad, comentario}]` + comentario general opcional → inserta en `solicitud_item_aportes`, limpia `reclamado_por_grupo_id`, decide estado final: `Resuelta` si todos los ítems no-flexibles cubren su cantidad y no quedan flexibles pendientes de marcar manualmente; si no, vuelve a `Aprobada` |
| PUT | `/api/solicitudes/:id/marcar-resuelta` | Grupo reclamante | Fuerza `Resuelta` manualmente (para solicitudes sin ítems o con ítems flexibles que el grupo considera completos) |

`GET /api/solicitudes/pendientes` se reemplaza por `GET /api/solicitudes?estado=Pendiente` (privileged).

---

## 4. Frontend

### 4.1 Navegación
- **Admin/Coordinador**: Miembros y Grupos | Publicaciones | Centros | **Tareas** | **Solicitudes** | **Solicitudes Aprobadas**
- **Grupo**: Mi Grupo | Publicaciones | **Tareas** | **Solicitudes** | **Solicitudes Aprobadas**
- **Centro**: `VistaCentro.jsx` — crea solicitudes, ve su propio estado (no ve "Solicitudes Aprobadas")

### 4.2 `ModuloTareas.jsx` (renombrado desde `ModuloActividades.jsx`)
- Kanban igual que hoy (3 columnas), sin ítems.
- Botón "Nueva tarea": admin/coordinador elige grupo destino; grupo la crea para sí mismo directo.
- Resto igual (miembros, comentarios).

### 4.3 `ModuloSolicitudes.jsx`
- Formulario de creación: agrega `receptor_nombre`, `receptor_telefono`, checkbox "cualquier cantidad" por ítem.
- Vista grupo/centro: lista de sus solicitudes con estado (Pendiente/Aprobada/Rechazada/Resuelta), editable si Pendiente/Rechazada.
- Vista admin/coordinador: lista con filtro por estado, botones Aprobar/Rechazar (rechazar pide motivo).

### 4.4 Nuevo `ModuloSolicitudesAprobadas.jsx`
- Tablero para grupos: solicitudes `Aprobada`, filtros por centro/grupo origen.
- Tarjeta muestra si está "En Proceso" (reclamada) y por quién.
- Modal/acordeón: ver ítems, botón "Reclamar" (si libre), o si ya la reclamó tu grupo → inputs de cantidad aportada + comentario por ítem, botón "Liberar" (guarda parcial) o "Marcar resuelta".

### 4.5 `VistaCentro.jsx`
- Igual, con los campos nuevos del formulario de solicitud.

---

## 5. Fuera de alcance de este plan (infraestructura)

El doc original pregunta cómo crear una "rama dev de la BD". Hoy solo existe **un** `DATABASE_URL` (revisé `backend/.env` y no hay separación prod/dev). Ya estamos en la rama de git `dev`, pero **no hay una base de datos de desarrollo separada todavía**. Esto es trabajo de infraestructura, no de código — lo dejo fuera de este plan salvo que quieras que lo incluya. Opciones típicas (a decidir aparte):
- Supabase branching nativo (requiere plan pago).
- Un segundo proyecto Supabase gratuito como "staging", con su propio `DATABASE_URL` en un `backend/.env` local y en variables de entorno de Railway/Vercel para el ambiente de preview.


**Pregunta:** ¿Es posible crear las tablas necesarias dentro de la BD sin tocar las tablas anteriores, trabajar sobre estas tablas en paralelo y luego de tener esta versión trabajando sobre las tablas nuevas mudar los datos y eliminar las tablas viejas?

**Respuesta:** Sí. El código actual nunca usa `SELECT *` ni INSERT implícito (todas las queries listan columnas explícitas), así que crear tablas nuevas y agregar columnas nuevas con `DEFAULT` a las existentes no rompe nada de lo que ya funciona. Se desarrolla y prueba todo sobre las tablas/columnas nuevas sin tocar `actividades`, y solo al final se corre la migración de datos y se eliminan las tablas viejas (tal como ya describe el paso 5 de la sección 2.7).
---

## 6. Fases de implementación

1. **BD**: crear tablas nuevas + alterar `solicitudes`/`solicitud_items`/`notificaciones` + script de migración de datos. Ejecutar y validar en la BD de dev.
2. **Backend**: nuevo blueprint `tareas.py`, reescribir `solicitudes.py` con el flujo de estados, nuevas rutas de aprobar/rechazar/reclamar/liberar, actualizar `comentarios.py` y `notificaciones` para usar `tarea_id`.
3. **Frontend**: renombrar/adaptar `ModuloActividades.jsx` → `ModuloTareas.jsx`, actualizar `ModuloSolicitudes.jsx`, crear `ModuloSolicitudesAprobadas.jsx`, actualizar navegación en `App.jsx` y `client.js`.
4. **Pruebas E2E en dev**: flujo completo (Grupo A pide → Coordinador aprueba → Grupo B reclama y aporta parcial → Grupo C completa y libera → Resuelta).
5. **Despliegue a producción**: aplicar migración de BD (ya con historial preservado) + deploy de código.

---

## 7. Preguntas menores — todas resueltas

1. **Motivo de rechazo**: **obligatorio**. `PUT /api/solicitudes/:id/rechazar` devuelve 400 si `rechazo_motivo` viene vacío.
2. **Reclamo visible a otros**: mientras una solicitud está "En Proceso" (reclamada), los demás grupos la siguen viendo en el tablero mostrando "reclamada por Grupo X", solo de lectura (no pueden reclamarla también). Confirmado.
3. **Notificación de reclamo**: solo se notifica al creador al aprobar/rechazar y al liberar aportes (resolución). No se notifica el simple reclamo.
4. **Editar solicitud ya reclamada por otro grupo**: no se permite la modificación mientras esté "En Proceso". No requiere sincronización constante — se valida en el momento de la acción: el `PUT /api/solicitudes/:id` chequea `reclamado_por_grupo_id` en ese instante y devuelve 409 si está reclamada; el frontend solo oculta el botón "Editar" según el último dato cargado (mismo patrón fetch-on-demand que ya usa el proyecto, sin polling ni websockets).

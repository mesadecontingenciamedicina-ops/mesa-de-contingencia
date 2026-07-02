# Contexto General — Mesa de Contingencia

> **Última actualización:** 2026-07-02 (Separación de Tareas y Solicitudes, y flujos de aprobación y colaboración)
> **Propósito de este archivo:** Dar a cualquier agente (IA o humano) el contexto completo del proyecto para poder trabajar sin necesidad de leer todo el código fuente. **Mantener este archivo actualizado con cada cambio significativo.**

---

## 1. ¿Qué es este proyecto?

**Mesa de Contingencia** es una aplicación web interna de la **Facultad de Medicina de la UCV** (Universidad Central de Venezuela) para gestionar emergencias y contingencias. Permite:

- Registrar **miembros** del personal (profesores, estudiantes, BR, auxiliares, voluntarios)
- Organizar miembros en **grupos de trabajo**
- Registrar **centros de atención** (hospitales, ambulatorios, etc.) con contactos y ubicación geográfica
- Asignar **tareas directas** a los grupos de trabajo (Kanban: `Por ejecutar → En ejecución → Ejecutado`)
- Crear **solicitudes de recursos/insumos** que pasan por un flujo de aprobación (`Pendiente → Aprobada/Rechazada → Resuelta`) y colaboración entre grupos.
- Sistema de **comentarios y notificaciones**
- **Autenticación por roles**: admin, grupo, centro

---

## 2. Arquitectura General

```
┌─────────────────────────────────────────────┐
│                  Monorepo                    │
├──────────┬──────────────┬───────────────────┤
│ frontend/│   backend/   │       api/        │
│ React+   │   Flask      │  Vercel Serverless│
│ Vite     │   (Python)   │  (proxy a Flask)  │
└────┬─────┴──────┬───────┴─────────┬─────────┘
     │            │                 │
     │    ┌───────▼────────┐        │
     │    │   Supabase     │◄───────┘
     │    │  (PostgreSQL)  │
     │    └────────────────┘
     │
     ▼
  Vercel (frontend estático)
  Railway (backend API)
```

### Despliegue
| Componente | Plataforma | Config                        |
|------------|------------|-------------------------------|
| Frontend   | **Vercel** | `vercel.json` — build React, rewrites `/api/*` → serverless function |
| Backend    | **Railway** | `railway.json` — gunicorn, nixpacks builder |
| BD         | **Supabase** | PostgreSQL gestionado, conexión via `DATABASE_URL` |
| API proxy  | **Vercel** (serverless) | `api/index.py` — importa Flask app para redirigir `/api/*` en producción Vercel |

---

## 3. Stack Tecnológico

### Backend (`backend/`)
- **Python 3.10+**
- **Flask 3.0.3** (sin ORM, SQL directo)
- **psycopg2-binary** — driver PostgreSQL
- **PyJWT** — autenticación JWT
- **werkzeug** — hash de contraseñas (`pbkdf2:sha256`)
- **gunicorn** — servidor WSGI en producción

### Frontend (`frontend/`)
- **React 18** con JSX
- **Vite 4** como bundler
- **Vanilla CSS** (un solo archivo `App.css` de ~25KB)
- **Leaflet + react-leaflet** — mapas interactivos
- Sin router (SPA con navegación por tabs/estado)

### Base de Datos
- **Supabase (PostgreSQL)**
- Esquema definido en `backend/app/schema_supabase.sql`
- Soporte para `DB_SCHEMA` variable de entorno (permite separar entornos)

---

## 4. Estructura de Archivos

```
mesa-de-contingencia/
├── api/
│   ├── index.py                  # Proxy serverless Vercel → Flask app
│   └── requirements.txt
├── backend/
│   ├── run.py                    # Entry point (Flask dev server, puerto 5000)
│   ├── Procfile                  # Para Railway: gunicorn
│   ├── requirements.txt
│   ├── .env.example
│   ├── app/
│   │   ├── __init__.py           # Flask factory (create_app), CORS manual, OPTIONS handler
│   │   ├── db.py                 # get_connection() via DATABASE_URL + psycopg2
│   │   ├── auth.py               # JWT login/logout, decoradores @require_auth, @require_admin, @require_privileged
│   │   ├── validaciones.py       # Validación de cédula, teléfono, email, miembros (Venezuela)
│   │   ├── schema.sql            # Esquema legacy (SQL Server)
│   │   ├── schema_supabase.sql   # Esquema actual PostgreSQL
│   │   └── routes/
│   │       ├── __init__.py       # Blueprint `main_bp`, importa todos los módulos
│   │       ├── health.py         # GET /api/health
│   │       ├── auth_routes.py    # POST /api/login, POST /api/logout, GET /api/me
│   │       ├── miembros.py       # CRUD /api/miembros
│   │       ├── grupos.py         # CRUD /api/grupos + gestión de usuarios de grupo
│   │       ├── centros.py        # CRUD /api/centros + contactos + usuarios de centro
│   │       ├── solicitudes.py    # CRUD /api/solicitudes + flujo de aprobación y aportes
│   │       ├── tareas.py         # CRUD /api/tareas + asignación de miembros (reemplazó actividades.py)
│   │       ├── comentarios.py    # Comentarios + notificaciones
│   │       └── insumos.py        # GET /api/insumos (búsqueda de catálogo)
│   └── migrate*.py / seed*.py    # Scripts de migración y seed (varios, históricos)
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js            # Proxy /api → localhost:5000 en dev
│   ├── .env.example              # VITE_API_URL
│   ├── public/
│   │   └── logo-facmed.png
│   └── src/
│       ├── main.jsx              # ReactDOM.createRoot + AuthProvider
│       ├── App.jsx               # Layout principal, tabs, routing por estado
│       ├── App.css               # Todo el CSS de la app
│       ├── index.css             # CSS global mínimo
│       ├── api/
│       │   └── client.js         # Wrapper fetch: req(), manejo de 401, api.* exports
│       ├── context/
│       │   └── AuthContext.jsx   # Provider de autenticación + verificación periódica
│       ├── components/
│       │   ├── Login.jsx
│       │   ├── ModuloMiembrosGrupos.jsx
│       │   ├── ModuloSolicitudes.jsx         # Creación y gestión de solicitudes
│       │   ├── ModuloSolicitudesAprobadas.jsx# Tablero para reclamar y aportar a solicitudes
│       │   ├── ModuloTareas.jsx              # Tablero Kanban de tareas directas
│       │   ├── ModuloCentros.jsx             # Gestión de centros
│       │   ├── VistaCentro.jsx               # Vista para rol "centro"
│       │   ├── PanelNotificaciones.jsx
│       │   └── MapaPicker.jsx
│       └── utils/
│           └── validaciones.js   # Validaciones client-side
├── railway.json
├── vercel.json
├── .gitignore
└── README.md
```

---

## 5. Modelo de Datos (PostgreSQL)

### Tablas principales

| Tabla | Descripción | Campos clave |
|-------|------------|--------------|
| `miembros` | Personal registrado | id, nombre, cedula (unique), telefono, tlf_alternativo, cargo, email |
| `grupos_trabajo` | Grupos de trabajo | id, nombre, descripcion, representante_principal_id, es_coordinador |
| `miembros_grupos` | Relación N:M miembro↔grupo | miembro_id, grupo_id |
| `centros_atencion` | Centros de atención | id, nombre, descripcion, activo, direccion, lat, lng |
| `centro_contactos` | Contactos de centro | id, centro_id, nombre, cargo, telefono, email |
| `usuarios` | Usuarios de autenticación | id, username, password_hash, password_plain, rol (admin/grupo/centro), grupo_id, centro_id, activo |
| `solicitudes` | Solicitudes de recursos/insumos | id, estado (Pendiente/Aprobada/Rechazada/Resuelta), descripcion, receptor_nombre, receptor_telefono, creado_por_grupo_id, creado_por_centro_id, reclamado_por_grupo_id, aprobado_por_username |
| `solicitud_log` | Historial/Auditoría de solicitudes | id, solicitud_id, evento, actor_username, fecha |
| `insumos` | Catálogo de insumos médicos | id, codigo, nombre, forma_farmaceutica, concentracion, disponibilidad, prioridad |
| `solicitud_items` | Items de cada solicitud | id, solicitud_id, insumo_id, nombre, cantidad, cantidad_flexible |
| `solicitud_item_aportes` | Aportes parciales a items | id, item_id, grupo_id, cantidad_aportada, comentario |
| `tareas` | Asignación de trabajo directo | id, grupo_id, estado, descripcion, archivada |
| `tarea_miembros` | Miembros asignados a tareas | tarea_id, miembro_id |
| `tarea_comentarios` | Comentarios en tareas | id, tarea_id, autor_username, texto |
| `notificaciones` | Notificaciones push internas | id, para_rol, para_grupo_id, tarea_id, solicitud_id, texto, leida |
| `publicaciones` | Avisos/noticias generales | id, descripcion, autor_username, grupo_id, fecha_creacion |

*(Nota: Las tablas `actividades`, `actividad_miembros` y `actividad_comentarios` aún existen en la BD por razones de retrocompatibilidad/legacy, pero han sido reemplazadas funcionalmente por las tablas de `tareas`)*

---

## 6. Sistema de Autenticación

### Roles
| Rol | Permisos |
|-----|----------|
| `admin` | Todo: CRUD completo. Puede aprobar/rechazar solicitudes. |
| `coordinador` | Sub-admin (es un `grupo` con flag `es_coordinador = TRUE`). Aprueba/rechaza solicitudes, ve todas las tareas, recibe todas las notificaciones. |
| `grupo` | Ve solo su grupo. Crea solicitudes. Ve tablero de Solicitudes Aprobadas para reclamarlas. |
| `centro` | Vista especial: puede crear solicitudes desde su centro. |

### Flujo de autenticación
- `POST /api/login` → recibe JWT (TTL 8 horas) guardado en `localStorage` como `mesa_auth`.
- Header `Authorization: Bearer <token>`.
- Si el backend retorna 401, el cliente emite evento `session-expired` y fuerza logout.
- **Seguridad visual**: La pantalla de login (`Login.jsx`) cuenta con un botón (ícono de ojo) para mostrar u ocultar la contraseña escrita.
- **Gestión de claves para Centros**: Los usuarios con rol `centro` pueden cambiar su propia contraseña manualmente desde su interfaz (`VistaCentro.jsx`).

---

## 7. API Endpoints Clave

### Tareas (Reemplazan a Actividades)
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/tareas` | Auth | Listar (privileged: todas, grupo: solo las suyas) |
| POST | `/api/tareas` | Auth | Crear tarea directa |
| PUT | `/api/tareas/:id` | Auth | Cambiar estado (Por ejecutar/En ejecución/Ejecutado) |
| PUT | `/api/tareas/:id/miembros` | Auth | Asignar miembros a tarea |
| DELETE | `/api/tareas/:id` | Auth | Soft-delete (archiva la tarea) |

### Solicitudes (Flujo de Aprobación y Colaboración)
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/solicitudes` | Auth | Listar solicitudes |
| POST | `/api/solicitudes` | Auth | Crear solicitud (queda "Pendiente") |
| PUT | `/api/solicitudes/:id/aprobar` | Privileged | Pasar solicitud a "Aprobada" |
| PUT | `/api/solicitudes/:id/rechazar` | Privileged | Pasar a "Rechazada" (requiere motivo) |
| GET | `/api/solicitudes/aprobadas` | Auth | Listar solicitudes en el tablero para reclamar |
| PUT | `/api/solicitudes/:id/reclamar` | Grupo | El grupo asume la resolución de la solicitud (queda En Proceso) |
| POST | `/api/solicitudes/:id/aportes` | Grupo | Registrar aportes parciales de insumos |
| PUT | `/api/solicitudes/:id/liberar` | Grupo | Suelta el reclamo (vuelve a Aprobada o pasa a Resuelta si se cubrió todo) |
| PUT | `/api/solicitudes/:id/marcar-resuelta` | Grupo | Cierra la solicitud manualmente |

---

## 8. Frontend — Navegación

- **Admin / Coordinador**: Miembros y Grupos | Publicaciones | Centros | Solicitudes | Tareas | Solicitudes Aprobadas
- **Grupo**: Mi Grupo | Publicaciones | Mis Solicitudes | Mis Tareas | Solicitudes Aprobadas
- **Centro**: Vista directa (`VistaCentro.jsx`). Pueden crear y gestionar sus solicitudes, y cambiar su propia contraseña mediante un modal dedicado.

---

## 9. Notas Importantes / Gotchas

1. **Separación Tareas/Solicitudes**: Anteriormente una Actividad dependía de una Solicitud. Ahora son independientes. Una "Tarea" es trabajo directo; una "Solicitud" es un pedido de recursos que pasa por un embudo de aprobación y reclamo colaborativo.
2. **`password_plain` en BD**: Se almacena la contraseña en texto plano intencionalmente para que admin pueda distribuir credenciales de grupos y centros.
3. **Solicitudes en Proceso**: Una solicitud `Aprobada` pasa a estado "En Proceso" virtualmente cuando `reclamado_por_grupo_id` tiene un valor. En este estado, los demás grupos reciben un 409 Conflict si intentan editarla.
4. **Cantidades Flexibles**: Los ítems de las solicitudes pueden marcarse como `cantidad_flexible = true` (significa "cualquier cantidad").
5. **CORS permisivo**: El backend acepta cualquier origen.

---

## 10. Flujo de Negocio Principal

### Ciclo de vida de una Tarea (Trabajo Directo)
1. **Creación**: admin/coordinador asigna a cualquier grupo, o un grupo crea para sí mismo. (No requiere ítems, ni flujo de aprobación).
2. **Estados**: `Por ejecutar → En ejecución → Ejecutado`
3. **Colaboración**: se pueden agregar miembros y comentarios.
4. **Cierre**: eliminar la tarea la marca como archivada.

### Ciclo de vida de una Solicitud (Pedidos e Insumos)
1. **Creación (`Pendiente`)**: un grupo o centro pide insumos. Define items (con o sin cantidades exactas) y datos del receptor.
2. **Aprobación**: un admin/coordinador aprueba (`→ Aprobada`) o rechaza (`→ Rechazada` con motivo).
3. **Tablero Aprobadas**: los grupos ven las solicitudes `Aprobadas`.
4. **Reclamar**: un grupo reclama la solicitud. Queda bloqueada para otros.
5. **Aportar y Liberar**: el grupo registra aportes parciales y luego libera la solicitud:
   - Si los ítems se cubrieron → `Resuelta`.
   - Si falta algo → vuelve a `Aprobada` para que otro (o el mismo) grupo la reclame luego.
   - Alternativa: forzar "marcar-resuelta" si eran cantidades flexibles.
6. **Notificaciones y Logs**: Se avisa al creador en aprobaciones/rechazos/resoluciones. Todo queda registrado en `solicitud_log`.

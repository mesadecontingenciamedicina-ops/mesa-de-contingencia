# Contexto General — Mesa de Contingencia

> **Última actualización:** 2026-07-01
> **Propósito de este archivo:** Dar a cualquier agente (IA o humano) el contexto completo del proyecto para poder trabajar sin necesidad de leer todo el código fuente. **Mantener este archivo actualizado con cada cambio significativo.**

---

## 1. ¿Qué es este proyecto?

**Mesa de Contingencia** es una aplicación web interna de la **Facultad de Medicina de la UCV** (Universidad Central de Venezuela) para gestionar emergencias y contingencias. Permite:

- Registrar **miembros** del personal (profesores, estudiantes, BR, auxiliares, voluntarios)
- Organizar miembros en **grupos de trabajo**
- Registrar **centros de atención** (hospitales, ambulatorios, etc.) con contactos y ubicación geográfica
- Crear **solicitudes de emergencia** (con prioridad, ubicación, insumos médicos requeridos)
- Convertir solicitudes en **actividades** tipo Kanban: `Por ejecutar → En ejecución → Ejecutado`
- Sistema de **comentarios y notificaciones** por actividad
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
- **flask-cors** — (instalado pero CORS se maneja manualmente en `__init__.py`)

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
│   │       ├── solicitudes.py    # CRUD /api/solicitudes + items/insumos
│   │       ├── actividades.py    # CRUD /api/actividades + asignación de miembros
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
│       ├── App.css               # Todo el CSS de la app (~25KB)
│       ├── index.css             # CSS global mínimo
│       ├── api/
│       │   └── client.js         # Wrapper fetch: req(), manejo de 401, api.* exports
│       ├── context/
│       │   └── AuthContext.jsx   # Provider de autenticación + verificación periódica
│       ├── components/
│       │   ├── Login.jsx
│       │   ├── ModuloMiembrosGrupos.jsx  # (~37KB) Gestión de miembros y grupos
│       │   ├── ModuloSolicitudes.jsx     # (~25KB) Gestión de solicitudes
│       │   ├── ModuloActividades.jsx     # (~22KB) Tablero Kanban de actividades
│       │   ├── ModuloCentros.jsx         # (~11KB) Gestión de centros de atención
│       │   ├── VistaCentro.jsx           # (~22KB) Vista para rol "centro"
│       │   ├── PanelNotificaciones.jsx   # Panel de notificaciones
│       │   └── MapaPicker.jsx            # Selector de ubicación con Leaflet
│       └── utils/
│           └── validaciones.js   # Validaciones client-side (espejo de backend)
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
| `grupos_trabajo` | Grupos de trabajo | id, nombre, descripcion, representante_principal_id → miembros, es_coordinador |
| `miembros_grupos` | Relación N:M miembro↔grupo | miembro_id, grupo_id (PK compuesta) |
| `centros_atencion` | Centros de atención (hospitales, etc.) | id, nombre, descripcion, activo, direccion, lat, lng |
| `centro_contactos` | Contactos de cada centro | id, centro_id → centros, nombre, cargo, telefono, email |
| `usuarios` | Usuarios de autenticación | id, username, password_hash, password_plain, rol (admin/grupo/centro), grupo_id, centro_id, activo, session_version |
| `solicitudes` | Solicitudes de emergencia | id, descripcion, creado_por_grupo_id, creado_por_centro_id, solicitante_id → miembros, ubicacion, fecha_hora, prioridad (Baja/Normal/Alta), lat, lng |
| `insumos` | Catálogo de insumos médicos | id, codigo, nombre, forma_farmaceutica, concentracion, volumen_peso, disponibilidad, prioridad, precio_referencial |
| `solicitud_items` | Items de cada solicitud | id, solicitud_id → solicitudes, insumo_id → insumos, nombre, cantidad |
| `actividades` | Tareas Kanban derivadas de solicitudes | id, solicitud_id → solicitudes, grupo_id → grupos, estado (Por ejecutar/En ejecución/Ejecutado) |
| `actividad_miembros` | Miembros asignados a actividades | actividad_id, miembro_id (PK compuesta) |
| `actividad_comentarios` | Comentarios en actividades | id, actividad_id, autor_username, autor_rol, grupo_id, texto |
| `notificaciones` | Notificaciones push internas | id, para_rol, para_grupo_id, actividad_id, comentario_id, texto, leida |

### Relaciones clave
```
miembros ←N:M→ grupos_trabajo (via miembros_grupos)
grupos_trabajo ← representante_principal_id → miembros
solicitudes ← creado_por_grupo_id → grupos_trabajo
solicitudes ← creado_por_centro_id → centros_atencion
solicitudes ← solicitante_id → miembros
solicitudes ←1:N→ solicitud_items → insumos
actividades ← solicitud_id → solicitudes (1:1)
actividades ← grupo_id → grupos_trabajo
actividades ←N:M→ miembros (via actividad_miembros)
actividades ←1:N→ actividad_comentarios
usuarios ← grupo_id → grupos_trabajo
usuarios ← centro_id → centros_atencion
```

---

## 6. Sistema de Autenticación

### Roles
| Rol | Permisos |
|-----|----------|
| `admin` | Todo: CRUD completo en miembros, grupos, centros, solicitudes, actividades. Puede asignar cualquier solicitud a cualquier grupo. Recibe todas las notificaciones. |
| `coordinador` | Sub-admin (es un `grupo` con flag `es_coordinador = TRUE`). Puede asignar cualquier solicitud, eliminar solicitudes, ver todas las actividades, recibe todas las notificaciones. NO puede gestionar grupos ni centros. (Usa helper `is_privileged()`) |
| `grupo` | Ve solo su grupo y sus miembros. Puede crear solicitudes propias. Solo se autoasigna actividades de sus solicitudes. Solo recibe notificaciones de su grupo. |
| `centro` | Vista especial (`VistaCentro.jsx`): puede crear solicitudes desde su centro. No ve el tablero Kanban de admin. |

### Flujo de autenticación
1. `POST /api/login` → recibe JWT (TTL 8 horas)
2. Token se guarda en `localStorage` como `mesa_auth`
3. Todas las requests llevan `Authorization: Bearer <token>`
4. Si 401 → evento `session-expired` → logout automático
5. Verificación periódica cada 2 minutos via `GET /api/me`

### Contraseñas
- Hash con `pbkdf2:sha256` (werkzeug)
- `password_plain` se almacena en BD para que el admin pueda ver/regenerar contraseñas de grupos y centros
- Al crear un grupo/centro se autogenera usuario con username slug y contraseña aleatoria (10 chars)

---

## 7. API Endpoints Completos

### Autenticación
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/login` | No | Login, retorna JWT + user |
| POST | `/api/logout` | Sí | Logout (noop actual) |
| GET | `/api/me` | Sí | Datos del usuario autenticado |
| GET | `/api/health` | No | Healthcheck con verificación de BD |

### Miembros
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/miembros` | Auth | Listar (admin: todos, grupo: solo los de su grupo) |
| POST | `/api/miembros` | Auth | Crear miembro (con validación venezolana) |
| PUT | `/api/miembros/:id` | Auth | Editar miembro |
| DELETE | `/api/miembros/:id` | Auth | Eliminar (falla si tiene actividades asignadas) |

### Grupos
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/grupos` | Auth | Listar (incluye miembros, representante, usuario) |
| POST | `/api/grupos` | Admin | Crear grupo + usuario automático |
| PUT | `/api/grupos/:id` | Admin | Editar grupo |
| DELETE | `/api/grupos/:id` | Admin | Eliminar (falla si tiene actividades) |
| GET | `/api/grupos/:id/usuario` | Admin | Ver usuario del grupo |
| POST | `/api/grupos/:id/usuario` | Admin | Crear usuario para grupo |
| PUT | `/api/grupos/:id/usuario` | Admin | Cambiar contraseña |

### Centros de Atención
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/centros` | Admin | Listar con contactos y usuario |
| POST | `/api/centros` | Admin | Crear centro + usuario automático |
| PUT | `/api/centros/:id` | Admin | Editar centro y contactos |
| DELETE | `/api/centros/:id` | Admin | Eliminar (falla si tiene solicitudes) |
| PUT | `/api/centros/:id/usuario` | Admin | Regenerar contraseña |

### Solicitudes
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/solicitudes` | Auth | Listar (privileged: todas, grupo: solo las suyas) |
| GET | `/api/solicitudes/pendientes` | Privileged | Solicitudes sin actividad asignada |
| GET | `/api/solicitudes/mis-centro` | Centro | Solicitudes del centro autenticado |
| POST | `/api/solicitudes` | Auth | Crear solicitud (con items/insumos) |
| PUT | `/api/solicitudes/:id` | Auth | Editar (verifica propiedad) |
| DELETE | `/api/solicitudes/:id` | Privileged | Eliminar (falla si ya es actividad) |

### Insumos
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/insumos?q=&limit=` | Auth | Buscar en catálogo de insumos médicos |

### Actividades
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/actividades` | Auth | Listar (privileged: todas, grupo: solo las suyas) |
| POST | `/api/actividades` | Auth | Crear actividad desde solicitud existente (privileged: asigna a cualquiera) |
| POST | `/api/actividades/rapida` | Auth | Crear solicitud + actividad en un paso |
| PUT | `/api/actividades/:id` | Auth | Cambiar estado (Por ejecutar/En ejecución/Ejecutado) |
| PUT | `/api/actividades/:id/miembros` | Auth | Asignar miembros a actividad |

### Comentarios y Notificaciones
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/actividades/:id/comentarios` | Auth | Listar comentarios de actividad |
| POST | `/api/actividades/:id/comentarios` | Auth | Crear comentario (genera notificación) |
| GET | `/api/notificaciones` | Auth | Obtener notificaciones del usuario |
| PUT | `/api/notificaciones/:id/leer` | Auth | Marcar notificación como leída |
| POST | `/api/notificaciones/leer-todas` | Auth | Marcar todas como leídas |

---

## 8. Frontend — Estructura de Vistas

### Navegación por rol
- **Admin**: Tabs → Miembros y Grupos | Centros | Solicitudes | Actividades
- **Grupo**: Tabs → Mi Grupo | Mis Solicitudes | Mis Actividades
- **Centro**: Renderiza `VistaCentro.jsx` directamente (sin tabs de admin)

### Componentes principales
| Componente | Función |
|-----------|---------|
| `Login.jsx` | Pantalla de login con logo FacMed UCV |
| `ModuloMiembrosGrupos.jsx` | CRUD de miembros + CRUD de grupos. Admin ve todos, grupo ve solo los suyos. Modal con validaciones. |
| `ModuloCentros.jsx` | CRUD de centros de atención con contactos y mapa. Solo admin. |
| `ModuloSolicitudes.jsx` | CRUD de solicitudes con items/insumos, selector de solicitante, mapa. Prioridad Baja/Normal/Alta. |
| `ModuloActividades.jsx` | Tablero Kanban con 3 columnas. Cambio de estado drag-like (botones). Comentarios. Asignación de miembros. |
| `VistaCentro.jsx` | Vista completa para centros: pueden crear solicitudes, ver su mapa, ver insumos. |
| `PanelNotificaciones.jsx` | Dropdown de notificaciones con polling, marcar como leídas, navegar a actividad. |
| `MapaPicker.jsx` | Componente Leaflet para seleccionar lat/lng en un mapa interactivo. |

### API Client (`client.js`)
- Base URL configurable via `VITE_API_BASE_URL` (default: `/api`)
- Wrapper `req(method, path, body)` que:
  - Inyecta JWT desde localStorage
  - Dispara `session-expired` en 401
  - Retorna JSON parseado
  - Lanza Error con mensaje del backend

---

## 9. Validaciones (Venezuela-específicas)

Se implementan tanto en backend (`validaciones.py`) como en frontend (`validaciones.js`):

- **Cédula**: Formato `V-XXXXXXXX` o `E-XXXXXXXX` (6-8 dígitos). Si solo se ingresan dígitos, se normaliza agregando `V-`.
- **Teléfono**: 11 dígitos exactos. Prefijos válidos venezolanos (móviles: 0412, 0414, 0416, 0424, 0426; fijos: 02XX).
- **Email**: Validación básica de formato.
- **Cargos válidos**: Profesor, Estudiante, BR, Auxiliar, Voluntario.

---

## 10. Variables de Entorno

### Backend (`backend/.env`)
```
DATABASE_URL=postgresql://...    # Connection string Supabase
DB_SCHEMA=public                 # Esquema PostgreSQL (default: public)
JWT_SECRET=mesa-contingencia-secret-key-2026  # (default hardcoded)
```

### Frontend (`frontend/.env`)
```
VITE_API_URL=                    # URL del backend desplegado (vacío = /api proxy local)
```

---

## 11. Desarrollo Local

```bash
# Terminal 1 — Backend
cd backend
pip install -r requirements.txt
cp .env.example .env  # configurar DATABASE_URL
python run.py         # → http://localhost:5000

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev           # → http://localhost:5173 (proxy /api → :5000)
```

- Vite proxea `/api/*` a `http://localhost:5000` en desarrollo
- Health check: `http://localhost:5000/api/health`

---

## 12. Patrones y Convenciones del Código

### Backend
- **No usa ORM**: SQL directo con psycopg2 y `%s` placeholders
- **Patrón factory**: `create_app()` en `__init__.py`
- **Blueprint único**: `main_bp` registrado con prefijo implícito `/api/`
- **CORS manual**: Se aplica en `after_request` (no usa flask-cors realmente)
- **Conexiones**: Se abren y cierran en cada request (`get_connection()` / `conn.close()`)
- **Decoradores de auth**: `@require_auth` (cualquier usuario logueado), `@require_admin` (solo admin)
- **Auto-creación de usuarios**: Al crear grupo o centro se genera usuario automático con slug del nombre

### Frontend
- **Sin router**: Navegación por estado (`tab` en `App.jsx`)
- **Single CSS file**: Todo el estilo en `App.css`
- **AuthContext**: Provider global para auth state
- **api client**: Objeto `api` con métodos para cada endpoint
- **Componentes grandes**: Los módulos son archivos monolíticos (20-37KB) con estado local

---

## 13. Historial de Migraciones

El proyecto migró de **Azure SQL Server (MSSQL)** a **Supabase (PostgreSQL)**:
- `schema.sql` → esquema legacy MSSQL
- `schema_supabase.sql` → esquema actual PostgreSQL
- Múltiples scripts `migrate*.py` y `seed*.py` documentan las migraciones incrementales
- Driver cambió de `pymssql` a `psycopg2-binary`

---

## 14. Notas Importantes / Gotchas

1. **`password_plain` en BD**: Se almacena la contraseña en texto plano para que admin pueda verla. Esto es intencional para el caso de uso (mesa de contingencia interna, admin necesita distribuir credenciales).

2. **Logout es noop**: `logout_token()` está vacío. No hay blacklist de tokens. El JWT simplemente expira después de 8 horas.

3. **Solicitud → Actividad es 1:1**: Una solicitud solo puede tener una actividad. La validación impide duplicar.

4. **Insumos se auto-crean**: Si un item de solicitud refiere un nombre que no existe en el catálogo de insumos, se crea automáticamente.

5. **CORS permisivo**: El backend acepta cualquier origen (`Origin: *` o el origin real del request).

6. **Frontend sin build optimizations**: Un solo CSS monolítico y componentes grandes. No hay code splitting ni lazy loading.

7. **Mapas**: Usan Leaflet con tiles de OpenStreetMap. Centros y solicitudes pueden tener coordenadas lat/lng.

8. **Branches**: `main` es la rama principal. `dev` apunta al mismo commit que `main` actualmente.

---

## 15. Flujo de Negocio Principal

```
1. Admin crea Grupos de Trabajo
   └── Se auto-genera usuario para cada grupo

2. Admin crea Centros de Atención
   └── Se auto-genera usuario para cada centro

3. Admin/Grupo/Centro registra Miembros en sus grupos

4. Grupo o Centro crea Solicitud de emergencia
   ├── Describe la emergencia
   ├── Asigna prioridad (Baja/Normal/Alta)
   ├── Agrega items/insumos necesarios
   └── Opcionalmente marca ubicación en mapa

5. Admin revisa Solicitudes Pendientes
   └── Las asigna a un Grupo → se crea Actividad

   (O el grupo puede autoasignarse su propia solicitud)
   (O se usa "Actividad Rápida" para crear solicitud+actividad en un paso)

6. Grupo ejecuta la Actividad
   ├── Por ejecutar → En ejecución → Ejecutado
   ├── Asigna miembros del grupo a la actividad
   └── Admin y Grupo intercambian Comentarios

7. Sistema genera Notificaciones
   └── Se notifica al admin y al grupo cuando hay nuevos comentarios
```

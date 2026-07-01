# Panel de Publicaciones / Noticias

Agregar un módulo de noticias/publicaciones visible para admin, coordinadores y grupos. **Solo los privilegiados (admin + coordinadores)** pueden crear y eliminar publicaciones. Los centros **no** ven este módulo (sin cambios a `VistaCentro.jsx`). Las publicaciones se almacenan en BD con borrado lógico.

---

## Propuesta de Cambios

### Base de Datos

#### [NEW] Tabla `publicaciones` (migración SQL)

```sql
CREATE TABLE IF NOT EXISTS publicaciones (
    id              SERIAL PRIMARY KEY,
    descripcion     TEXT NOT NULL,
    autor_username  VARCHAR(100) NOT NULL,
    grupo_id        INT REFERENCES grupos_trabajo(id) ON DELETE SET NULL,
    eliminada       BOOLEAN DEFAULT FALSE,
    fecha_creacion  TIMESTAMPTZ DEFAULT NOW()
);
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | SERIAL PK | ID de publicación |
| `descripcion` | TEXT | Contenido de la publicación (max 2000 chars validado en backend y frontend) |
| `autor_username` | VARCHAR(100) | Nombre del usuario que publicó (sin FK, para que la publicación persista si se elimina el usuario) |
| `grupo_id` | INT FK → grupos_trabajo | Grupo desde donde se publicó (NULL si es admin) |
| `eliminada` | BOOLEAN | Borrado lógico (soft delete) |
| `fecha_creacion` | TIMESTAMPTZ | Fecha/hora de publicación |

> [!NOTE]
> Se usa `autor_username` como VARCHAR sin clave foránea intencionalmente: si el usuario se elimina, la publicación debe permanecer con el nombre del autor visible.

Se creará un script de migración `migrate_publicaciones.py` para ejecutar en Supabase, y se actualizará `schema_supabase.sql` para referencia.

---

### Backend

#### [NEW] [publicaciones.py](file:///home/onceavo/Escritorio/coordinacion_facultad_medicina_2026/mesadecontingencia/mesa-de-contingencia/backend/app/routes/publicaciones.py)

Nuevo módulo de rutas con 3 endpoints:

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/publicaciones` | `@require_auth` | Lista publicaciones activas (`eliminada = FALSE`), ordenadas por fecha DESC. JOIN con `grupos_trabajo` para incluir nombre del grupo. |
| `POST` | `/api/publicaciones` | `@require_privileged` | Crear publicación. Solo admin y coordinadores. Recibe `{ descripcion, autor_username }`. Valida max 2000 chars. Registra `grupo_id` del JWT. El `autor_username` viene del selector del frontend (miembro del grupo que publica). |
| `DELETE` | `/api/publicaciones/<id>` | `@require_privileged` | Borrado lógico: `SET eliminada = TRUE`. Cualquier admin/coordinador puede eliminar cualquier publicación. |

Patrón: mismo estilo que `comentarios.py` — SQL directo con psycopg2, `get_connection()`, decoradores de auth.

#### [MODIFY] [__init__.py](file:///home/onceavo/Escritorio/coordinacion_facultad_medicina_2026/mesadecontingencia/mesa-de-contingencia/backend/app/routes/__init__.py)

Agregar `publicaciones` al import del blueprint:

```diff
-from . import health, auth_routes, miembros, grupos, solicitudes, actividades, comentarios, centros, insumos  # noqa
+from . import health, auth_routes, miembros, grupos, solicitudes, actividades, comentarios, centros, insumos, publicaciones  # noqa
```

---

### Frontend

#### [NEW] [ModuloPublicaciones.jsx](file:///home/onceavo/Escritorio/coordinacion_facultad_medicina_2026/mesadecontingencia/mesa-de-contingencia/frontend/src/components/ModuloPublicaciones.jsx)

Componente nuevo con:

1. **Botón "Nueva Publicación"** (solo visible para `isPrivileged`) → abre un formulario inline/colapsable arriba
2. **Formulario**:
   - **Selector de autor**: dropdown con la lista de miembros del grupo del usuario logueado (carga via `api.getMiembros()`), para indicar *quién* del grupo está publicando. Si es admin sin grupo, se usa el username del admin directamente.
   - **Textarea** para `descripcion` (max 2000 chars, contador de caracteres visible, scroll interno si supera ~200px de alto)
   - Botón **"Publicar"** + botón **"Cancelar"**
3. **Lista de publicaciones**: cards con `descripcion`, nombre del grupo, nombre del autor, fecha formateada
4. **Botón eliminar** (soft-delete) en cada card, solo visible para privileged (cualquier admin/coordinador puede eliminar cualquier publicación)
5. Carga las publicaciones al montar con `useEffect` → `api.getPublicaciones()`
6. Sin cambios a `VistaCentro.jsx` — centros no ven este módulo

Diseño visual: cards con borde izquierdo dorado (`var(--gold)`) para transmitir que es información/anuncios. Descripción con scroll si supera cierta altura.

#### [MODIFY] [App.jsx](file:///home/onceavo/Escritorio/coordinacion_facultad_medicina_2026/mesadecontingencia/mesa-de-contingencia/frontend/src/App.jsx)

Agregar la pestaña "📢 Publicaciones" **después de Miembros y antes de Solicitudes**:

```diff
 const TABS_ADMIN = [
   { id: "miembros",      label: "👥 Miembros y Grupos" },
+  { id: "publicaciones", label: "📢 Publicaciones" },
   { id: "centros",       label: "🏥 Centros" },
   { id: "solicitudes",   label: "📥 Solicitudes" },
   { id: "actividades",   label: "📊 Actividades" },
 ];
 const TABS_GRUPO = [
   { id: "miembros",      label: "👤 Mi Grupo" },
+  { id: "publicaciones", label: "📢 Publicaciones" },
   { id: "solicitudes",   label: "📥 Mis Solicitudes" },
   { id: "actividades",   label: "📊 Mis Actividades" },
 ];
```

Agregar renderizado condicional en `<main>` e import del componente.

El tab por defecto se mantiene en `"solicitudes"`.

#### [MODIFY] [client.js](file:///home/onceavo/Escritorio/coordinacion_facultad_medicina_2026/mesadecontingencia/mesa-de-contingencia/frontend/src/api/client.js)

Agregar métodos al objeto `api`:

```diff
+  // Publicaciones
+  getPublicaciones: () => req("GET", "/publicaciones"),
+  crearPublicacion: (d) => req("POST", "/publicaciones", d),
+  eliminarPublicacion: (id) => req("DELETE", `/publicaciones/${id}`),
```

#### [MODIFY] [App.css](file:///home/onceavo/Escritorio/coordinacion_facultad_medicina_2026/mesadecontingencia/mesa-de-contingencia/frontend/src/App.css)

Agregar estilos para el módulo de publicaciones:
- `.pub-form` — formulario colapsable con textarea (max-height ~200px, overflow-y: auto para scroll)
- `.pub-char-count` — contador de caracteres (se vuelve rojo al acercarse al límite)
- `.pub-list` — lista de publicaciones
- `.pub-card` — card de publicación (borde izquierdo dorado, fondo suave)
- `.pub-card-header` — username + grupo + fecha
- `.pub-card-body` — contenido de la publicación (max-height con scroll si es muy largo)
- `.pub-btn-delete` — botón de eliminar sutil

Seguir el sistema de diseño existente: colores `var(--navy)`, `var(--gold)`, `var(--border)`, bordes redondeados, transiciones `.15s`.

---

### Migración y Esquema

#### [NEW] [migrate_publicaciones.py](file:///home/onceavo/Escritorio/coordinacion_facultad_medicina_2026/mesadecontingencia/mesa-de-contingencia/backend/migrate_publicaciones.py)

Script standalone para crear la tabla en Supabase (patrón igual a `migrate_coordinador.py`).

#### [MODIFY] [schema_supabase.sql](file:///home/onceavo/Escritorio/coordinacion_facultad_medicina_2026/mesadecontingencia/mesa-de-contingencia/backend/app/schema_supabase.sql)

Agregar la definición de la tabla `publicaciones` al esquema de referencia.

---

### Documentación

#### [MODIFY] [contexto.md](file:///home/onceavo/Escritorio/coordinacion_facultad_medicina_2026/mesadecontingencia/mesa-de-contingencia/contexto.md)

Actualizar el archivo de contexto con:
- Nueva tabla `publicaciones` en la sección 5 (Modelo de Datos)
- Nuevos endpoints en la sección 7 (API Endpoints)
- Nuevo componente `ModuloPublicaciones.jsx` en la sección 8 (Frontend)
- Nueva pestaña en la navegación por rol
- Actualizar fecha de última actualización

---

### Git y Despliegue

- Trabajar en la rama `dev` (ya activa)
- Commit al finalizar con mensaje: `feat: panel de publicaciones/noticias`
- No hacer merge a `main` hasta que se pruebe

---

## Verificación

### Pruebas Manuales
1. Levantar backend + frontend en local
2. Login como **admin** → verificar que el tab "Publicaciones" aparece después de Miembros, botón "Nueva Publicación" visible, crear una publicación, verificar que aparece en la lista, verificar que el botón eliminar funciona
3. Login como **coordinador** → mismo comportamiento que admin (puede crear y eliminar). Verificar que el selector de miembros del grupo aparece y funciona
4. Login como **grupo normal** → ver publicaciones, NO ver botón de crear ni eliminar
5. Login como **centro** → NO ver ningún panel de publicaciones (sin cambios a VistaCentro)
6. Verificar límite de 2000 caracteres (frontend bloquea, backend valida)
7. Verificar scroll en textarea y en cards largas
8. Soft-delete: eliminar una publicación → verificar que desaparece de la lista pero sigue en BD con `eliminada = TRUE`
9. Ejecutar migración SQL contra Supabase
10. Verificar que `contexto.md` está actualizado

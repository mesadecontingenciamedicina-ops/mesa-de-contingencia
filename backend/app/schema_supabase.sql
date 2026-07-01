-- Schema PostgreSQL para Mesa de Contingencia

-- Miembros
CREATE TABLE IF NOT EXISTS miembros (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(200) NOT NULL,
    cedula          VARCHAR(20),
    telefono        VARCHAR(50),
    tlf_alternativo VARCHAR(50),
    cargo           VARCHAR(150),
    email           VARCHAR(200),
    fecha_registro  TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_miembros_cedula
    ON miembros (cedula) WHERE cedula IS NOT NULL;

-- Grupos de trabajo
CREATE TABLE IF NOT EXISTS grupos_trabajo (
    id                         SERIAL PRIMARY KEY,
    nombre                     VARCHAR(200) NOT NULL,
    descripcion                VARCHAR(500),
    representante_principal_id INT,
    es_coordinador             BOOLEAN DEFAULT FALSE,
    fecha_creacion             TIMESTAMPTZ DEFAULT NOW()
);

-- Relación miembros ↔ grupos
CREATE TABLE IF NOT EXISTS miembros_grupos (
    miembro_id INT NOT NULL,
    grupo_id   INT NOT NULL,
    PRIMARY KEY (miembro_id, grupo_id)
);

-- Centros de atención
CREATE TABLE IF NOT EXISTS centros_atencion (
    id             SERIAL PRIMARY KEY,
    nombre         VARCHAR(200) NOT NULL,
    descripcion    VARCHAR(500),
    activo         BOOLEAN DEFAULT TRUE,
    direccion      VARCHAR(500),
    lat            DOUBLE PRECISION,
    lng            DOUBLE PRECISION,
    fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);

-- Contactos de centros
CREATE TABLE IF NOT EXISTS centro_contactos (
    id         SERIAL PRIMARY KEY,
    centro_id  INT NOT NULL REFERENCES centros_atencion(id),
    nombre     VARCHAR(200) NOT NULL,
    cargo      VARCHAR(150),
    telefono   VARCHAR(50),
    email      VARCHAR(200)
);

-- Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(100) NOT NULL UNIQUE,
    password_hash   VARCHAR(256) NOT NULL,
    password_plain  VARCHAR(100),
    rol             VARCHAR(50) NOT NULL DEFAULT 'grupo',
    grupo_id        INT,
    centro_id       INT,
    activo          BOOLEAN DEFAULT TRUE,
    session_version INT NOT NULL DEFAULT 1,
    fecha_creacion  TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT ck_usuario_rol CHECK (rol IN ('admin', 'grupo', 'centro'))
);

-- Solicitudes
CREATE TABLE IF NOT EXISTS solicitudes (
    id                   SERIAL PRIMARY KEY,
    descripcion          TEXT NOT NULL,
    creado_por_grupo_id  INT,
    creado_por_centro_id INT,
    solicitante_id       INT,
    ubicacion            VARCHAR(500),
    fecha_hora           TIMESTAMPTZ,
    prioridad            VARCHAR(20) DEFAULT 'Normal',
    lat                  DOUBLE PRECISION,
    lng                  DOUBLE PRECISION,
    fecha_creacion       TIMESTAMPTZ DEFAULT NOW(),
    fecha_actualizacion  TIMESTAMPTZ,
    CONSTRAINT ck_sol_prioridad CHECK (prioridad IN ('Baja', 'Normal', 'Alta'))
);

-- Catálogo de insumos
CREATE TABLE IF NOT EXISTS insumos (
    id                  SERIAL PRIMARY KEY,
    codigo              INT,
    nombre              VARCHAR(200),
    forma_farmaceutica  VARCHAR(100),
    concentracion       VARCHAR(100),
    volumen_peso        VARCHAR(100),
    disponibilidad      SMALLINT,
    prioridad           SMALLINT,
    precio_referencial  DECIMAL(10,4),
    fabricacion         SMALLINT,
    observacion         VARCHAR(500)
);

-- Items de solicitudes
CREATE TABLE IF NOT EXISTS solicitud_items (
    id           SERIAL PRIMARY KEY,
    solicitud_id INT NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
    insumo_id    INT REFERENCES insumos(id),
    nombre       VARCHAR(200) NOT NULL,
    cantidad     INT NOT NULL DEFAULT 1
);

-- Actividades (Kanban)
CREATE TABLE IF NOT EXISTS actividades (
    id                  SERIAL PRIMARY KEY,
    solicitud_id        INT NOT NULL REFERENCES solicitudes(id),
    grupo_id            INT NOT NULL REFERENCES grupos_trabajo(id),
    estado              VARCHAR(50) NOT NULL DEFAULT 'Por ejecutar',
    fecha_asignacion    TIMESTAMPTZ DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT ck_act_estado CHECK (estado IN ('Por ejecutar', 'En ejecución', 'Ejecutado'))
);

-- Miembros asignados a actividades
CREATE TABLE IF NOT EXISTS actividad_miembros (
    actividad_id INT NOT NULL REFERENCES actividades(id) ON DELETE CASCADE,
    miembro_id   INT NOT NULL REFERENCES miembros(id) ON DELETE CASCADE,
    PRIMARY KEY (actividad_id, miembro_id)
);

-- Comentarios
CREATE TABLE IF NOT EXISTS actividad_comentarios (
    id              SERIAL PRIMARY KEY,
    actividad_id    INT NOT NULL REFERENCES actividades(id) ON DELETE CASCADE,
    autor_username  VARCHAR(100),
    autor_rol       VARCHAR(50),
    grupo_id        INT,
    texto           TEXT NOT NULL,
    fecha_creacion  TIMESTAMPTZ DEFAULT NOW()
);

-- Notificaciones
CREATE TABLE IF NOT EXISTS notificaciones (
    id             SERIAL PRIMARY KEY,
    para_rol       VARCHAR(50) NOT NULL,
    para_grupo_id  INT,
    actividad_id   INT REFERENCES actividades(id) ON DELETE CASCADE,
    comentario_id  INT,
    texto          VARCHAR(500) NOT NULL,
    leida          BOOLEAN DEFAULT FALSE,
    fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);

-- Foreign keys diferidas
ALTER TABLE grupos_trabajo
    ADD CONSTRAINT fk_grupo_representante
    FOREIGN KEY (representante_principal_id) REFERENCES miembros(id);

ALTER TABLE miembros_grupos
    ADD CONSTRAINT fk_mg_miembro FOREIGN KEY (miembro_id) REFERENCES miembros(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_mg_grupo   FOREIGN KEY (grupo_id)   REFERENCES grupos_trabajo(id) ON DELETE CASCADE;

ALTER TABLE solicitudes
    ADD CONSTRAINT fk_sol_grupo  FOREIGN KEY (creado_por_grupo_id)  REFERENCES grupos_trabajo(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_sol_centro FOREIGN KEY (creado_por_centro_id) REFERENCES centros_atencion(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_sol_solicitante FOREIGN KEY (solicitante_id)  REFERENCES miembros(id) ON DELETE SET NULL;

ALTER TABLE usuarios
    ADD CONSTRAINT fk_usr_grupo  FOREIGN KEY (grupo_id)  REFERENCES grupos_trabajo(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_usr_centro FOREIGN KEY (centro_id) REFERENCES centros_atencion(id) ON DELETE SET NULL;

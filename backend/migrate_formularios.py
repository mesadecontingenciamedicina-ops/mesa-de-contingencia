"""Migración: Formularios y Respuestas para el módulo de encuestas dinámicas."""
from app.db import get_connection

def _exec(cur, conn, sql, label):
    try:
        cur.execute(sql)
        conn.commit()
        print(f"OK: {label}")
    except Exception as e:
        conn.rollback()
        print(f"SKIP: {label} -> {e}")

def crear_tablas(cur, conn):
    _exec(cur, conn, """
        CREATE TABLE IF NOT EXISTS formularios (
            id             SERIAL PRIMARY KEY,
            creado_por_rol VARCHAR(50) NOT NULL,
            grupo_id       INT REFERENCES grupos_trabajo(id) ON DELETE CASCADE,
            centro_id      INT REFERENCES centros_atencion(id) ON DELETE CASCADE,
            titulo         VARCHAR(200) NOT NULL,
            configuracion  JSONB NOT NULL DEFAULT '[]'::jsonb,
            estado         VARCHAR(50) NOT NULL DEFAULT 'Pendiente',
            token_publico  UUID UNIQUE,
            fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT ck_form_rol CHECK (creado_por_rol IN ('admin', 'grupo', 'centro')),
            CONSTRAINT ck_form_estado CHECK (estado IN ('Pendiente', 'Aprobado', 'Rechazado'))
        )
    """, "crear tabla formularios")

    _exec(cur, conn, """
        CREATE TABLE IF NOT EXISTS formulario_respuestas (
            id             SERIAL PRIMARY KEY,
            formulario_id  INT NOT NULL REFERENCES formularios(id) ON DELETE CASCADE,
            respuestas     JSONB NOT NULL DEFAULT '{}'::jsonb,
            lat            DOUBLE PRECISION,
            lng            DOUBLE PRECISION,
            fecha_creacion TIMESTAMPTZ DEFAULT NOW()
        )
    """, "crear tabla formulario_respuestas")

def run():
    conn = get_connection()
    cur = conn.cursor()
    crear_tablas(cur, conn)
    conn.close()
    print("Listo.")

if __name__ == "__main__":
    run()

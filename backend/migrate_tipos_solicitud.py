"""Migración: clasificación normalizada de Solicitudes (ver plan de clasificación
de tipos de solicitud, 2026-07-02).

Crea el catálogo `tipos_solicitud` (Grupo/Centro/Administración/Externos) y la
columna `solicitudes.tipo_solicitud_id`, y hace backfill de las filas existentes.
Estrategia aditiva: no toca ninguna columna ni tabla existente.
Ejecutar de nuevo es seguro (cada paso se salta si ya existe).

Uso: DB_SCHEMA=dev python migrate_tipos_solicitud.py
"""
from app.db import get_connection


def _exec(cur, conn, sql, label):
    try:
        cur.execute(sql)
        conn.commit()
        print(f"OK: {label}")
    except Exception as e:
        conn.rollback()
        print(f"SKIP: {label} -> {e}")


def crear_tabla_y_columna(cur, conn):
    _exec(cur, conn, """
        CREATE TABLE IF NOT EXISTS tipos_solicitud (
            id     SERIAL PRIMARY KEY,
            nombre VARCHAR(50) NOT NULL UNIQUE
        )
    """, "crear tabla tipos_solicitud")

    _exec(cur, conn, """
        INSERT INTO tipos_solicitud (nombre)
        VALUES ('Grupo'), ('Centro'), ('Administración'), ('Externos')
        ON CONFLICT (nombre) DO NOTHING
    """, "seed tipos_solicitud")

    _exec(cur, conn,
          "ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS tipo_solicitud_id INT REFERENCES tipos_solicitud(id)",
          "solicitudes.tipo_solicitud_id")


def backfill_datos_existentes(cur, conn):
    cur.execute("""
        UPDATE solicitudes s SET tipo_solicitud_id = CASE
            WHEN s.creado_por_grupo_id  IS NOT NULL THEN (SELECT id FROM tipos_solicitud WHERE nombre = 'Grupo')
            WHEN s.creado_por_centro_id IS NOT NULL THEN (SELECT id FROM tipos_solicitud WHERE nombre = 'Centro')
            WHEN EXISTS (
                SELECT 1 FROM solicitud_log l
                WHERE l.solicitud_id = s.id AND l.evento = 'creada' AND l.rol IS NOT NULL AND l.rol <> 'admin'
            ) THEN (SELECT id FROM tipos_solicitud WHERE nombre = 'Externos')
            ELSE (SELECT id FROM tipos_solicitud WHERE nombre = 'Administración')
        END
        WHERE s.tipo_solicitud_id IS NULL
    """)
    conn.commit()
    print(f"OK: {cur.rowcount} solicitudes con tipo_solicitud_id asignado")

    _exec(cur, conn,
          "ALTER TABLE solicitudes ALTER COLUMN tipo_solicitud_id SET NOT NULL",
          "solicitudes.tipo_solicitud_id NOT NULL")


def run():
    conn = get_connection()
    cur = conn.cursor()
    crear_tabla_y_columna(cur, conn)
    backfill_datos_existentes(cur, conn)
    conn.close()
    print("Listo.")


if __name__ == "__main__":
    run()

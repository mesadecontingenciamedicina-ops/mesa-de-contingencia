"""Migración: separar Tareas y Solicitudes (ver plan-tareas-solicitudes.md).

Estrategia "en paralelo": crea tablas/columnas nuevas sin tocar ni romper
las tablas viejas (actividades, actividad_miembros, actividad_comentarios).
Ejecutar de nuevo es seguro (cada paso se salta si ya existe).

Uso: python migrate_tareas_solicitudes.py
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


def crear_tablas_y_columnas(cur, conn):
    _exec(cur, conn, """
        CREATE TABLE IF NOT EXISTS tareas (
            id                  SERIAL PRIMARY KEY,
            descripcion         TEXT NOT NULL,
            grupo_id            INT NOT NULL REFERENCES grupos_trabajo(id),
            creado_por_rol      VARCHAR(50),
            creado_por_username VARCHAR(100),
            ubicacion           VARCHAR(500),
            fecha_hora          TIMESTAMPTZ,
            prioridad           VARCHAR(20) DEFAULT 'Normal',
            lat                 DOUBLE PRECISION,
            lng                 DOUBLE PRECISION,
            estado              VARCHAR(50) NOT NULL DEFAULT 'Por ejecutar',
            archivada           BOOLEAN DEFAULT FALSE,
            solicitud_origen_id INT,
            fecha_asignacion    TIMESTAMPTZ DEFAULT NOW(),
            fecha_actualizacion TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT ck_tarea_estado CHECK (estado IN ('Por ejecutar', 'En ejecución', 'Ejecutado'))
        )
    """, "crear tabla tareas")

    _exec(cur, conn, """
        CREATE TABLE IF NOT EXISTS tarea_miembros (
            tarea_id   INT NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
            miembro_id INT NOT NULL REFERENCES miembros(id) ON DELETE CASCADE,
            PRIMARY KEY (tarea_id, miembro_id)
        )
    """, "crear tabla tarea_miembros")

    _exec(cur, conn, """
        CREATE TABLE IF NOT EXISTS tarea_comentarios (
            id              SERIAL PRIMARY KEY,
            tarea_id        INT NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
            autor_username  VARCHAR(100),
            autor_rol       VARCHAR(50),
            grupo_id        INT,
            texto           TEXT NOT NULL,
            fecha_creacion  TIMESTAMPTZ DEFAULT NOW()
        )
    """, "crear tabla tarea_comentarios")

    _exec(cur, conn, """
        CREATE TABLE IF NOT EXISTS solicitud_item_aportes (
            id             SERIAL PRIMARY KEY,
            item_id        INT NOT NULL REFERENCES solicitud_items(id) ON DELETE CASCADE,
            grupo_id       INT NOT NULL REFERENCES grupos_trabajo(id),
            cantidad       INT NOT NULL,
            comentario     TEXT,
            fecha_creacion TIMESTAMPTZ DEFAULT NOW()
        )
    """, "crear tabla solicitud_item_aportes")

    _exec(cur, conn, """
        CREATE TABLE IF NOT EXISTS solicitud_log (
            id             SERIAL PRIMARY KEY,
            solicitud_id   INT NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
            evento         VARCHAR(50) NOT NULL,
            usuario        VARCHAR(100),
            rol            VARCHAR(50),
            detalle        TEXT,
            fecha_creacion TIMESTAMPTZ DEFAULT NOW()
        )
    """, "crear tabla solicitud_log")

    _exec(cur, conn,
          "ALTER TABLE solicitud_items ADD COLUMN IF NOT EXISTS cantidad_flexible BOOLEAN DEFAULT FALSE",
          "solicitud_items.cantidad_flexible")

    for columna, definicion in [
        ("estado", "VARCHAR(20) NOT NULL DEFAULT 'Pendiente'"),
        ("receptor_nombre", "VARCHAR(200)"),
        ("receptor_telefono", "VARCHAR(50)"),
        ("reclamado_por_grupo_id", "INT REFERENCES grupos_trabajo(id)"),
        ("reclamado_en", "TIMESTAMPTZ"),
        ("aprobado_por_username", "VARCHAR(100)"),
        ("aprobado_en", "TIMESTAMPTZ"),
        ("rechazo_motivo", "TEXT"),
    ]:
        _exec(cur, conn,
              f"ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS {columna} {definicion}",
              f"solicitudes.{columna}")

    _exec(cur, conn, """
        ALTER TABLE solicitudes ADD CONSTRAINT ck_sol_estado
        CHECK (estado IN ('Pendiente', 'Aprobada', 'Rechazada', 'Resuelta'))
    """, "constraint ck_sol_estado")

    _exec(cur, conn,
          "ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS tarea_id INT REFERENCES tareas(id) ON DELETE CASCADE",
          "notificaciones.tarea_id")
    _exec(cur, conn,
          "ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS solicitud_id INT REFERENCES solicitudes(id) ON DELETE CASCADE",
          "notificaciones.solicitud_id")


def migrar_datos_historicos(cur, conn):
    """Copia actividades -> tareas (heredando datos de su solicitud) y pone
    todas las solicitudes en estado Pendiente. Es seguro re-ejecutar: usa
    solicitud_origen_id para no duplicar tareas ya migradas."""

    cur.execute("SELECT to_regclass('actividades')")
    if not cur.fetchone()[0]:
        print("SKIP: migración de datos (tabla actividades no existe, nada que migrar)")
        return

    cur.execute("""
        SELECT a.id, a.grupo_id, a.estado, a.archivada, a.fecha_asignacion, a.fecha_actualizacion,
               s.id, s.descripcion, s.ubicacion, s.fecha_hora, s.prioridad, s.lat, s.lng
        FROM actividades a
        JOIN solicitudes s ON s.id = a.solicitud_id
        WHERE NOT EXISTS (SELECT 1 FROM tareas t WHERE t.solicitud_origen_id = a.id)
    """)
    actividades = cur.fetchall()
    print(f"Migrando {len(actividades)} actividades -> tareas...")

    for (act_id, grupo_id, estado, archivada, f_asig, f_act,
         sol_id, descripcion, ubicacion, fecha_hora, prioridad, lat, lng) in actividades:
        cur.execute("""
            INSERT INTO tareas
                (descripcion, grupo_id, creado_por_rol, ubicacion, fecha_hora, prioridad,
                 lat, lng, estado, archivada, solicitud_origen_id, fecha_asignacion, fecha_actualizacion)
            VALUES (%s, %s, 'migracion', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (descripcion, grupo_id, ubicacion, fecha_hora, prioridad, lat, lng,
              estado, archivada, act_id, f_asig, f_act))
        nueva_tarea_id = cur.fetchone()[0]

        cur.execute("""
            INSERT INTO tarea_miembros (tarea_id, miembro_id)
            SELECT %s, miembro_id FROM actividad_miembros WHERE actividad_id = %s
        """, (nueva_tarea_id, act_id))

        cur.execute("""
            INSERT INTO tarea_comentarios (tarea_id, autor_username, autor_rol, grupo_id, texto, fecha_creacion)
            SELECT %s, autor_username, autor_rol, grupo_id, texto, fecha_creacion
            FROM actividad_comentarios WHERE actividad_id = %s
        """, (nueva_tarea_id, act_id))

        conn.commit()

    cur.execute("UPDATE solicitudes SET estado = 'Pendiente'")
    conn.commit()
    print(f"OK: {cur.rowcount} solicitudes puestas en estado Pendiente")


def run():
    conn = get_connection()
    cur = conn.cursor()
    crear_tablas_y_columnas(cur, conn)
    migrar_datos_historicos(cur, conn)
    conn.close()
    print("Listo.")


if __name__ == "__main__":
    run()

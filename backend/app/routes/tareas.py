from flask import request, jsonify
from . import main_bp
from ..db import get_connection
from ..auth import require_auth, is_privileged, get_current_user

ESTADOS = ["Por ejecutar", "En ejecución", "Ejecutado"]
PRIORIDADES = ["Baja", "Normal", "Alta"]


def _parse_fecha(valor):
    from datetime import datetime
    if not valor:
        return None
    for fmt in ("%Y-%m-%dT%H:%M", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(valor, fmt)
        except ValueError:
            continue
    return None


@main_bp.post("/api/tareas")
@require_auth
def crear_tarea():
    user = get_current_user()
    if user["rol"] == "centro":
        return jsonify({"error": "Los centros no gestionan tareas"}), 403

    data = request.get_json() or {}
    descripcion = (data.get("descripcion") or "").strip()
    if not descripcion:
        return jsonify({"error": "La descripción es obligatoria"}), 400

    grupo_id = data.get("grupo_id")
    if not is_privileged(user):
        # Un grupo solo puede crear tareas para sí mismo
        grupo_id = user["grupo_id"]
    elif not grupo_id:
        return jsonify({"error": "El grupo es obligatorio"}), 400

    prioridad = data.get("prioridad", "Normal")
    if prioridad not in PRIORIDADES:
        prioridad = "Normal"

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO tareas
            (descripcion, grupo_id, creado_por_rol, creado_por_username,
             ubicacion, fecha_hora, prioridad, lat, lng, estado)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'Por ejecutar')
        RETURNING id
    """, (descripcion, grupo_id, user["rol"], user["username"],
          data.get("ubicacion") or None, _parse_fecha(data.get("fecha_hora")),
          prioridad, data.get("lat") or None, data.get("lng") or None))
    new_id = cur.fetchone()[0]
    conn.commit()
    conn.close()
    return jsonify({"id": new_id, "estado": "Por ejecutar"}), 201


@main_bp.put("/api/tareas/<int:tarea_id>")
@require_auth
def actualizar_tarea(tarea_id):
    user = get_current_user()
    data = request.get_json() or {}
    nuevo_estado = data.get("estado")
    nueva_descripcion = (data.get("descripcion") or "").strip() or None

    # Validar estado solo si se envió
    if nuevo_estado is not None and nuevo_estado not in ESTADOS:
        return jsonify({"error": f"Estado inválido. Valores: {ESTADOS}"}), 400

    # Debe enviarse al menos uno de los dos campos
    if nuevo_estado is None and nueva_descripcion is None:
        return jsonify({"error": "Se requiere 'estado' o 'descripcion'"}), 400

    conn = get_connection()
    cur = conn.cursor()
    if not is_privileged(user) and user["rol"] == "grupo":
        cur.execute("SELECT grupo_id FROM tareas WHERE id = %s", (tarea_id,))
        row = cur.fetchone()
        if not row or row[0] != user["grupo_id"]:
            conn.close()
            return jsonify({"error": "Acceso denegado"}), 403

    if nuevo_estado is not None and nueva_descripcion is not None:
        cur.execute("""
            UPDATE tareas SET estado = %s, descripcion = %s, fecha_actualizacion = NOW() WHERE id = %s
        """, (nuevo_estado, nueva_descripcion, tarea_id))
    elif nuevo_estado is not None:
        cur.execute("""
            UPDATE tareas SET estado = %s, fecha_actualizacion = NOW() WHERE id = %s
        """, (nuevo_estado, tarea_id))
    else:
        cur.execute("""
            UPDATE tareas SET descripcion = %s, fecha_actualizacion = NOW() WHERE id = %s
        """, (nueva_descripcion, tarea_id))

    conn.commit()
    conn.close()
    return jsonify({"id": tarea_id, "estado": nuevo_estado, "descripcion": nueva_descripcion})


@main_bp.put("/api/tareas/<int:tarea_id>/miembros")
@require_auth
def set_miembros_tarea(tarea_id):
    user = get_current_user()
    data = request.get_json() or {}
    miembro_ids = data.get("miembro_ids", [])
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT grupo_id FROM tareas WHERE id = %s", (tarea_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Tarea no encontrada"}), 404
    if not is_privileged(user) and user["rol"] == "grupo" and row[0] != user["grupo_id"]:
        conn.close()
        return jsonify({"error": "Acceso denegado"}), 403
    cur.execute("DELETE FROM tarea_miembros WHERE tarea_id = %s", (tarea_id,))
    for mid in miembro_ids:
        cur.execute("INSERT INTO tarea_miembros (tarea_id, miembro_id) VALUES (%s, %s)", (tarea_id, mid))
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "miembro_ids": miembro_ids})


@main_bp.get("/api/tareas")
@require_auth
def listar_tareas():
    user = get_current_user()
    if user["rol"] == "centro":
        return jsonify({"error": "Los centros no gestionan tareas"}), 403
    conn = get_connection()
    cur = conn.cursor()
    base = """
        SELECT t.id, t.estado, t.fecha_asignacion, t.fecha_actualizacion,
               t.descripcion, t.ubicacion, t.fecha_hora, t.prioridad, t.lat, t.lng,
               g.id, g.nombre, m.nombre AS rep_nombre
        FROM tareas t
        JOIN grupos_trabajo g ON g.id = t.grupo_id
        LEFT JOIN miembros m  ON m.id  = g.representante_principal_id
    """
    if is_privileged(user):
        cur.execute(base + " WHERE t.archivada = FALSE ORDER BY t.fecha_actualizacion DESC")
    else:
        cur.execute(base + " WHERE t.archivada = FALSE AND t.grupo_id = %s ORDER BY t.fecha_actualizacion DESC",
                    (user["grupo_id"],))
    tareas = {r[0]: {
        "id": r[0], "estado": r[1],
        "fecha_asignacion": str(r[2]), "fecha_actualizacion": str(r[3]),
        "descripcion": r[4], "ubicacion": r[5],
        "fecha_hora": str(r[6]) if r[6] else None,
        "prioridad": r[7] or "Normal", "lat": r[8], "lng": r[9],
        "grupo": {"id": r[10], "nombre": r[11], "representante": r[12]},
        "miembros": []
    } for r in cur.fetchall()}

    if tareas:
        cur.execute(f"""
            SELECT tm.tarea_id, m.id, m.nombre, m.cargo
            FROM tarea_miembros tm
            JOIN miembros m ON m.id = tm.miembro_id
            WHERE tm.tarea_id IN ({",".join(str(k) for k in tareas)})
        """)
        for r in cur.fetchall():
            if r[0] in tareas:
                tareas[r[0]]["miembros"].append({"id": r[1], "nombre": r[2], "cargo": r[3]})

    conn.close()
    return jsonify(list(tareas.values()))


@main_bp.delete("/api/tareas/<int:tarea_id>")
@require_auth
def archivar_tarea(tarea_id):
    """Soft-delete: marca la tarea como archivada. Sin efectos secundarios en solicitudes."""
    user = get_current_user()
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT grupo_id FROM tareas WHERE id = %s AND archivada = FALSE", (tarea_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Tarea no encontrada"}), 404
    if not is_privileged(user) and user["rol"] == "grupo" and row[0] != user["grupo_id"]:
        conn.close()
        return jsonify({"error": "Acceso denegado"}), 403
    cur.execute("UPDATE tareas SET archivada = TRUE WHERE id = %s", (tarea_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@main_bp.get("/api/tareas/<int:tarea_id>/comentarios")
@require_auth
def get_comentarios_tarea(tarea_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, autor_username, autor_rol, grupo_id, texto, fecha_creacion
        FROM tarea_comentarios
        WHERE tarea_id = %s
        ORDER BY fecha_creacion ASC
    """, (tarea_id,))
    rows = [{"id": r[0], "autor": r[1], "rol": r[2], "grupo_id": r[3],
             "texto": r[4], "fecha": str(r[5])} for r in cur.fetchall()]
    conn.close()
    return jsonify(rows)


@main_bp.post("/api/tareas/<int:tarea_id>/comentarios")
@require_auth
def crear_comentario_tarea(tarea_id):
    user = get_current_user()
    data = request.get_json() or {}
    texto = (data.get("texto") or "").strip()
    if not texto:
        return jsonify({"error": "El comentario no puede estar vacío"}), 400

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT grupo_id FROM tareas WHERE id = %s", (tarea_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Tarea no encontrada"}), 404
    grupo_tarea_id = row[0]

    cur.execute("""
        INSERT INTO tarea_comentarios
            (tarea_id, autor_username, autor_rol, grupo_id, texto)
        VALUES (%s, %s, %s, %s, %s) RETURNING id, fecha_creacion
    """, (tarea_id, user["username"], user["rol"], user.get("grupo_id"), texto))
    nuevo = cur.fetchone()
    nuevo_id, fecha = nuevo[0], str(nuevo[1])

    notif_texto = f"💬 {user['username']}: {texto[:120]}"

    cur.execute("""
        INSERT INTO notificaciones (para_rol, para_grupo_id, tarea_id, comentario_id, texto)
        VALUES ('admin', NULL, %s, %s, %s)
    """, (tarea_id, nuevo_id, notif_texto))

    if user["rol"] == "admin" or (user["rol"] == "grupo" and user.get("grupo_id") != grupo_tarea_id):
        cur.execute("""
            INSERT INTO notificaciones (para_rol, para_grupo_id, tarea_id, comentario_id, texto)
            VALUES ('grupo', %s, %s, %s, %s)
        """, (grupo_tarea_id, tarea_id, nuevo_id, notif_texto))

    conn.commit()
    conn.close()
    return jsonify({"id": nuevo_id, "autor": user["username"], "rol": user["rol"],
                    "texto": texto, "fecha": fecha}), 201

from flask import request, jsonify
from . import main_bp
from ..db import get_connection
from ..auth import require_auth, require_admin, is_privileged, get_current_user

ESTADOS = ["Por ejecutar", "En ejecución", "Ejecutado"]

@main_bp.post("/api/actividades")
@require_auth
def crear_actividad():
    user = get_current_user()
    data = request.get_json() or {}
    solicitud_id = data.get("solicitud_id")
    grupo_id = data.get("grupo_id")
    if not solicitud_id or not grupo_id:
        return jsonify({"error": "solicitud_id y grupo_id requeridos"}), 400
    if not is_privileged(user) and user["rol"] == "grupo" and int(grupo_id) != user["grupo_id"]:
        return jsonify({"error": "Solo puedes asignar actividades a tu propio grupo"}), 403
    conn = get_connection()
    cur = conn.cursor()
    if not is_privileged(user) and user["rol"] == "grupo":
        cur.execute(f"SELECT creado_por_grupo_id FROM solicitudes WHERE id = %s", (solicitud_id,))
        row = cur.fetchone()
        if not row or row[0] != user["grupo_id"]:
            conn.close()
            return jsonify({"error": "Solo puedes autoasignarte tus propias solicitudes"}), 403
    cur.execute(f"SELECT id FROM actividades WHERE solicitud_id = %s AND archivada = FALSE", (solicitud_id,))
    if cur.fetchone():
        conn.close()
        return jsonify({"error": "Esta solicitud ya fue asignada"}), 409
    cur.execute(f"""
        INSERT INTO actividades (solicitud_id, grupo_id, estado)
        VALUES (%s, %s, 'Por ejecutar') RETURNING id
    """, (solicitud_id, grupo_id))
    new_id = cur.fetchone()[0]
    conn.commit()
    conn.close()
    return jsonify({"id": new_id, "estado": "Por ejecutar"}), 201

@main_bp.post("/api/actividades/rapida")
@require_auth
def crear_actividad_rapida():
    """Crea solicitud + actividad en un solo paso."""
    user = get_current_user()
    data = request.get_json() or {}
    descripcion = (data.get("descripcion") or "").strip()
    grupo_id = data.get("grupo_id")
    if not descripcion:
        return jsonify({"error": "La descripción es obligatoria"}), 400
    if not grupo_id:
        return jsonify({"error": "El grupo es obligatorio"}), 400
    if not is_privileged(user) and user["rol"] == "grupo" and int(grupo_id) != user["grupo_id"]:
        return jsonify({"error": "Solo puedes crear actividades para tu propio grupo"}), 403

    from datetime import datetime
    def _parse_fecha(v):
        if not v: return None
        for fmt in ("%Y-%m-%dT%H:%M", "%Y-%m-%dT%H:%M:%S"):
            try: return datetime.strptime(v, fmt)
            except ValueError: pass
        return None

    prioridad = data.get("prioridad", "Normal")
    if prioridad not in ["Baja", "Normal", "Alta"]:
        prioridad = "Normal"

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(f"""
        INSERT INTO solicitudes
            (descripcion, creado_por_grupo_id, ubicacion, fecha_hora, prioridad, lat, lng, solicitante_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, NULL) RETURNING id
    """, (descripcion, grupo_id,
          data.get("ubicacion") or None,
          _parse_fecha(data.get("fecha_hora")),
          prioridad,
          data.get("lat") or None, data.get("lng") or None))
    solicitud_id = cur.fetchone()[0]

    cur.execute(f"""
        INSERT INTO actividades (solicitud_id, grupo_id, estado)
        VALUES (%s, %s, 'Por ejecutar') RETURNING id
    """, (solicitud_id, grupo_id))
    act_id = cur.fetchone()[0]
    conn.commit()
    conn.close()
    return jsonify({"id": act_id, "solicitud_id": solicitud_id, "estado": "Por ejecutar"}), 201


@main_bp.put("/api/actividades/<int:act_id>")
@require_auth
def actualizar_actividad(act_id):
    user = get_current_user()
    data = request.get_json() or {}
    nuevo_estado = data.get("estado")
    if nuevo_estado not in ESTADOS:
        return jsonify({"error": f"Estado inválido. Valores: {ESTADOS}"}), 400
    conn = get_connection()
    cur = conn.cursor()
    if not is_privileged(user) and user["rol"] == "grupo":
        cur.execute(f"SELECT grupo_id FROM actividades WHERE id = %s", (act_id,))
        row = cur.fetchone()
        if not row or row[0] != user["grupo_id"]:
            conn.close()
            return jsonify({"error": "Acceso denegado"}), 403
    cur.execute(f"""
        UPDATE actividades
        SET estado = %s, fecha_actualizacion = NOW() WHERE id = %s
    """, (nuevo_estado, act_id))
    conn.commit()
    conn.close()
    return jsonify({"id": act_id, "estado": nuevo_estado})

@main_bp.put("/api/actividades/<int:act_id>/miembros")
@require_auth
def set_miembros_actividad(act_id):
    user = get_current_user()
    data = request.get_json() or {}
    miembro_ids = data.get("miembro_ids", [])
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(f"SELECT grupo_id FROM actividades WHERE id = %s", (act_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Actividad no encontrada"}), 404
    if not is_privileged(user) and user["rol"] == "grupo" and row[0] != user["grupo_id"]:
        conn.close()
        return jsonify({"error": "Acceso denegado"}), 403
    cur.execute(f"DELETE FROM actividad_miembros WHERE actividad_id = %s", (act_id,))
    for mid in miembro_ids:
        cur.execute(f"INSERT INTO actividad_miembros (actividad_id, miembro_id) VALUES (%s, %s)", (act_id, mid))
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "miembro_ids": miembro_ids})

@main_bp.get("/api/actividades")
@require_auth
def listar_actividades():
    user = get_current_user()
    conn = get_connection()
    cur = conn.cursor()
    base = f"""
        SELECT a.id, a.estado, a.fecha_asignacion, a.fecha_actualizacion,
               s.id, s.descripcion, s.ubicacion, s.fecha_hora, s.prioridad, s.lat, s.lng,
               ms.nombre, ms.telefono, ms.email,
               g.id, g.nombre, m.nombre AS rep_nombre
        FROM actividades a
        JOIN solicitudes s ON s.id = a.solicitud_id
        JOIN grupos_trabajo g ON g.id = a.grupo_id
        LEFT JOIN miembros m  ON m.id  = g.representante_principal_id
        LEFT JOIN miembros ms ON ms.id = s.solicitante_id
    """
    if is_privileged(user):
        cur.execute(base + " WHERE a.archivada = FALSE ORDER BY a.fecha_actualizacion DESC")
    else:
        cur.execute(base + " WHERE a.archivada = FALSE AND a.grupo_id = %s ORDER BY a.fecha_actualizacion DESC", (user["grupo_id"],))
    actividades = {r[0]: {
        "id": r[0], "estado": r[1],
        "fecha_asignacion": str(r[2]), "fecha_actualizacion": str(r[3]),
        "solicitud": {
            "id": r[4], "descripcion": r[5],
            "ubicacion": r[6],
            "fecha_hora": str(r[7]) if r[7] else None,
            "prioridad": r[8] or "Normal",
            "lat": r[9], "lng": r[10],
            "solicitante_nombre": r[11],
            "solicitante_telefono": r[12],
            "solicitante_email": r[13],
        },
        "grupo": {"id": r[14], "nombre": r[15], "representante": r[16]},
        "miembros": []
    } for r in cur.fetchall()}

    if actividades:
        cur.execute(f"""
            SELECT am.actividad_id, m.id, m.nombre, m.cargo
            FROM actividad_miembros am
            JOIN miembros m ON m.id = am.miembro_id
            WHERE am.actividad_id IN ({",".join(str(k) for k in actividades)})
        """)
        for r in cur.fetchall():
            if r[0] in actividades:
                actividades[r[0]]["miembros"].append({"id": r[1], "nombre": r[2], "cargo": r[3]})

    conn.close()
    return jsonify(list(actividades.values()))


@main_bp.delete("/api/actividades/<int:act_id>")
@require_auth
def archivar_actividad(act_id):
    """Soft-delete: marca la actividad como archivada."""
    user = get_current_user()
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(f"SELECT grupo_id FROM actividades WHERE id = %s AND archivada = FALSE", (act_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Actividad no encontrada"}), 404
    if not is_privileged(user) and user["rol"] == "grupo" and row[0] != user["grupo_id"]:
        conn.close()
        return jsonify({"error": "Acceso denegado"}), 403
    cur.execute(f"UPDATE actividades SET archivada = TRUE WHERE id = %s", (act_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

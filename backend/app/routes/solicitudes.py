from flask import request, jsonify
from . import main_bp
from ..db import get_connection
from ..auth import require_auth, require_admin, get_current_user
from datetime import datetime

def _parse_fecha(valor):
    if not valor:
        return None
    for fmt in ("%Y-%m-%dT%H:%M", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(valor, fmt)
        except ValueError:
            continue
    return None

PRIORIDADES = ["Baja", "Normal", "Alta"]

def _row_to_dict(r):
    return {
        "id": r[0], "descripcion": r[1], "fecha_creacion": str(r[2]),
        "grupo_origen": {"id": r[3], "nombre": r[4]} if r[3] else None,
        "actividad_estado": r[5],
        "ubicacion": r[6], "fecha_hora": str(r[7]) if r[7] else None,
        "prioridad": r[8] or "Normal",
        "lat": r[9], "lng": r[10],
        "solicitante_id": r[11],
        "solicitante_nombre": r[12],
        "solicitante_telefono": r[13],
        "solicitante_email": r[14],
    }

SELECT_BASE = """
    SELECT s.id, s.descripcion, s.fecha_creacion,
           g.id, COALESCE(g.nombre, c.nombre), a.estado,
           s.ubicacion, s.fecha_hora, s.prioridad, s.lat, s.lng,
           s.solicitante_id, m.nombre, m.telefono, m.email
    FROM MesaDeContingencia.solicitudes s
    LEFT JOIN MesaDeContingencia.grupos_trabajo g   ON g.id = s.creado_por_grupo_id
    LEFT JOIN MesaDeContingencia.centros_atencion c ON c.id = s.creado_por_centro_id
    LEFT JOIN MesaDeContingencia.actividades a      ON a.solicitud_id = s.id
    LEFT JOIN MesaDeContingencia.miembros m         ON m.id = s.solicitante_id
"""
ORDER = """ORDER BY
    CASE s.prioridad WHEN 'Alta' THEN 1 WHEN 'Normal' THEN 2 ELSE 3 END,
    s.fecha_creacion DESC"""

@main_bp.post("/api/solicitudes")
@require_auth
def crear_solicitud():
    user = get_current_user()
    data = request.get_json() or {}
    descripcion = data.get("descripcion", "").strip()
    if not descripcion:
        return jsonify({"error": "La descripción es obligatoria"}), 400
    prioridad = data.get("prioridad", "Normal")
    if prioridad not in PRIORIDADES:
        return jsonify({"error": f"Prioridad inválida. Opciones: {PRIORIDADES}"}), 400
    grupo_id = user["grupo_id"] if user["rol"] == "grupo" else (None if user["rol"] == "centro" else data.get("creado_por_grupo_id"))
    centro_id = user["centro_id"] if user["rol"] == "centro" else None
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO MesaDeContingencia.solicitudes
            (descripcion, creado_por_grupo_id, creado_por_centro_id, ubicacion, fecha_hora,
             prioridad, lat, lng, solicitante_id)
        OUTPUT INSERTED.id, INSERTED.fecha_creacion
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (descripcion, grupo_id, centro_id,
          data.get("ubicacion"), _parse_fecha(data.get("fecha_hora")),
          prioridad,
          data.get("lat"), data.get("lng"),
          data.get("solicitante_id") or None))
    row = cur.fetchone()
    conn.commit()
    conn.close()
    return jsonify({"id": row[0], "descripcion": descripcion, "fecha_creacion": str(row[1])}), 201

@main_bp.get("/api/solicitudes/mis-centro")
def solicitudes_centro():
    from ..auth import require_auth
    from flask import g as flask_g
    user = get_current_user()
    if not user or user["rol"] != "centro":
        from flask import jsonify as _j
        return _j({"error": "Acceso denegado"}), 403
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(SELECT_BASE + " WHERE s.creado_por_centro_id = %s " + ORDER, (user["centro_id"],))
    rows = [_row_to_dict(r) for r in cur.fetchall()]
    conn.close()
    return jsonify(rows)


@main_bp.get("/api/solicitudes/pendientes")
@require_admin
def solicitudes_pendientes():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(SELECT_BASE + """
        WHERE NOT EXISTS (SELECT 1 FROM MesaDeContingencia.actividades a2 WHERE a2.solicitud_id = s.id)
    """ + ORDER)
    rows = [_row_to_dict(r) for r in cur.fetchall()]
    conn.close()
    return jsonify(rows)

@main_bp.get("/api/solicitudes")
@require_auth
def listar_solicitudes():
    user = get_current_user()
    conn = get_connection()
    cur = conn.cursor()
    if user["rol"] == "admin":
        cur.execute(SELECT_BASE + ORDER)
    else:
        cur.execute(SELECT_BASE + " WHERE s.creado_por_grupo_id = %s " + ORDER, (user["grupo_id"],))
    rows = [_row_to_dict(r) for r in cur.fetchall()]
    conn.close()
    return jsonify(rows)

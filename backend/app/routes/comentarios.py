from flask import request, jsonify
from . import main_bp
from ..db import get_connection
from ..auth import require_auth, is_privileged, get_current_user

# Los comentarios de Tareas viven en app/routes/tareas.py (tarea_comentarios).
# Este archivo administra el feed de notificaciones compartido por Tareas y Solicitudes.

@main_bp.get("/api/notificaciones")
@require_auth
def get_notificaciones():
    user = get_current_user()
    conn = get_connection()
    cur = conn.cursor()
    if is_privileged(user):
        if user["rol"] == "admin":
            cur.execute(f"""
                SELECT id, tarea_id, solicitud_id, texto, leida, fecha_creacion
                FROM notificaciones
                WHERE para_rol = 'admin'
                ORDER BY fecha_creacion DESC
            """)
        else:
            cur.execute(f"""
                SELECT id, tarea_id, solicitud_id, texto, leida, fecha_creacion
                FROM notificaciones
                WHERE para_rol = 'admin' OR (para_rol = 'grupo' AND para_grupo_id = %s)
                ORDER BY fecha_creacion DESC
            """, (user["grupo_id"],))
    elif user["rol"] == "centro":
        # para_grupo_id no tiene FK real; se reutiliza para guardar el centro_id
        # cuando para_rol = 'centro' (ver _notificar_creador en solicitudes.py).
        cur.execute(f"""
            SELECT id, tarea_id, solicitud_id, texto, leida, fecha_creacion
            FROM notificaciones
            WHERE para_rol = 'centro' AND para_grupo_id = %s
            ORDER BY fecha_creacion DESC
        """, (user["centro_id"],))
    else:
        cur.execute(f"""
            SELECT id, tarea_id, solicitud_id, texto, leida, fecha_creacion
            FROM notificaciones
            WHERE para_rol = 'grupo' AND para_grupo_id = %s
            ORDER BY fecha_creacion DESC
        """, (user["grupo_id"],))
    rows = [{"id": r[0], "tarea_id": r[1], "solicitud_id": r[2], "texto": r[3],
             "leida": bool(r[4]), "fecha": str(r[5])} for r in cur.fetchall()]
    conn.close()
    return jsonify(rows)


@main_bp.put("/api/notificaciones/<int:nid>/leer")
@require_auth
def marcar_leida(nid):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(f"UPDATE notificaciones SET leida = TRUE WHERE id = %s", (nid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@main_bp.post("/api/notificaciones/leer-todas")
@require_auth
def leer_todas():
    user = get_current_user()
    conn = get_connection()
    cur = conn.cursor()
    if is_privileged(user):
        if user["rol"] == "admin":
            cur.execute(f"UPDATE notificaciones SET leida = TRUE WHERE para_rol = 'admin'")
        else:
            cur.execute(f"""
                UPDATE notificaciones SET leida = TRUE
                WHERE para_rol = 'admin' OR (para_rol = 'grupo' AND para_grupo_id = %s)
            """, (user["grupo_id"],))
    elif user["rol"] == "centro":
        cur.execute(f"""
            UPDATE notificaciones SET leida = TRUE
            WHERE para_rol = 'centro' AND para_grupo_id = %s
        """, (user["centro_id"],))
    else:
        cur.execute(f"""
            UPDATE notificaciones SET leida = TRUE
            WHERE para_rol = 'grupo' AND para_grupo_id = %s
        """, (user["grupo_id"],))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

from flask import request, jsonify
from . import main_bp
from ..db import get_connection
from ..auth import require_auth, get_current_user

@main_bp.get("/api/actividades/<int:act_id>/comentarios")
@require_auth
def get_comentarios(act_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, autor_username, autor_rol, grupo_id, texto, fecha_creacion
        FROM MesaDeContingencia.actividad_comentarios
        WHERE actividad_id = %s
        ORDER BY fecha_creacion ASC
    """, (act_id,))
    rows = [{"id": r[0], "autor": r[1], "rol": r[2], "grupo_id": r[3],
             "texto": r[4], "fecha": str(r[5])} for r in cur.fetchall()]
    conn.close()
    return jsonify(rows)


@main_bp.post("/api/actividades/<int:act_id>/comentarios")
@require_auth
def crear_comentario(act_id):
    user = get_current_user()
    data = request.get_json() or {}
    texto = (data.get("texto") or "").strip()
    if not texto:
        return jsonify({"error": "El comentario no puede estar vacío"}), 400

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT grupo_id FROM MesaDeContingencia.actividades WHERE id = %s", (act_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Actividad no encontrada"}), 404
    grupo_actividad_id = row[0]

    cur.execute("""
        INSERT INTO MesaDeContingencia.actividad_comentarios
            (actividad_id, autor_username, autor_rol, grupo_id, texto)
        OUTPUT INSERTED.id, INSERTED.fecha_creacion
        VALUES (%s, %s, %s, %s, %s)
    """, (act_id, user["username"], user["rol"], user.get("grupo_id"), texto))
    nuevo = cur.fetchone()
    nuevo_id, fecha = nuevo[0], str(nuevo[1])

    autor_label = user["username"]
    notif_texto = f"💬 {autor_label}: {texto[:120]}"

    cur.execute("""
        INSERT INTO MesaDeContingencia.notificaciones
            (para_rol, para_grupo_id, actividad_id, comentario_id, texto)
        VALUES ('admin', NULL, %s, %s, %s)
    """, (act_id, nuevo_id, notif_texto))

    if user["rol"] == "admin":
        cur.execute("""
            INSERT INTO MesaDeContingencia.notificaciones
                (para_rol, para_grupo_id, actividad_id, comentario_id, texto)
            VALUES ('grupo', %s, %s, %s, %s)
        """, (grupo_actividad_id, act_id, nuevo_id, notif_texto))

    conn.commit()
    conn.close()
    return jsonify({"id": nuevo_id, "autor": user["username"], "rol": user["rol"],
                    "texto": texto, "fecha": fecha}), 201


@main_bp.get("/api/notificaciones")
@require_auth
def get_notificaciones():
    user = get_current_user()
    conn = get_connection()
    cur = conn.cursor()
    if user["rol"] == "admin":
        cur.execute("""
            SELECT id, actividad_id, texto, leida, fecha_creacion
            FROM MesaDeContingencia.notificaciones
            WHERE para_rol = 'admin'
            ORDER BY fecha_creacion DESC
        """)
    else:
        cur.execute("""
            SELECT id, actividad_id, texto, leida, fecha_creacion
            FROM MesaDeContingencia.notificaciones
            WHERE para_rol = 'grupo' AND para_grupo_id = %s
            ORDER BY fecha_creacion DESC
        """, (user["grupo_id"],))
    rows = [{"id": r[0], "actividad_id": r[1], "texto": r[2],
             "leida": bool(r[3]), "fecha": str(r[4])} for r in cur.fetchall()]
    conn.close()
    return jsonify(rows)


@main_bp.put("/api/notificaciones/<int:nid>/leer")
@require_auth
def marcar_leida(nid):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("UPDATE MesaDeContingencia.notificaciones SET leida = 1 WHERE id = %s", (nid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@main_bp.post("/api/notificaciones/leer-todas")
@require_auth
def leer_todas():
    user = get_current_user()
    conn = get_connection()
    cur = conn.cursor()
    if user["rol"] == "admin":
        cur.execute("UPDATE MesaDeContingencia.notificaciones SET leida = 1 WHERE para_rol = 'admin'")
    else:
        cur.execute("""
            UPDATE MesaDeContingencia.notificaciones SET leida = 1
            WHERE para_rol = 'grupo' AND para_grupo_id = %s
        """, (user["grupo_id"],))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

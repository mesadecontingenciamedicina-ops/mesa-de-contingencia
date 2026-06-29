from flask import request, jsonify
from . import main_bp
from ..db import get_connection
from ..auth import require_admin, get_current_user
from werkzeug.security import generate_password_hash


@main_bp.get("/api/centros")
@require_admin
def listar_centros():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT c.id, c.nombre, c.descripcion, c.activo,
               u.id, u.username, u.activo
        FROM MesaDeContingencia.centros_atencion c
        LEFT JOIN MesaDeContingencia.usuarios u ON u.centro_id = c.id AND u.rol = 'centro'
        ORDER BY c.nombre
    """)
    rows = []
    for r in cur.fetchall():
        rows.append({
            "id": r[0], "nombre": r[1], "descripcion": r[2], "activo": bool(r[3]),
            "usuario": {"id": r[4], "username": r[5], "activo": bool(r[6])} if r[4] else None
        })
    conn.close()
    return jsonify(rows)


@main_bp.post("/api/centros")
@require_admin
def crear_centro():
    data = request.get_json() or {}
    nombre = (data.get("nombre") or "").strip()
    if not nombre:
        return jsonify({"error": "nombre requerido"}), 400
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO MesaDeContingencia.centros_atencion (nombre, descripcion)
        OUTPUT INSERTED.id VALUES (%s, %s)
    """, (nombre, (data.get("descripcion") or "").strip() or None))
    new_id = cur.fetchone()[0]
    conn.commit()
    conn.close()
    return jsonify({"id": new_id, "nombre": nombre, "descripcion": data.get("descripcion"), "activo": True, "usuario": None}), 201


@main_bp.put("/api/centros/<int:centro_id>")
@require_admin
def editar_centro(centro_id):
    data = request.get_json() or {}
    nombre = (data.get("nombre") or "").strip()
    if not nombre:
        return jsonify({"error": "nombre requerido"}), 400
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE MesaDeContingencia.centros_atencion
        SET nombre=%s, descripcion=%s WHERE id=%s
    """, (nombre, (data.get("descripcion") or "").strip() or None, centro_id))
    if cur.rowcount == 0:
        conn.close()
        return jsonify({"error": "Centro no encontrado"}), 404
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@main_bp.delete("/api/centros/<int:centro_id>")
@require_admin
def eliminar_centro(centro_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM MesaDeContingencia.solicitudes WHERE creado_por_centro_id=%s", (centro_id,))
    if cur.fetchone()[0] > 0:
        conn.close()
        return jsonify({"error": "Este centro tiene solicitudes registradas y no puede eliminarse"}), 409
    cur.execute("DELETE FROM MesaDeContingencia.usuarios WHERE centro_id=%s AND rol='centro'", (centro_id,))
    cur.execute("DELETE FROM MesaDeContingencia.centros_atencion WHERE id=%s", (centro_id,))
    if cur.rowcount == 0:
        conn.close()
        return jsonify({"error": "Centro no encontrado"}), 404
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@main_bp.get("/api/centros/<int:centro_id>/usuario")
@require_admin
def get_usuario_centro(centro_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, username, activo FROM MesaDeContingencia.usuarios
        WHERE centro_id=%s AND rol='centro'
    """, (centro_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        return jsonify(None)
    return jsonify({"id": row[0], "username": row[1], "activo": bool(row[2])})


@main_bp.post("/api/centros/<int:centro_id>/usuario")
@require_admin
def crear_usuario_centro(centro_id):
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()
    if not username or not password:
        return jsonify({"error": "username y password requeridos"}), 400
    if len(password) < 6:
        return jsonify({"error": "La contraseña debe tener al menos 6 caracteres"}), 400
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id FROM MesaDeContingencia.centros_atencion WHERE id=%s", (centro_id,))
    if not cur.fetchone():
        conn.close()
        return jsonify({"error": "Centro no encontrado"}), 404
    cur.execute("SELECT id FROM MesaDeContingencia.usuarios WHERE username=%s", (username,))
    if cur.fetchone():
        conn.close()
        return jsonify({"error": f"El usuario '{username}' ya existe"}), 409
    cur.execute("SELECT id FROM MesaDeContingencia.usuarios WHERE centro_id=%s AND rol='centro'", (centro_id,))
    if cur.fetchone():
        conn.close()
        return jsonify({"error": "Este centro ya tiene usuario asignado"}), 409
    h = generate_password_hash(password)
    cur.execute("""
        INSERT INTO MesaDeContingencia.usuarios (username, password_hash, rol, centro_id, activo)
        OUTPUT INSERTED.id VALUES (%s, %s, 'centro', %s, 1)
    """, (username, h, centro_id))
    new_id = cur.fetchone()[0]
    conn.commit()
    conn.close()
    return jsonify({"id": new_id, "username": username, "activo": True}), 201


@main_bp.put("/api/centros/<int:centro_id>/usuario")
@require_admin
def cambiar_password_centro(centro_id):
    data = request.get_json() or {}
    password = (data.get("password") or "").strip()
    if not password or len(password) < 6:
        return jsonify({"error": "La contraseña debe tener al menos 6 caracteres"}), 400
    conn = get_connection()
    cur = conn.cursor()
    h = generate_password_hash(password)
    cur.execute("""
        UPDATE MesaDeContingencia.usuarios SET password_hash=%s
        WHERE centro_id=%s AND rol='centro'
    """, (h, centro_id))
    if cur.rowcount == 0:
        conn.close()
        return jsonify({"error": "No hay usuario para este centro"}), 404
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

from flask import request, jsonify
from . import main_bp
from ..db import get_connection
from ..auth import require_auth, require_admin, get_current_user
from werkzeug.security import generate_password_hash

def _fetch_grupo(cur, grupo_id):
    cur.execute("""
        SELECT g.id, g.nombre, g.descripcion, m.id, m.nombre
        FROM MesaDeContingencia.grupos_trabajo g
        LEFT JOIN MesaDeContingencia.miembros m ON m.id = g.representante_principal_id
        WHERE g.id = %s
    """, (grupo_id,))
    r = cur.fetchone()
    if not r:
        return None
    grupo = {"id": r[0], "nombre": r[1], "descripcion": r[2],
             "representante": {"id": r[3], "nombre": r[4]} if r[3] else None, "miembros": []}
    cur.execute("""
        SELECT m.id, m.nombre, m.cargo
        FROM MesaDeContingencia.miembros_grupos mg
        JOIN MesaDeContingencia.miembros m ON m.id = mg.miembro_id
        WHERE mg.grupo_id = %s
    """, (grupo_id,))
    grupo["miembros"] = [{"id": r[0], "nombre": r[1], "cargo": r[2]} for r in cur.fetchall()]
    return grupo

@main_bp.get("/api/grupos")
@require_auth
def listar_grupos():
    user = get_current_user()
    conn = get_connection()
    cur = conn.cursor()
    if user["rol"] == "grupo":
        cur.execute("""
            SELECT g.id, g.nombre, g.descripcion, m.id, m.nombre
            FROM MesaDeContingencia.grupos_trabajo g
            LEFT JOIN MesaDeContingencia.miembros m ON m.id = g.representante_principal_id
            WHERE g.id = %s
        """, (user["grupo_id"],))
    else:
        cur.execute("""
            SELECT g.id, g.nombre, g.descripcion, m.id, m.nombre
            FROM MesaDeContingencia.grupos_trabajo g
            LEFT JOIN MesaDeContingencia.miembros m ON m.id = g.representante_principal_id
            ORDER BY g.nombre
        """)
    grupos = {r[0]: {"id": r[0], "nombre": r[1], "descripcion": r[2],
                     "representante": {"id": r[3], "nombre": r[4]} if r[3] else None,
                     "miembros": []}
              for r in cur.fetchall()}
    if grupos:
        cur.execute("""
            SELECT mg.grupo_id, m.id, m.nombre, m.cargo
            FROM MesaDeContingencia.miembros_grupos mg
            JOIN MesaDeContingencia.miembros m ON m.id = mg.miembro_id
            WHERE mg.grupo_id IN ({})
        """.format(",".join(str(k) for k in grupos)))
        for r in cur.fetchall():
            if r[0] in grupos:
                grupos[r[0]]["miembros"].append({"id": r[1], "nombre": r[2], "cargo": r[3]})
    conn.close()
    return jsonify(list(grupos.values()))

@main_bp.put("/api/grupos/<int:grupo_id>")
@require_admin
def editar_grupo(grupo_id):
    data = request.get_json() or {}
    nombre = data.get("nombre", "").strip()
    rep_id = data.get("representante_principal_id")
    if not nombre:
        return jsonify({"error": "nombre requerido"}), 400
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE MesaDeContingencia.grupos_trabajo
        SET nombre = %s, descripcion = %s, representante_principal_id = %s
        WHERE id = %s
    """, (nombre, data.get("descripcion"), rep_id or None, grupo_id))
    if cur.rowcount == 0:
        conn.close()
        return jsonify({"error": "Grupo no encontrado"}), 404
    conn.commit()
    grupo = _fetch_grupo(cur, grupo_id)
    conn.close()
    return jsonify(grupo)


@main_bp.get("/api/grupos/<int:grupo_id>/usuario")
@require_admin
def get_usuario_grupo(grupo_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, username, activo FROM MesaDeContingencia.usuarios
        WHERE grupo_id = %s AND rol = 'grupo'
    """, (grupo_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        return jsonify(None)
    return jsonify({"id": row[0], "username": row[1], "activo": bool(row[2])})


@main_bp.post("/api/grupos/<int:grupo_id>/usuario")
@require_admin
def crear_usuario_grupo(grupo_id):
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()
    if not username or not password:
        return jsonify({"error": "username y password requeridos"}), 400
    if len(password) < 6:
        return jsonify({"error": "La contraseña debe tener al menos 6 caracteres"}), 400
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id FROM MesaDeContingencia.grupos_trabajo WHERE id = %s", (grupo_id,))
    if not cur.fetchone():
        conn.close()
        return jsonify({"error": "Grupo no encontrado"}), 404
    cur.execute("SELECT id FROM MesaDeContingencia.usuarios WHERE username = %s", (username,))
    if cur.fetchone():
        conn.close()
        return jsonify({"error": f"El usuario '{username}' ya existe"}), 409
    cur.execute("SELECT id FROM MesaDeContingencia.usuarios WHERE grupo_id = %s AND rol = 'grupo'", (grupo_id,))
    if cur.fetchone():
        conn.close()
        return jsonify({"error": "Este grupo ya tiene un usuario asignado"}), 409
    h = generate_password_hash(password)
    cur.execute("""
        INSERT INTO MesaDeContingencia.usuarios (username, password_hash, rol, grupo_id, activo)
        OUTPUT INSERTED.id
        VALUES (%s, %s, 'grupo', %s, 1)
    """, (username, h, grupo_id))
    new_id = cur.fetchone()[0]
    conn.commit()
    conn.close()
    return jsonify({"id": new_id, "username": username, "activo": True}), 201


@main_bp.put("/api/grupos/<int:grupo_id>/usuario")
@require_admin
def cambiar_password_grupo(grupo_id):
    data = request.get_json() or {}
    password = (data.get("password") or "").strip()
    if not password or len(password) < 6:
        return jsonify({"error": "La contraseña debe tener al menos 6 caracteres"}), 400
    conn = get_connection()
    cur = conn.cursor()
    h = generate_password_hash(password)
    cur.execute("""
        UPDATE MesaDeContingencia.usuarios SET password_hash = %s
        WHERE grupo_id = %s AND rol = 'grupo'
    """, (h, grupo_id))
    if cur.rowcount == 0:
        conn.close()
        return jsonify({"error": "No hay usuario para este grupo"}), 404
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

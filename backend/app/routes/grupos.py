import re
import random
import string
from flask import request, jsonify
from . import main_bp
from ..db import get_connection
from ..auth import require_auth, require_admin, get_current_user
from werkzeug.security import generate_password_hash


def _slug(nombre):
    s = nombre.lower().strip()
    for a, b in [("áàä","a"),("éèë","e"),("íìï","i"),("óòö","o"),("úùü","u")]:
        for c in a: s = s.replace(c, b)
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")[:25]
    return f"grupo_{s}" if s else "grupo"


def _gen_password(n=10):
    return "".join(random.choices(string.ascii_letters + string.digits, k=n))

def _fetch_grupo(cur, grupo_id):
    cur.execute(f"""
        SELECT g.id, g.nombre, g.descripcion, m.id, m.nombre
        FROM grupos_trabajo g
        LEFT JOIN miembros m ON m.id = g.representante_principal_id
        WHERE g.id = %s
    """, (grupo_id,))
    r = cur.fetchone()
    if not r:
        return None
    grupo = {"id": r[0], "nombre": r[1], "descripcion": r[2],
             "representante": {"id": r[3], "nombre": r[4]} if r[3] else None, "miembros": []}
    cur.execute(f"""
        SELECT m.id, m.nombre, m.cargo
        FROM miembros_grupos mg
        JOIN miembros m ON m.id = mg.miembro_id
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
        cur.execute(f"""
            SELECT g.id, g.nombre, g.descripcion, m.id, m.nombre
            FROM grupos_trabajo g
            LEFT JOIN miembros m ON m.id = g.representante_principal_id
            WHERE g.id = %s
        """, (user["grupo_id"],))
    else:
        cur.execute(f"""
            SELECT g.id, g.nombre, g.descripcion, m.id, m.nombre
            FROM grupos_trabajo g
            LEFT JOIN miembros m ON m.id = g.representante_principal_id
            ORDER BY g.nombre
        """)
    grupos = {r[0]: {"id": r[0], "nombre": r[1], "descripcion": r[2],
                     "representante": {"id": r[3], "nombre": r[4]} if r[3] else None,
                     "miembros": []}
              for r in cur.fetchall()}
    if grupos:
        cur.execute(f"""
            SELECT mg.grupo_id, m.id, m.nombre, m.cargo
            FROM miembros_grupos mg
            JOIN miembros m ON m.id = mg.miembro_id
            WHERE mg.grupo_id IN ({",".join(str(k) for k in grupos)})
        """)
        for r in cur.fetchall():
            if r[0] in grupos:
                grupos[r[0]]["miembros"].append({"id": r[1], "nombre": r[2], "cargo": r[3]})
        cur.execute(f"""
            SELECT grupo_id, username, password_plain, activo
            FROM usuarios
            WHERE grupo_id IN ({",".join(str(k) for k in grupos)}) AND rol = 'grupo'
        """)
        for r in cur.fetchall():
            if r[0] in grupos:
                grupos[r[0]]["usuario"] = {"username": r[1], "password_plain": r[2], "activo": bool(r[3])}
    conn.close()
    return jsonify(list(grupos.values()))

@main_bp.post("/api/grupos")
@require_admin
def crear_grupo():
    data = request.get_json() or {}
    nombre = data.get("nombre", "").strip()
    if not nombre:
        return jsonify({"error": "nombre requerido"}), 400
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(f"""
        INSERT INTO grupos_trabajo (nombre, descripcion)
        VALUES (%s, %s) RETURNING id
    """, (nombre, data.get("descripcion", "").strip() or None))
    new_id = cur.fetchone()[0]

    # Usar credenciales del body o auto-generar
    username = (data.get("username") or "").strip() or _slug(nombre)
    password = (data.get("password") or "").strip() or _gen_password()
    # Resolver colisión de username
    base = username
    suffix = 1
    while True:
        cur.execute(f"SELECT 1 FROM usuarios WHERE username = %s", (username,))
        if not cur.fetchone():
            break
        username = f"{base}_{suffix}"
        suffix += 1
    h = generate_password_hash(password, method="pbkdf2:sha256")
    cur.execute(f"""
        INSERT INTO usuarios (username, password_hash, password_plain, rol, grupo_id, activo)
        VALUES (%s, %s, %s, 'grupo', %s, TRUE)
    """, (username, h, password, new_id))

    conn.commit()
    conn.close()
    return jsonify({
        "id": new_id, "nombre": nombre, "descripcion": data.get("descripcion"),
        "miembros": [], "representante": None,
        "usuario": {"username": username, "password_plain": password, "activo": True},
    }), 201


@main_bp.delete("/api/grupos/<int:grupo_id>")
@require_admin
def eliminar_grupo(grupo_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(f"SELECT COUNT(*) FROM actividades WHERE grupo_id = %s", (grupo_id,))
    if cur.fetchone()[0] > 0:
        conn.close()
        return jsonify({"error": "Este grupo tiene actividades asignadas y no puede eliminarse"}), 409
    cur.execute(f"DELETE FROM usuarios WHERE grupo_id = %s AND rol = 'grupo'", (grupo_id,))
    cur.execute(f"DELETE FROM miembros_grupos WHERE grupo_id = %s", (grupo_id,))
    cur.execute(f"DELETE FROM grupos_trabajo WHERE id = %s", (grupo_id,))
    if cur.rowcount == 0:
        conn.close()
        return jsonify({"error": "Grupo no encontrado"}), 404
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


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
    cur.execute(f"""
        UPDATE grupos_trabajo
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
    cur.execute(f"""
        SELECT id, username, activo, password_plain FROM usuarios
        WHERE grupo_id = %s AND rol = 'grupo'
    """, (grupo_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        return jsonify(None)
    return jsonify({"id": row[0], "username": row[1], "activo": bool(row[2]), "password_plain": row[3]})


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
    cur.execute(f"SELECT id FROM grupos_trabajo WHERE id = %s", (grupo_id,))
    if not cur.fetchone():
        conn.close()
        return jsonify({"error": "Grupo no encontrado"}), 404
    cur.execute(f"SELECT id FROM usuarios WHERE username = %s", (username,))
    if cur.fetchone():
        conn.close()
        return jsonify({"error": f"El usuario '{username}' ya existe"}), 409
    cur.execute(f"SELECT id FROM usuarios WHERE grupo_id = %s AND rol = 'grupo'", (grupo_id,))
    if cur.fetchone():
        conn.close()
        return jsonify({"error": "Este grupo ya tiene un usuario asignado"}), 409
    h = generate_password_hash(password, method="pbkdf2:sha256")
    cur.execute(f"""
        INSERT INTO usuarios (username, password_hash, password_plain, rol, grupo_id, activo)
        VALUES (%s, %s, %s, 'grupo', %s, TRUE) RETURNING id
    """, (username, h, password, grupo_id))
    new_id = cur.fetchone()[0]
    conn.commit()
    conn.close()
    return jsonify({"id": new_id, "username": username, "activo": True, "password_plain": password}), 201


@main_bp.put("/api/grupos/<int:grupo_id>/usuario")
@require_admin
def cambiar_password_grupo(grupo_id):
    data = request.get_json() or {}
    password = (data.get("password") or "").strip()
    if not password or len(password) < 6:
        return jsonify({"error": "La contraseña debe tener al menos 6 caracteres"}), 400
    conn = get_connection()
    cur = conn.cursor()
    h = generate_password_hash(password, method="pbkdf2:sha256")
    cur.execute(f"""
        UPDATE usuarios SET password_hash = %s, password_plain = %s
        WHERE grupo_id = %s AND rol = 'grupo'
    """, (h, password, grupo_id))
    if cur.rowcount == 0:
        conn.close()
        return jsonify({"error": "No hay usuario para este grupo"}), 404
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "password_plain": password})

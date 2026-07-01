import random
import string
from flask import request, jsonify
from . import main_bp
from ..db import get_connection
from ..auth import require_admin, get_current_user
from werkzeug.security import generate_password_hash


def _slug(nombre):
    import re
    s = nombre.lower().strip()
    for a, b in [("áàä","a"),("éèë","e"),("íìï","i"),("óòö","o"),("úùü","u")]:
        for c in a: s = s.replace(c, b)
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")[:30]
    return s or "centro"


def _gen_password(n=10):
    return "".join(random.choices(string.ascii_letters + string.digits, k=n))


def _get_contactos(cur, centro_id):
    cur.execute(f"""
        SELECT id, nombre, cargo, telefono, email
        FROM centro_contactos WHERE centro_id = %s ORDER BY id
    """, (centro_id,))
    return [{"id": r[0], "nombre": r[1], "cargo": r[2], "telefono": r[3], "email": r[4]}
            for r in cur.fetchall()]


@main_bp.get("/api/centros")
@require_admin
def listar_centros():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(f"""
        SELECT c.id, c.nombre, c.descripcion, c.activo, c.direccion, c.lat, c.lng,
               u.id, u.username, u.activo, u.password_plain
        FROM centros_atencion c
        LEFT JOIN usuarios u ON u.centro_id = c.id AND u.rol = 'centro'
        ORDER BY c.nombre
    """)
    rows = []
    for r in cur.fetchall():
        rows.append({
            "id": r[0], "nombre": r[1], "descripcion": r[2], "activo": bool(r[3]),
            "direccion": r[4], "lat": r[5], "lng": r[6],
            "usuario": {"id": r[7], "username": r[8], "activo": bool(r[9]), "password_plain": r[10]} if r[7] else None,
        })
    for row in rows:
        row["contactos"] = _get_contactos(cur, row["id"])
    conn.close()
    return jsonify(rows)


@main_bp.post("/api/centros")
@require_admin
def crear_centro():
    data = request.get_json() or {}
    nombre = (data.get("nombre") or "").strip()
    if not nombre:
        return jsonify({"error": "nombre requerido"}), 400

    username = _slug(nombre)
    password = _gen_password()

    conn = get_connection()
    cur = conn.cursor()

    base = username
    suffix = 1
    while True:
        cur.execute(f"SELECT id FROM usuarios WHERE username = %s", (username,))
        if not cur.fetchone():
            break
        username = f"{base}_{suffix}"
        suffix += 1

    cur.execute(f"""
        INSERT INTO centros_atencion (nombre, descripcion, direccion, lat, lng)
        VALUES (%s, %s, %s, %s, %s) RETURNING id
    """, (nombre,
          (data.get("descripcion") or "").strip() or None,
          (data.get("direccion") or "").strip() or None,
          data.get("lat") or None, data.get("lng") or None))
    new_id = cur.fetchone()[0]

    h = generate_password_hash(password, method="pbkdf2:sha256")
    cur.execute(f"""
        INSERT INTO usuarios (username, password_hash, password_plain, rol, centro_id, activo)
        VALUES (%s, %s, %s, 'centro', %s, TRUE) RETURNING id
    """, (username, h, password, new_id))

    for c in (data.get("contactos") or []):
        nombre_c = (c.get("nombre") or "").strip()
        if nombre_c:
            cur.execute(f"""
                INSERT INTO centro_contactos (centro_id, nombre, cargo, telefono, email)
                VALUES (%s, %s, %s, %s, %s)
            """, (new_id, nombre_c, c.get("cargo") or None,
                  c.get("telefono") or None, c.get("email") or None))

    conn.commit()
    conn.close()
    return jsonify({"id": new_id, "nombre": nombre, "activo": True}), 201


@main_bp.put("/api/centros/<int:centro_id>")
@require_admin
def editar_centro(centro_id):
    data = request.get_json() or {}
    nombre = (data.get("nombre") or "").strip()
    if not nombre:
        return jsonify({"error": "nombre requerido"}), 400
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(f"""
        UPDATE centros_atencion
        SET nombre=%s, descripcion=%s, direccion=%s, lat=%s, lng=%s WHERE id=%s
    """, (nombre,
          (data.get("descripcion") or "").strip() or None,
          (data.get("direccion") or "").strip() or None,
          data.get("lat") or None, data.get("lng") or None, centro_id))
    if cur.rowcount == 0:
        conn.close()
        return jsonify({"error": "Centro no encontrado"}), 404

    cur.execute(f"DELETE FROM centro_contactos WHERE centro_id = %s", (centro_id,))
    for c in (data.get("contactos") or []):
        nombre_c = (c.get("nombre") or "").strip()
        if nombre_c:
            cur.execute(f"""
                INSERT INTO centro_contactos (centro_id, nombre, cargo, telefono, email)
                VALUES (%s, %s, %s, %s, %s)
            """, (centro_id, nombre_c, c.get("cargo") or None,
                  c.get("telefono") or None, c.get("email") or None))

    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@main_bp.delete("/api/centros/<int:centro_id>")
@require_admin
def eliminar_centro(centro_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(f"SELECT COUNT(*) FROM solicitudes WHERE creado_por_centro_id=%s", (centro_id,))
    if cur.fetchone()[0] > 0:
        conn.close()
        return jsonify({"error": "Este centro tiene solicitudes registradas y no puede eliminarse"}), 409
    cur.execute(f"DELETE FROM centro_contactos WHERE centro_id=%s", (centro_id,))
    cur.execute(f"DELETE FROM usuarios WHERE centro_id=%s AND rol='centro'", (centro_id,))
    cur.execute(f"DELETE FROM centros_atencion WHERE id=%s", (centro_id,))
    if cur.rowcount == 0:
        conn.close()
        return jsonify({"error": "Centro no encontrado"}), 404
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@main_bp.put("/api/centros/<int:centro_id>/usuario")
@require_admin
def regenerar_password_centro(centro_id):
    password = _gen_password()
    h = generate_password_hash(password, method="pbkdf2:sha256")
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(f"""
        UPDATE usuarios SET password_hash=%s, password_plain=%s
        WHERE centro_id=%s AND rol='centro'
    """, (h, password, centro_id))
    if cur.rowcount == 0:
        conn.close()
        return jsonify({"error": "No hay usuario para este centro"}), 404
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "password": password})

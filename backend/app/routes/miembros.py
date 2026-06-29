from flask import request, jsonify
from . import main_bp
from ..db import get_connection, SCHEMA
from ..validaciones import validar_miembro, normalizar_cedula
from ..auth import require_auth, get_current_user

@main_bp.get("/api/miembros")
@require_auth
def listar_miembros():
    user = get_current_user()
    conn = get_connection()
    cur = conn.cursor()
    if user["rol"] == "admin":
        cur.execute(f"""
            SELECT m.id, m.nombre, m.cedula, m.telefono, m.tlf_alternativo, m.cargo, m.email,
                   g.id, g.nombre
            FROM {SCHEMA}.miembros m
            LEFT JOIN {SCHEMA}.miembros_grupos mg ON mg.miembro_id = m.id
            LEFT JOIN {SCHEMA}.grupos_trabajo g ON g.id = mg.grupo_id
            ORDER BY m.nombre
        """)
    else:
        cur.execute(f"""
            SELECT m.id, m.nombre, m.cedula, m.telefono, m.tlf_alternativo, m.cargo, m.email,
                   g.id, g.nombre
            FROM {SCHEMA}.miembros m
            JOIN {SCHEMA}.miembros_grupos mg ON mg.miembro_id = m.id
            JOIN {SCHEMA}.grupos_trabajo g ON g.id = mg.grupo_id
            WHERE mg.grupo_id = %s
            ORDER BY m.nombre
        """, (user["grupo_id"],))
    rows = [
        {"id": r[0], "nombre": r[1], "cedula": r[2], "telefono": r[3],
         "tlf_alternativo": r[4], "cargo": r[5], "email": r[6],
         "grupo": {"id": r[7], "nombre": r[8]} if r[7] else None}
        for r in cur.fetchall()
    ]
    conn.close()
    return jsonify(rows)

@main_bp.post("/api/miembros")
@require_auth
def crear_miembro():
    user = get_current_user()
    data = request.get_json() or {}
    errores = validar_miembro(data)
    if errores:
        return jsonify({"error": "Datos inválidos.", "campos": errores}), 400

    if user["rol"] == "admin":
        grupo_ids = data.get("grupo_ids") or ([data["grupo_id"]] if data.get("grupo_id") else [])
    else:
        grupo_ids = [user["grupo_id"]] if user["grupo_id"] else []

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(f"""
            INSERT INTO {SCHEMA}.miembros (nombre, cedula, telefono, tlf_alternativo, cargo, email)
            OUTPUT INSERTED.id
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (data["nombre"].strip(),
              normalizar_cedula(data.get("cedula")) or None,
              data.get("telefono") or None,
              data.get("tlf_alternativo") or None,
              data.get("cargo") or None,
              data.get("email") or None))
        new_id = cur.fetchone()[0]
    except Exception as ex:
        conn.close()
        if "UQ_miembros_cedula" in str(ex) or "2601" in str(ex) or "2627" in str(ex):
            return jsonify({"error": f"Ya existe un miembro registrado con la cédula {data.get('cedula')}."}), 409
        raise

    for gid in grupo_ids:
        cur.execute(f"""
            INSERT INTO {SCHEMA}.miembros_grupos (miembro_id, grupo_id)
            VALUES (%s, %s)
        """, (new_id, int(gid)))

    conn.commit()
    conn.close()
    return jsonify({"id": new_id, "nombre": data["nombre"]}), 201


@main_bp.put("/api/miembros/<int:miembro_id>")
@require_auth
def editar_miembro(miembro_id):
    user = get_current_user()
    data = request.get_json() or {}
    errores = validar_miembro(data)
    if errores:
        return jsonify({"error": "Datos inválidos.", "campos": errores}), 400

    conn = get_connection()
    cur = conn.cursor()

    # Grupo puede editar solo miembros de su grupo
    if user["rol"] == "grupo":
        cur.execute(f"""
            SELECT 1 FROM {SCHEMA}.miembros_grupos
            WHERE miembro_id = %s AND grupo_id = %s
        """, (miembro_id, user["grupo_id"]))
        if not cur.fetchone():
            conn.close()
            return jsonify({"error": "Acceso denegado"}), 403

    try:
        cur.execute(f"""
            UPDATE {SCHEMA}.miembros
            SET nombre=%s, cedula=%s, telefono=%s, tlf_alternativo=%s, cargo=%s, email=%s
            WHERE id=%s
        """, (data["nombre"].strip(),
              normalizar_cedula(data.get("cedula")) or None,
              data.get("telefono") or None,
              data.get("tlf_alternativo") or None,
              data.get("cargo") or None,
              data.get("email") or None,
              miembro_id))
        if cur.rowcount == 0:
            conn.close()
            return jsonify({"error": "Miembro no encontrado"}), 404
    except Exception as ex:
        conn.close()
        if "UQ_miembros_cedula" in str(ex) or "2601" in str(ex) or "2627" in str(ex):
            return jsonify({"error": f"Ya existe un miembro con la cédula {data.get('cedula')}."}), 409
        raise

    # Admin puede reasignar grupos
    if user["rol"] == "admin":
        grupo_ids = data.get("grupo_ids") or []
        if grupo_ids:
            cur.execute(f"DELETE FROM {SCHEMA}.miembros_grupos WHERE miembro_id = %s", (miembro_id,))
            for gid in grupo_ids:
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.miembros_grupos (miembro_id, grupo_id)
                    VALUES (%s, %s)
                """, (miembro_id, int(gid)))

    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@main_bp.delete("/api/miembros/<int:miembro_id>")
@require_auth
def eliminar_miembro(miembro_id):
    user = get_current_user()
    conn = get_connection()
    cur = conn.cursor()

    # Grupo puede eliminar solo miembros de su grupo
    if user["rol"] == "grupo":
        cur.execute(f"""
            SELECT 1 FROM {SCHEMA}.miembros_grupos
            WHERE miembro_id = %s AND grupo_id = %s
        """, (miembro_id, user["grupo_id"]))
        if not cur.fetchone():
            conn.close()
            return jsonify({"error": "Acceso denegado"}), 403

    # Verificar que no tenga actividades asignadas
    cur.execute(f"""
        SELECT COUNT(*) FROM {SCHEMA}.actividad_miembros WHERE miembro_id = %s
    """, (miembro_id,))
    if cur.fetchone()[0] > 0:
        conn.close()
        return jsonify({"error": "Este miembro tiene actividades asignadas y no puede eliminarse."}), 409

    cur.execute(f"DELETE FROM {SCHEMA}.miembros_grupos WHERE miembro_id = %s", (miembro_id,))
    cur.execute(f"DELETE FROM {SCHEMA}.miembros WHERE id = %s", (miembro_id,))
    if cur.rowcount == 0:
        conn.close()
        return jsonify({"error": "Miembro no encontrado"}), 404

    conn.commit()
    conn.close()
    return jsonify({"ok": True})

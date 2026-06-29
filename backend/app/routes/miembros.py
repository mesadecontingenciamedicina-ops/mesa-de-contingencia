from flask import request, jsonify
from . import main_bp
from ..db import get_connection
from ..validaciones import validar_miembro, normalizar_cedula
from ..auth import require_auth, get_current_user

@main_bp.get("/api/miembros")
@require_auth
def listar_miembros():
    user = get_current_user()
    conn = get_connection()
    cur = conn.cursor()
    if user["rol"] == "admin":
        cur.execute("""
            SELECT m.id, m.nombre, m.cedula, m.telefono, m.tlf_alternativo, m.cargo, m.email,
                   g.id, g.nombre
            FROM MesaDeContingencia.miembros m
            LEFT JOIN MesaDeContingencia.miembros_grupos mg ON mg.miembro_id = m.id
            LEFT JOIN MesaDeContingencia.grupos_trabajo g ON g.id = mg.grupo_id
            ORDER BY m.nombre
        """)
    else:
        cur.execute("""
            SELECT m.id, m.nombre, m.cedula, m.telefono, m.tlf_alternativo, m.cargo, m.email,
                   g.id, g.nombre
            FROM MesaDeContingencia.miembros m
            JOIN MesaDeContingencia.miembros_grupos mg ON mg.miembro_id = m.id
            JOIN MesaDeContingencia.grupos_trabajo g ON g.id = mg.grupo_id
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
        cur.execute("""
            INSERT INTO MesaDeContingencia.miembros (nombre, cedula, telefono, tlf_alternativo, cargo, email)
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
        cur.execute("""
            INSERT INTO MesaDeContingencia.miembros_grupos (miembro_id, grupo_id)
            VALUES (%s, %s)
        """, (new_id, int(gid)))

    conn.commit()
    conn.close()
    return jsonify({"id": new_id, "nombre": data["nombre"]}), 201

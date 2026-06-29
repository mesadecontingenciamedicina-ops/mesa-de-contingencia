from flask import request, jsonify
from . import main_bp
from ..db import get_connection, SCHEMA
from ..auth import require_auth


@main_bp.get("/api/insumos")
@require_auth
def buscar_insumos():
    q = (request.args.get("q") or "").strip()
    limit = min(int(request.args.get("limit", 20)), 50)
    conn = get_connection()
    cur = conn.cursor()
    if q:
        cur.execute(f"""
            SELECT TOP (%s) id, codigo, nombre, forma_farmaceutica, concentracion, volumen_peso
            FROM {SCHEMA}.insumos
            WHERE nombre LIKE %s OR forma_farmaceutica LIKE %s
            ORDER BY nombre, forma_farmaceutica
        """, (limit, f"%{q}%", f"%{q}%"))
    else:
        cur.execute(f"""
            SELECT TOP (%s) id, codigo, nombre, forma_farmaceutica, concentracion, volumen_peso
            FROM {SCHEMA}.insumos
            ORDER BY nombre, forma_farmaceutica
        """, (limit,))
    rows = [
        {"id": r[0], "codigo": r[1], "nombre": r[2],
         "forma_farmaceutica": r[3], "concentracion": r[4], "volumen_peso": r[5]}
        for r in cur.fetchall()
    ]
    conn.close()
    return jsonify(rows)

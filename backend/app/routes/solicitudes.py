from flask import request, jsonify
from . import main_bp
from ..db import get_connection
from ..auth import require_auth, require_admin, require_privileged, is_privileged, get_current_user
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
ESTADOS = ["Pendiente", "Aprobada", "Rechazada", "Resuelta"]

# Columnas devueltas por _select_base(), en orden:
# 0 id, 1 descripcion, 2 fecha_creacion, 3 fecha_actualizacion, 4 estado, 5 prioridad,
# 6 ubicacion, 7 fecha_hora, 8 lat, 9 lng, 10 receptor_nombre, 11 receptor_telefono,
# 12 solicitante_id, 13 solicitante_nombre, 14 solicitante_telefono, 15 solicitante_email,
# 16 origen_tipo, 17 origen_id, 18 origen_nombre,
# 19 aprobado_por_username, 20 aprobado_en, 21 rechazo_motivo,
# 22 reclamado_por_grupo_id, 23 reclamado_por_grupo_nombre, 24 reclamado_en,
# 25 tipo_solicitud

def _row_to_dict(r):
    return {
        "id": r[0], "descripcion": r[1],
        "fecha_creacion": str(r[2]),
        "fecha_actualizacion": str(r[3]) if r[3] else None,
        "estado": r[4], "prioridad": r[5] or "Normal",
        "ubicacion": r[6], "fecha_hora": str(r[7]) if r[7] else None,
        "lat": r[8], "lng": r[9],
        "receptor_nombre": r[10], "receptor_telefono": r[11],
        "solicitante": {"id": r[12], "nombre": r[13], "telefono": r[14], "email": r[15]} if r[12] else None,
        "origen": {"tipo": r[16], "id": r[17], "nombre": r[18]},
        "aprobado_por": r[19], "aprobado_en": str(r[20]) if r[20] else None,
        "rechazo_motivo": r[21],
        "reclamado_por": {"id": r[22], "nombre": r[23]} if r[22] else None,
        "reclamado_en": str(r[24]) if r[24] else None,
        "tipo_solicitud": r[25],
    }

def _select_base():
    return """
    SELECT s.id, s.descripcion, s.fecha_creacion, s.fecha_actualizacion, s.estado, s.prioridad,
           s.ubicacion, s.fecha_hora, s.lat, s.lng, s.receptor_nombre, s.receptor_telefono,
           s.solicitante_id, ms.nombre, ms.telefono, ms.email,
           CASE WHEN s.creado_por_grupo_id IS NOT NULL THEN 'grupo'
                WHEN s.creado_por_centro_id IS NOT NULL THEN 'centro'
                ELSE NULL END,
           COALESCE(s.creado_por_grupo_id, s.creado_por_centro_id),
           COALESCE(g.nombre, c.nombre),
           s.aprobado_por_username, s.aprobado_en, s.rechazo_motivo,
           s.reclamado_por_grupo_id, rg.nombre, s.reclamado_en,
           ts.nombre
    FROM solicitudes s
    LEFT JOIN grupos_trabajo g   ON g.id = s.creado_por_grupo_id
    LEFT JOIN centros_atencion c ON c.id = s.creado_por_centro_id
    LEFT JOIN grupos_trabajo rg  ON rg.id = s.reclamado_por_grupo_id
    LEFT JOIN miembros ms        ON ms.id = s.solicitante_id
    LEFT JOIN tipos_solicitud ts ON ts.id = s.tipo_solicitud_id
"""

ORDER = """ORDER BY
    CASE s.prioridad WHEN 'Alta' THEN 1 WHEN 'Normal' THEN 2 ELSE 3 END,
    s.fecha_creacion DESC"""


def _get_items(cur, solicitud_ids):
    """Returns dict: solicitud_id -> list of items (con cantidad_resuelta acumulada)."""
    if not solicitud_ids:
        return {}
    ids_str = ",".join(str(i) for i in solicitud_ids)
    cur.execute(f"""
        SELECT i.solicitud_id, i.id, i.nombre, i.cantidad, i.insumo_id, i.cantidad_flexible,
               COALESCE(SUM(a.cantidad), 0)
        FROM solicitud_items i
        LEFT JOIN solicitud_item_aportes a ON a.item_id = i.id
        WHERE i.solicitud_id IN ({ids_str})
        GROUP BY i.solicitud_id, i.id, i.nombre, i.cantidad, i.insumo_id, i.cantidad_flexible
        ORDER BY i.id
    """)
    result = {}
    for r in cur.fetchall():
        result.setdefault(r[0], []).append({
            "id": r[1], "nombre": r[2], "cantidad": r[3], "insumo_id": r[4],
            "cantidad_flexible": bool(r[5]), "cantidad_resuelta": r[6],
        })
    return result


def _resolve_insumo_id(cur, nombre_upper, insumo_id=None):
    """Return insumo_id: use provided, find by name, or create new."""
    if insumo_id:
        return insumo_id
    cur.execute("SELECT id FROM insumos WHERE nombre = %s", (nombre_upper,))
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute("INSERT INTO insumos (nombre) VALUES (%s) RETURNING id", (nombre_upper,))
    return cur.fetchone()[0]


def _insert_items(cur, solicitud_id, items):
    for item in (items or []):
        nombre = (item.get("nombre") or "").strip().upper()
        if not nombre:
            continue
        cantidad_flexible = bool(item.get("cantidad_flexible"))
        cantidad = 1 if cantidad_flexible else max(1, int(item.get("cantidad") or 1))
        insumo_id = _resolve_insumo_id(cur, nombre, item.get("insumo_id"))
        cur.execute("""
            INSERT INTO solicitud_items (solicitud_id, insumo_id, nombre, cantidad, cantidad_flexible)
            VALUES (%s, %s, %s, %s, %s)
        """, (solicitud_id, insumo_id, nombre, cantidad, cantidad_flexible))


def _rows_with_items(cur, rows):
    dicts = [_row_to_dict(r) for r in rows]
    ids = [d["id"] for d in dicts]
    items_map = _get_items(cur, ids)
    for d in dicts:
        d["items"] = items_map.get(d["id"], [])
    return dicts


def _tipo_solicitud_id(cur, nombre):
    cur.execute("SELECT id FROM tipos_solicitud WHERE nombre = %s", (nombre,))
    return cur.fetchone()[0]


def _log(cur, solicitud_id, evento, user, detalle=None):
    cur.execute("""
        INSERT INTO solicitud_log (solicitud_id, evento, usuario, rol, detalle)
        VALUES (%s, %s, %s, %s, %s)
    """, (solicitud_id, evento, user["username"], user["rol"], detalle))


def _notificar_creador(cur, sol_id, texto):
    cur.execute("SELECT creado_por_grupo_id FROM solicitudes WHERE id = %s", (sol_id,))
    row = cur.fetchone()
    if row and row[0]:
        cur.execute("""
            INSERT INTO notificaciones (para_rol, para_grupo_id, solicitud_id, texto)
            VALUES ('grupo', %s, %s, %s)
        """, (row[0], sol_id, texto))
    # Los centros aún no tienen feed de notificaciones (ver contexto.md); se enteran
    # al refrescar su lista de solicitudes.


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
    if grupo_id:
        tipo_nombre = "Grupo"
    elif centro_id:
        tipo_nombre = "Centro"
    elif user["rol"] == "admin":
        tipo_nombre = "Administración"
    else:
        tipo_nombre = "Externos"
    tipo_solicitud_id = _tipo_solicitud_id(cur, tipo_nombre)
    cur.execute("""
        INSERT INTO solicitudes
            (descripcion, creado_por_grupo_id, creado_por_centro_id, ubicacion, fecha_hora,
             prioridad, lat, lng, solicitante_id, receptor_nombre, receptor_telefono, tipo_solicitud_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id, fecha_creacion
    """, (descripcion, grupo_id, centro_id,
          data.get("ubicacion"), _parse_fecha(data.get("fecha_hora")),
          prioridad,
          data.get("lat"), data.get("lng"),
          data.get("solicitante_id") or None,
          (data.get("receptor_nombre") or "").strip() or None,
          (data.get("receptor_telefono") or "").strip() or None,
          tipo_solicitud_id))
    row = cur.fetchone()
    new_id = row[0]
    _insert_items(cur, new_id, data.get("items", []))
    _log(cur, new_id, "creada", user)
    conn.commit()
    conn.close()
    return jsonify({"id": new_id, "descripcion": descripcion, "fecha_creacion": str(row[1]), "estado": "Pendiente"}), 201


@main_bp.put("/api/solicitudes/<int:sol_id>")
@require_auth
def editar_solicitud(sol_id):
    user = get_current_user()
    data = request.get_json() or {}
    descripcion = data.get("descripcion", "").strip()
    if not descripcion:
        return jsonify({"error": "La descripción es obligatoria"}), 400
    prioridad = data.get("prioridad", "Normal")
    if prioridad not in PRIORIDADES:
        return jsonify({"error": "Prioridad inválida"}), 400

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT creado_por_grupo_id, creado_por_centro_id, estado
        FROM solicitudes WHERE id = %s
    """, (sol_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Solicitud no encontrada"}), 404
    if user["rol"] == "grupo" and row[0] != user["grupo_id"]:
        conn.close()
        return jsonify({"error": "Acceso denegado"}), 403
    if user["rol"] == "centro" and row[1] != user["centro_id"]:
        conn.close()
        return jsonify({"error": "Acceso denegado"}), 403

    estado_actual = row[2]
    if estado_actual not in ("Pendiente", "Rechazada"):
        conn.close()
        motivo = "está siendo procesada por otro grupo" if estado_actual == "Aprobada" else "ya fue resuelta"
        return jsonify({"error": f"No se puede editar: esta solicitud ya fue aprobada y {motivo}"
                                   if estado_actual == "Aprobada" else f"No se puede editar: {motivo}"}), 409

    reenviada = estado_actual == "Rechazada"
    cur.execute("""
        UPDATE solicitudes
        SET descripcion=%s, prioridad=%s, ubicacion=%s, fecha_hora=%s,
            lat=%s, lng=%s, solicitante_id=%s, receptor_nombre=%s, receptor_telefono=%s,
            estado = 'Pendiente', rechazo_motivo = NULL, fecha_actualizacion=NOW()
        WHERE id=%s
    """, (descripcion, prioridad,
          data.get("ubicacion") or None, _parse_fecha(data.get("fecha_hora")),
          data.get("lat"), data.get("lng"),
          data.get("solicitante_id") or None,
          (data.get("receptor_nombre") or "").strip() or None,
          (data.get("receptor_telefono") or "").strip() or None,
          sol_id))
    cur.execute("DELETE FROM solicitud_items WHERE solicitud_id=%s", (sol_id,))
    _insert_items(cur, sol_id, data.get("items", []))
    _log(cur, sol_id, "reenviada" if reenviada else "editada", user)
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@main_bp.delete("/api/solicitudes/<int:sol_id>")
@require_auth
def eliminar_solicitud(sol_id):
    user = get_current_user()
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT creado_por_grupo_id, creado_por_centro_id, estado FROM solicitudes WHERE id = %s", (sol_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Solicitud no encontrada"}), 404
    if not is_privileged(user):
        es_dueno = (user["rol"] == "grupo" and row[0] == user["grupo_id"]) or \
                   (user["rol"] == "centro" and row[1] == user["centro_id"])
        if not es_dueno or row[2] != "Pendiente":
            conn.close()
            return jsonify({"error": "Solo puedes eliminar tus propias solicitudes mientras estén Pendientes"}), 403
    cur.execute("DELETE FROM solicitudes WHERE id = %s", (sol_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@main_bp.get("/api/solicitudes/mis-centro")
def solicitudes_centro():
    user = get_current_user()
    if not user or user["rol"] != "centro":
        return jsonify({"error": "Acceso denegado"}), 403
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(_select_base() + " WHERE s.creado_por_centro_id = %s " + ORDER, (user["centro_id"],))
    rows = _rows_with_items(cur, cur.fetchall())
    conn.close()
    return jsonify(rows)


@main_bp.get("/api/solicitudes")
@require_auth
def listar_solicitudes():
    user = get_current_user()
    estado_filtro = request.args.get("estado")
    if estado_filtro and estado_filtro not in ESTADOS:
        return jsonify({"error": f"Estado inválido. Valores: {ESTADOS}"}), 400
    conn = get_connection()
    cur = conn.cursor()
    if is_privileged(user):
        sql = _select_base()
        params = []
        if estado_filtro:
            sql += " WHERE s.estado = %s "
            params.append(estado_filtro)
        cur.execute(sql + ORDER, params)
    else:
        sql = _select_base() + " WHERE s.creado_por_grupo_id = %s "
        params = [user["grupo_id"]]
        if estado_filtro:
            sql += " AND s.estado = %s "
            params.append(estado_filtro)
        cur.execute(sql + ORDER, params)
    rows = _rows_with_items(cur, cur.fetchall())
    conn.close()
    return jsonify(rows)


@main_bp.get("/api/solicitudes/aprobadas")
@require_auth
def solicitudes_aprobadas():
    """Tablero colaborativo: solicitudes Aprobadas (incluye 'En Proceso'), visibles para
    todos los grupos de trabajo. Los centros no participan de la resolución."""
    user = get_current_user()
    if user["rol"] == "centro":
        return jsonify({"error": "Acceso denegado"}), 403
    centro_id = request.args.get("centro_id")
    grupo_id = request.args.get("grupo_id")
    conn = get_connection()
    cur = conn.cursor()
    sql = _select_base() + " WHERE s.estado = 'Aprobada' "
    params = []
    if centro_id:
        sql += " AND s.creado_por_centro_id = %s "
        params.append(centro_id)
    if grupo_id:
        sql += " AND s.creado_por_grupo_id = %s "
        params.append(grupo_id)
    cur.execute(sql + ORDER, params)
    rows = _rows_with_items(cur, cur.fetchall())
    conn.close()
    return jsonify(rows)


@main_bp.put("/api/solicitudes/<int:sol_id>/aprobar")
@require_privileged
def aprobar_solicitud(sol_id):
    user = get_current_user()
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT estado FROM solicitudes WHERE id = %s", (sol_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Solicitud no encontrada"}), 404
    if row[0] != "Pendiente":
        conn.close()
        return jsonify({"error": "Solo se pueden aprobar solicitudes Pendientes"}), 409
    cur.execute("""
        UPDATE solicitudes
        SET estado = 'Aprobada', aprobado_por_username = %s, aprobado_en = NOW(), fecha_actualizacion = NOW()
        WHERE id = %s
    """, (user["username"], sol_id))
    _log(cur, sol_id, "aprobada", user)
    _notificar_creador(cur, sol_id, "✅ Tu solicitud fue aprobada y ya está disponible para que un grupo la resuelva.")
    conn.commit()
    conn.close()
    return jsonify({"id": sol_id, "estado": "Aprobada"})


@main_bp.put("/api/solicitudes/<int:sol_id>/rechazar")
@require_privileged
def rechazar_solicitud(sol_id):
    user = get_current_user()
    data = request.get_json() or {}
    motivo = (data.get("motivo") or "").strip()
    if not motivo:
        return jsonify({"error": "El motivo de rechazo es obligatorio"}), 400
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT estado FROM solicitudes WHERE id = %s", (sol_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Solicitud no encontrada"}), 404
    if row[0] != "Pendiente":
        conn.close()
        return jsonify({"error": "Solo se pueden rechazar solicitudes Pendientes"}), 409
    cur.execute("""
        UPDATE solicitudes
        SET estado = 'Rechazada', rechazo_motivo = %s, fecha_actualizacion = NOW()
        WHERE id = %s
    """, (motivo, sol_id))
    _log(cur, sol_id, "rechazada", user, detalle=motivo)
    _notificar_creador(cur, sol_id, f"❌ Tu solicitud fue rechazada: {motivo[:150]}")
    conn.commit()
    conn.close()
    return jsonify({"id": sol_id, "estado": "Rechazada"})


@main_bp.put("/api/solicitudes/<int:sol_id>/reclamar")
@require_auth
def reclamar_solicitud(sol_id):
    user = get_current_user()
    if user["rol"] != "grupo":
        return jsonify({"error": "Solo un grupo de trabajo puede reclamar solicitudes"}), 403
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT estado, reclamado_por_grupo_id FROM solicitudes WHERE id = %s", (sol_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Solicitud no encontrada"}), 404
    if row[0] != "Aprobada":
        conn.close()
        return jsonify({"error": "Solo se pueden reclamar solicitudes Aprobadas"}), 409
    if row[1]:
        conn.close()
        return jsonify({"error": "Esta solicitud ya fue reclamada por otro grupo"}), 409
    cur.execute("""
        UPDATE solicitudes SET reclamado_por_grupo_id = %s, reclamado_en = NOW(), fecha_actualizacion = NOW()
        WHERE id = %s
    """, (user["grupo_id"], sol_id))
    _log(cur, sol_id, "reclamada", user)
    conn.commit()
    conn.close()
    return jsonify({"id": sol_id, "estado": "Aprobada", "reclamado_por_grupo_id": user["grupo_id"]})


def _item_cubierto(cur, item_id):
    cur.execute("""
        SELECT i.cantidad, i.cantidad_flexible, COALESCE(SUM(a.cantidad), 0)
        FROM solicitud_items i
        LEFT JOIN solicitud_item_aportes a ON a.item_id = i.id
        WHERE i.id = %s
        GROUP BY i.id, i.cantidad, i.cantidad_flexible
    """, (item_id,))
    cantidad, flexible, aportado = cur.fetchone()
    if flexible:
        return None  # los ítems flexibles nunca se auto-completan
    return aportado >= cantidad


def _guardar_aportes(cur, sol_id, user, aportes):
    for aporte in aportes:
        item_id = aporte.get("item_id")
        cantidad = int(aporte.get("cantidad") or 0)
        if not item_id or cantidad <= 0:
            continue
        cur.execute("SELECT id FROM solicitud_items WHERE id = %s AND solicitud_id = %s", (item_id, sol_id))
        if not cur.fetchone():
            continue
        cur.execute("""
            INSERT INTO solicitud_item_aportes (item_id, grupo_id, cantidad, comentario)
            VALUES (%s, %s, %s, %s)
        """, (item_id, user["grupo_id"], cantidad, (aporte.get("comentario") or "").strip() or None))


@main_bp.put("/api/solicitudes/<int:sol_id>/liberar")
@require_auth
def liberar_solicitud(sol_id):
    user = get_current_user()
    data = request.get_json() or {}
    aportes = data.get("aportes", [])

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT estado, reclamado_por_grupo_id FROM solicitudes WHERE id = %s", (sol_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Solicitud no encontrada"}), 404
    if row[0] != "Aprobada" or row[1] is None:
        conn.close()
        return jsonify({"error": "Esta solicitud no está reclamada"}), 409
    if row[1] != user.get("grupo_id"):
        conn.close()
        return jsonify({"error": "Solo el grupo que la reclamó puede liberarla"}), 403

    _guardar_aportes(cur, sol_id, user, aportes)

    cur.execute("SELECT id, cantidad_flexible FROM solicitud_items WHERE solicitud_id = %s", (sol_id,))
    items = cur.fetchall()
    hay_flexibles = any(flexible for _id, flexible in items)
    todo_cubierto = bool(items) and not hay_flexibles and all(
        _item_cubierto(cur, item_id) for item_id, _flex in items
    )

    detalle = f"{len(aportes)} ítem(s) aportado(s)" if aportes else "liberada sin aportes"
    if todo_cubierto:
        cur.execute("""
            UPDATE solicitudes SET estado = 'Resuelta', fecha_actualizacion = NOW()
            WHERE id = %s
        """, (sol_id,))
        _log(cur, sol_id, "resuelta", user, detalle=detalle)
        _notificar_creador(cur, sol_id, "📦 Tu solicitud fue resuelta por completo.")
        nuevo_estado = "Resuelta"
    else:
        cur.execute("""
            UPDATE solicitudes SET reclamado_por_grupo_id = NULL, reclamado_en = NULL, fecha_actualizacion = NOW()
            WHERE id = %s
        """, (sol_id,))
        _log(cur, sol_id, "liberada", user, detalle=detalle)
        if aportes:
            _notificar_creador(cur, sol_id, "📦 Un grupo aportó a tu solicitud. Sigue disponible para completarla.")
        nuevo_estado = "Aprobada"

    conn.commit()
    conn.close()
    return jsonify({"id": sol_id, "estado": nuevo_estado})


@main_bp.put("/api/solicitudes/<int:sol_id>/marcar-resuelta")
@require_auth
def marcar_resuelta_solicitud(sol_id):
    """Fuerza el cierre de una solicitud que el grupo reclamante considera completa,
    guardando de paso cualquier aporte pendiente (misma lógica que /liberar, pero sin
    soltar el reclamo aunque no se hayan cubierto todos los ítems)."""
    user = get_current_user()
    data = request.get_json() or {}
    aportes = data.get("aportes", [])
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT estado, reclamado_por_grupo_id FROM solicitudes WHERE id = %s", (sol_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Solicitud no encontrada"}), 404
    if row[0] != "Aprobada" or row[1] is None:
        conn.close()
        return jsonify({"error": "Esta solicitud no está reclamada"}), 409
    if row[1] != user.get("grupo_id"):
        conn.close()
        return jsonify({"error": "Solo el grupo que la reclamó puede marcarla como resuelta"}), 403
    _guardar_aportes(cur, sol_id, user, aportes)
    cur.execute("""
        UPDATE solicitudes SET estado = 'Resuelta', fecha_actualizacion = NOW()
        WHERE id = %s
    """, (sol_id,))
    detalle = f"marcada manualmente, {len(aportes)} ítem(s) aportado(s)" if aportes else "marcada manualmente"
    _log(cur, sol_id, "resuelta", user, detalle=detalle)
    _notificar_creador(cur, sol_id, "📦 Tu solicitud fue marcada como resuelta.")
    conn.commit()
    conn.close()
    return jsonify({"id": sol_id, "estado": "Resuelta"})

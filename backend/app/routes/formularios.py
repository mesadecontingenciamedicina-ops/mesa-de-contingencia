import uuid
import json
from flask import request, jsonify
from . import main_bp
from ..db import get_connection
from ..auth import require_auth, require_admin, get_current_user

# 1. Obtener formularios
@main_bp.route("/api/formularios", methods=["GET"])
@require_auth
def get_formularios():
    user = get_current_user()
    conn = get_connection()
    cur = conn.cursor()
    
    # Filtros según rol
    if user["rol"] == "admin":
        cur.execute("""
            SELECT f.id, f.creado_por_rol, f.titulo, f.estado, f.token_publico, f.fecha_creacion,
                   g.nombre, c.nombre
            FROM formularios f
            LEFT JOIN grupos_trabajo g ON f.grupo_id = g.id
            LEFT JOIN centros_atencion c ON f.centro_id = c.id
            ORDER BY f.fecha_creacion DESC
        """)
    elif user["rol"] == "grupo":
        cur.execute("""
            SELECT f.id, f.creado_por_rol, f.titulo, f.estado, f.token_publico, f.fecha_creacion,
                   g.nombre, c.nombre
            FROM formularios f
            LEFT JOIN grupos_trabajo g ON f.grupo_id = g.id
            LEFT JOIN centros_atencion c ON f.centro_id = c.id
            WHERE f.grupo_id = %s
            ORDER BY f.fecha_creacion DESC
        """, (user["grupo_id"],))
    else: # centro
        cur.execute("""
            SELECT f.id, f.creado_por_rol, f.titulo, f.estado, f.token_publico, f.fecha_creacion,
                   g.nombre, c.nombre
            FROM formularios f
            LEFT JOIN grupos_trabajo g ON f.grupo_id = g.id
            LEFT JOIN centros_atencion c ON f.centro_id = c.id
            WHERE f.centro_id = %s
            ORDER BY f.fecha_creacion DESC
        """, (user["centro_id"],))
        
    filas = cur.fetchall()
    conn.close()
    
    resultado = []
    for r in filas:
        creador_nombre = "Administración"
        if r[1] == "grupo" and r[6]:
            creador_nombre = r[6]
        elif r[1] == "centro" and r[7]:
            creador_nombre = r[7]
            
        resultado.append({
            "id": r[0],
            "creado_por_rol": r[1],
            "titulo": r[2],
            "estado": r[3],
            "token_publico": str(r[4]) if r[4] else None,
            "fecha_creacion": r[5].isoformat() if r[5] else None,
            "creador_nombre": creador_nombre
        })
        
    return jsonify(resultado), 200

# 2. Crear formulario
@main_bp.route("/api/formularios", methods=["POST"])
@require_auth
def create_formulario():
    user = get_current_user()
    data = request.json
    titulo = data.get("titulo")
    configuracion = data.get("configuracion", [])
    
    if not titulo:
        return jsonify({"error": "El título es requerido"}), 400
        
    conn = get_connection()
    cur = conn.cursor()
    
    rol = user["rol"]
    grupo_id = user.get("grupo_id")
    centro_id = user.get("centro_id")
    
    # Si lo crea admin, nace aprobado y con token. Si no, pendiente.
    estado = "Aprobado" if rol == "admin" else "Pendiente"
    token_publico = str(uuid.uuid4()) if rol == "admin" else None
    
    try:
        cur.execute("""
            INSERT INTO formularios (creado_por_rol, grupo_id, centro_id, titulo, configuracion, estado, token_publico)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (rol, grupo_id, centro_id, titulo, json.dumps(configuracion), estado, token_publico))
        form_id = cur.fetchone()[0]
        
        # Si es pendiente, notificar a admins
        if estado == "Pendiente":
            cur.execute("""
                INSERT INTO notificaciones (para_rol, texto)
                VALUES ('admin', %s)
            """, (f"Nuevo formulario pendiente de aprobación: {titulo}",))
            
        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": str(e)}), 500
        
    conn.close()
    return jsonify({"id": form_id, "estado": estado, "token_publico": token_publico}), 201

# 3. Aprobar formulario
@main_bp.route("/api/formularios/<int:form_id>/aprobar", methods=["PUT"])
@require_admin
def approve_formulario(form_id):
    conn = get_connection()
    cur = conn.cursor()
    
    token = str(uuid.uuid4())
    cur.execute("""
        UPDATE formularios
        SET estado = 'Aprobado', token_publico = %s
        WHERE id = %s AND estado = 'Pendiente'
        RETURNING id, creado_por_rol, grupo_id, centro_id, titulo
    """, (token, form_id))
    
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Formulario no encontrado o ya aprobado"}), 404
        
    _, creado_por_rol, grupo_id, centro_id, titulo = row

    if creado_por_rol == "grupo" and grupo_id:
        cur.execute("""
            INSERT INTO notificaciones (para_rol, para_grupo_id, texto)
            VALUES ('grupo', %s, %s)
        """, (grupo_id, f"Tu formulario '{titulo}' ha sido aprobado. Ya puedes compartir su enlace."))
    elif creado_por_rol == "centro" and centro_id:
        cur.execute("""
            INSERT INTO notificaciones (para_rol, para_grupo_id, texto)
            VALUES ('centro', %s, %s)
        """, (centro_id, f"Tu formulario '{titulo}' ha sido aprobado. Ya puedes compartir su enlace."))

    conn.commit()
    conn.close()
    return jsonify({"token_publico": token}), 200

# 4. Obtener respuestas de un formulario (analytics)
@main_bp.route("/api/formularios/<int:form_id>/respuestas", methods=["GET"])
@require_auth
def get_respuestas(form_id):
    # Deberíamos chequear permisos (si es admin o creador)
    user = get_current_user()
    conn = get_connection()
    cur = conn.cursor()
    
    cur.execute("""
        SELECT configuracion FROM formularios WHERE id = %s
    """, (form_id,))
    form_data = cur.fetchone()
    if not form_data:
        conn.close()
        return jsonify({"error": "Formulario no encontrado"}), 404
        
    cur.execute("""
        SELECT id, respuestas, lat, lng, fecha_creacion
        FROM formulario_respuestas
        WHERE formulario_id = %s
        ORDER BY fecha_creacion DESC
    """, (form_id,))
    
    respuestas = []
    for r in cur.fetchall():
        respuestas.append({
            "id": r[0],
            "respuestas": r[1],
            "lat": r[2],
            "lng": r[3],
            "fecha_creacion": r[4].isoformat() if r[4] else None
        })
        
    conn.close()
    return jsonify({"configuracion": form_data[0], "respuestas": respuestas}), 200

# 5. VISTA PÚBLICA: Obtener config de form
@main_bp.route("/api/public/formularios/<token>", methods=["GET"])
def get_public_form(token):
    conn = get_connection()
    cur = conn.cursor()
    
    cur.execute("""
        SELECT f.id, f.titulo, f.configuracion, f.creado_por_rol, g.nombre, c.nombre
        FROM formularios f
        LEFT JOIN grupos_trabajo g ON f.grupo_id = g.id
        LEFT JOIN centros_atencion c ON f.centro_id = c.id
        WHERE f.token_publico = %s AND f.estado = 'Aprobado'
    """, (token,))
    
    r = cur.fetchone()
    conn.close()
    
    if not r:
        return jsonify({"error": "Formulario inválido o inactivo"}), 404
        
    creador_nombre = "Administración"
    if r[3] == "grupo" and r[4]:
        creador_nombre = r[4]
    elif r[3] == "centro" and r[5]:
        creador_nombre = r[5]
        
    return jsonify({
        "id": r[0],
        "titulo": r[1],
        "configuracion": r[2],
        "creado_por_rol": r[3],
        "creador_nombre": creador_nombre
    }), 200

# 6. VISTA PÚBLICA: Enviar respuesta
@main_bp.route("/api/public/formularios/<token>/respuestas", methods=["POST"])
def submit_public_form(token):
    data = request.json
    respuestas = data.get("respuestas", {})
    lat = data.get("lat")
    lng = data.get("lng")
    
    conn = get_connection()
    cur = conn.cursor()
    
    cur.execute("SELECT id FROM formularios WHERE token_publico = %s AND estado = 'Aprobado'", (token,))
    r = cur.fetchone()
    if not r:
        conn.close()
        return jsonify({"error": "Formulario inválido o inactivo"}), 404
        
    form_id = r[0]
    
    try:
        cur.execute("""
            INSERT INTO formulario_respuestas (formulario_id, respuestas, lat, lng)
            VALUES (%s, %s, %s, %s)
            RETURNING id
        """, (form_id, json.dumps(respuestas), lat, lng))
        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": str(e)}), 500
        
    conn.close()
    return jsonify({"status": "ok"}), 201

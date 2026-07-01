import os
import jwt
import datetime
from functools import wraps
from flask import request, jsonify
from werkzeug.security import check_password_hash
from .db import get_connection

SECRET = os.getenv("JWT_SECRET", "mesa-contingencia-secret-key-2026")
ALGO = "HS256"
TTL_HOURS = 8


def login_user(username, password):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id, u.username, u.password_hash, u.rol, u.grupo_id, g.nombre,
               u.centro_id, c.nombre, c.lat, c.lng, c.direccion, g.es_coordinador
        FROM usuarios u
        LEFT JOIN grupos_trabajo g ON g.id = u.grupo_id
        LEFT JOIN centros_atencion c ON c.id = u.centro_id
        WHERE u.username = %s AND u.activo = TRUE
    """, (username,))
    row = cur.fetchone()
    conn.close()
    if not row or not check_password_hash(row[2], password):
        return None

    user = {
        "id": row[0], "username": row[1], "rol": row[3],
        "grupo_id": row[4], "grupo_nombre": row[5],
        "centro_id": row[6], "centro_nombre": row[7],
        "centro_lat": float(row[8]) if row[8] is not None else None,
        "centro_lng": float(row[9]) if row[9] is not None else None,
        "centro_direccion": row[10],
        "es_coordinador": bool(row[11]) if row[11] is not None else False,
    }
    payload = {**user, "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=TTL_HOURS)}
    token = jwt.encode(payload, SECRET, algorithm=ALGO)
    return token, user


def logout_token(token):
    pass


def get_current_user():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:]
    try:
        payload = jwt.decode(token, SECRET, algorithms=[ALGO])
        payload.pop("exp", None)
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "No autenticado"}), 401
        return f(*args, **kwargs)
    return decorated


def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "No autenticado"}), 401
        if user["rol"] != "admin":
            return jsonify({"error": "Acceso denegado"}), 403
        return f(*args, **kwargs)
    return decorated


def is_privileged(user):
    """Admin o grupo coordinador"""
    if not user:
        return False
    if user.get("rol") == "admin":
        return True
    return user.get("rol") == "grupo" and user.get("es_coordinador", False)


def require_privileged(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "No autenticado"}), 401
        if not is_privileged(user):
            return jsonify({"error": "Acceso denegado"}), 403
        return f(*args, **kwargs)
    return decorated

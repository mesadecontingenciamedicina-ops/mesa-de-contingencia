from flask import Blueprint

main_bp = Blueprint("main", __name__)

from . import health, auth_routes, miembros, grupos, solicitudes, actividades, comentarios, centros, insumos, publicaciones  # noqa

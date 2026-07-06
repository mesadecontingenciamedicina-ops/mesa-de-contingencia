from flask import Blueprint

main_bp = Blueprint("main", __name__)

from . import health, auth_routes, miembros, grupos, solicitudes, tareas, comentarios, centros, insumos, publicaciones, formularios  # noqa

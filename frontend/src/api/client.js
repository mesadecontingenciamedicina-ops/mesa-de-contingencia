const rawBase = import.meta.env.VITE_API_BASE_URL?.trim() || "/api";
const BASE = rawBase.endsWith("/") ? rawBase.slice(0, -1) : rawBase;

function getToken() {
  try {
    const stored = localStorage.getItem("mesa_auth");
    return stored ? JSON.parse(stored).token : null;
  } catch { return null; }
}

async function req(method, path, body) {
  const token = getToken();
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);

  if (res.status === 401 && !path.includes("/login")) {
    // Sesión expirada o token inválido — notificar a la app
    window.dispatchEvent(new CustomEvent("session-expired"));
    throw new Error("Sesión expirada");
  }

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    const fallbackText = !isJson ? await res.text() : "";
    const err = new Error(
      data?.error ||
      data?.message ||
      fallbackText ||
      `Error ${res.status}: ${res.statusText}`
    );
    if (data?.campos) err.campos = data.campos;
    throw err;
  }

  return data;
}

export const api = {
  login: (username, password) => req("POST", "/login", { username, password }),
  logout: () => req("POST", "/logout"),
  me: () => req("GET", "/me"),

  getMiembros: () => req("GET", "/miembros"),
  crearMiembro: (d) => req("POST", "/miembros", d),
  editarMiembro: (id, d) => req("PUT", `/miembros/${id}`, d),
  eliminarMiembro: (id) => req("DELETE", `/miembros/${id}`),

  getGrupos: () => req("GET", "/grupos"),
  crearGrupo: (d) => req("POST", "/grupos", d),
  eliminarGrupo: (id) => req("DELETE", `/grupos/${id}`),
  editarGrupo: (id, d) => req("PUT", `/grupos/${id}`, d),
  getUsuarioGrupo: (id) => req("GET", `/grupos/${id}/usuario`),
  crearUsuarioGrupo: (id, d) => req("POST", `/grupos/${id}/usuario`, d),
  cambiarPasswordGrupo: (id, d) => req("PUT", `/grupos/${id}/usuario`, d),

  getCentros: () => req("GET", "/centros"),
  crearCentro: (d) => req("POST", "/centros", d),
  editarCentro: (id, d) => req("PUT", `/centros/${id}`, d),
  eliminarCentro: (id) => req("DELETE", `/centros/${id}`),
  getUsuarioCentro: (id) => req("GET", `/centros/${id}/usuario`),
  cambiarPasswordCentro: (id, d) => req("PUT", `/centros/${id}/usuario`, d),
  getMisContactos: () => req("GET", "/centros/mis-contactos"),
  getSolicitudesCentro: () => req("GET", "/solicitudes/mis-centro"),

  getSolicitudes: (estado) => req("GET", `/solicitudes${estado ? `?estado=${encodeURIComponent(estado)}` : ""}`),
  crearSolicitud: (d) => req("POST", "/solicitudes", d),
  editarSolicitud: (id, d) => req("PUT", `/solicitudes/${id}`, d),
  eliminarSolicitud: (id) => req("DELETE", `/solicitudes/${id}`),
  aprobarSolicitud: (id) => req("PUT", `/solicitudes/${id}/aprobar`),
  rechazarSolicitud: (id, motivo) => req("PUT", `/solicitudes/${id}/rechazar`, { motivo }),

  getSolicitudesAprobadas: ({ centro_id, grupo_id } = {}) => {
    const params = new URLSearchParams();
    if (centro_id) params.set("centro_id", centro_id);
    if (grupo_id) params.set("grupo_id", grupo_id);
    const qs = params.toString();
    return req("GET", `/solicitudes/aprobadas${qs ? `?${qs}` : ""}`);
  },
  reclamarSolicitud: (id) => req("PUT", `/solicitudes/${id}/reclamar`),
  liberarSolicitud: (id, aportes, mensaje) => req("PUT", `/solicitudes/${id}/liberar`, { aportes, mensaje }),
  marcarResueltaSolicitud: (id, aportes = [], mensaje) => req("PUT", `/solicitudes/${id}/marcar-resuelta`, { aportes, mensaje }),
  getHistorialSolicitud: (id) => req("GET", `/solicitudes/${id}/historial`),

  buscarInsumos: (q) => req("GET", `/insumos?q=${encodeURIComponent(q)}&limit=10`),

  getTareas: () => req("GET", "/tareas"),
  crearTarea: (d) => req("POST", "/tareas", d),
  actualizarTarea: (id, estado) => req("PUT", `/tareas/${id}`, { estado }),
  editarDescripcionTarea: (id, descripcion) => req("PUT", `/tareas/${id}`, { descripcion }),
  archivarTarea: (id) => req("DELETE", `/tareas/${id}`),
  setMiembrosTarea: (id, miembro_ids) => req("PUT", `/tareas/${id}/miembros`, { miembro_ids }),

  getComentariosTarea: (tarea_id) => req("GET", `/tareas/${tarea_id}/comentarios`),
  crearComentarioTarea: (tarea_id, texto) => req("POST", `/tareas/${tarea_id}/comentarios`, { texto }),

  getNotificaciones: () => req("GET", "/notificaciones"),
  marcarLeida: (id) => req("PUT", `/notificaciones/${id}/leer`),
  leerTodas: () => req("POST", "/notificaciones/leer-todas"),

  getPublicaciones: () => req("GET", "/publicaciones"),
  crearPublicacion: (d) => req("POST", "/publicaciones", d),
  eliminarPublicacion: (id) => req("DELETE", `/publicaciones/${id}`),

  getComentariosPub: (pubId) => req("GET", `/publicaciones/${pubId}/comentarios`),
  crearComentarioPub: (pubId, texto) => req("POST", `/publicaciones/${pubId}/comentarios`, { texto }),
  eliminarComentarioPub: (pubId, cid) => req("DELETE", `/publicaciones/${pubId}/comentarios/${cid}`),

  getFormularios: () => req("GET", "/formularios"),
  crearFormulario: (d) => req("POST", "/formularios", d),
  aprobarFormulario: (id) => req("PUT", `/formularios/${id}/aprobar`),
  getFormularioRespuestas: (id) => req("GET", `/formularios/${id}/respuestas`),
  getPublicFormulario: (token) => req("GET", `/public/formularios/${token}`),
  submitPublicFormulario: (token, d) => req("POST", `/public/formularios/${token}/respuestas`, d),
};

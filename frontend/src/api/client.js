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

  if (res.status === 401) {
    // Sesión expirada o token inválido — notificar a la app
    window.dispatchEvent(new CustomEvent("session-expired"));
    throw new Error("Sesión expirada");
  }

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    const fallbackText = !isJson ? await res.text() : "";
    throw new Error(
      data?.error ||
      data?.message ||
      fallbackText ||
      `Error ${res.status}: ${res.statusText}`
    );
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
  regenerarPasswordCentro: (id) => req("PUT", `/centros/${id}/usuario`),
  getSolicitudesCentro: () => req("GET", "/solicitudes/mis-centro"),

  getSolicitudesPendientes: () => req("GET", "/solicitudes/pendientes"),
  getSolicitudes: () => req("GET", "/solicitudes"),
  crearSolicitud: (d) => req("POST", "/solicitudes", d),
  editarSolicitud: (id, d) => req("PUT", `/solicitudes/${id}`, d),
  eliminarSolicitud: (id) => req("DELETE", `/solicitudes/${id}`),

  buscarInsumos: (q) => req("GET", `/insumos?q=${encodeURIComponent(q)}&limit=10`),

  getActividades: () => req("GET", "/actividades"),
  crearActividad: (d) => req("POST", "/actividades", d),
  crearActividadRapida: (d) => req("POST", "/actividades/rapida", d),
  actualizarActividad: (id, estado) => req("PUT", `/actividades/${id}`, { estado }),
  setMiembrosActividad: (id, miembro_ids) => req("PUT", `/actividades/${id}/miembros`, { miembro_ids }),

  getComentarios: (act_id) => req("GET", `/actividades/${act_id}/comentarios`),
  crearComentario: (act_id, texto) => req("POST", `/actividades/${act_id}/comentarios`, { texto }),

  getNotificaciones: () => req("GET", "/notificaciones"),
  marcarLeida: (id) => req("PUT", `/notificaciones/${id}/leer`),
  leerTodas: () => req("POST", "/notificaciones/leer-todas"),
};

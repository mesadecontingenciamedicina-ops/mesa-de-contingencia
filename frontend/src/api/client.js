const BASE = "/api";

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

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export const api = {
  login: (username, password) => req("POST", "/login", { username, password }),
  logout: () => req("POST", "/logout"),
  me: () => req("GET", "/me"),

  getMiembros: () => req("GET", "/miembros"),
  crearMiembro: (d) => req("POST", "/miembros", d),

  getGrupos: () => req("GET", "/grupos"),
  editarGrupo: (id, d) => req("PUT", `/grupos/${id}`, d),
  getUsuarioGrupo: (id) => req("GET", `/grupos/${id}/usuario`),
  crearUsuarioGrupo: (id, d) => req("POST", `/grupos/${id}/usuario`, d),
  cambiarPasswordGrupo: (id, d) => req("PUT", `/grupos/${id}/usuario`, d),

  getSolicitudesPendientes: () => req("GET", "/solicitudes/pendientes"),
  getSolicitudes: () => req("GET", "/solicitudes"),
  crearSolicitud: (d) => req("POST", "/solicitudes", d),

  getActividades: () => req("GET", "/actividades"),
  crearActividad: (d) => req("POST", "/actividades", d),
  actualizarActividad: (id, estado) => req("PUT", `/actividades/${id}`, { estado }),
  setMiembrosActividad: (id, miembro_ids) => req("PUT", `/actividades/${id}/miembros`, { miembro_ids }),

  getComentarios: (act_id) => req("GET", `/actividades/${act_id}/comentarios`),
  crearComentario: (act_id, texto) => req("POST", `/actividades/${act_id}/comentarios`, { texto }),

  getNotificaciones: () => req("GET", "/notificaciones"),
  marcarLeida: (id) => req("PUT", `/notificaciones/${id}/leer`),
  leerTodas: () => req("POST", "/notificaciones/leer-todas"),
};

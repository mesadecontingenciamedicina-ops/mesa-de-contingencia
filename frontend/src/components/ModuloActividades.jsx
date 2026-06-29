import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

const MapaPicker = lazy(() => import("./MapaPicker"));

const PRIORIDAD_COLOR = { Alta: "#dc2626", Normal: "#d97706", Baja: "#6b7280" };
const PRIORIDAD_BG    = { Alta: "#fee2e2", Normal: "#fef3c7", Baja: "#f3f4f6" };

const ESTADOS = ["Por ejecutar", "En ejecución", "Ejecutado"];
const COLOR = {
  "Por ejecutar": "#e74c3c",
  "En ejecución": "#f39c12",
  "Ejecutado":    "#27ae60",
};

export default function ModuloActividades({ refresh, abrirActividadId, onActividadAbierta }) {
  const { user } = useAuth();
  const isAdmin = user.rol === "admin";

  const [actividades,   setActividades]   = useState([]);
  const [miembros,      setMiembros]      = useState([]);
  const [gruposAll,     setGruposAll]     = useState([]);
  const [filtroGrupo,   setFiltroGrupo]   = useState("todos");
  const [loading,       setLoading]       = useState({});
  const [detalle,       setDetalle]       = useState(null);
  const [tabDetalle,    setTabDetalle]    = useState("info");
  const [modalMiembros, setModalMiembros] = useState(null);
  const [seleccion,     setSeleccion]     = useState(new Set());
  const [guardando,     setGuardando]     = useState(false);
  const [modalRapida,   setModalRapida]   = useState(null);
  const [creando,       setCreando]       = useState(false);

  const FORM_RAPIDA = { descripcion: "", grupo_id: "", prioridad: "Normal", ubicacion: "", lat: null, lng: null, fecha_hora: "" };

  const reload = async () => {
    const [acts, ms, gs] = await Promise.all([api.getActividades(), api.getMiembros(), api.getGrupos()]);
    setActividades(acts);
    setMiembros(ms);
    setGruposAll(gs);
    return acts;
  };

  useEffect(() => { reload(); }, [refresh]);

  // Abrir actividad desde notificación
  useEffect(() => {
    if (!abrirActividadId || actividades.length === 0) return;
    const act = actividades.find(a => a.id === abrirActividadId);
    if (act) {
      abrirDetalle(act);
      onActividadAbierta?.();
    }
  }, [abrirActividadId, actividades]);

  const abrirDetalle = (act) => { setDetalle(act); setTabDetalle("info"); };

  const grupos = [...new Map(actividades.map(a => [a.grupo.id, a.grupo])).values()];
  const visibles = filtroGrupo === "todos"
    ? actividades
    : actividades.filter(a => String(a.grupo.id) === filtroGrupo);
  const byEstado = (estado) => visibles.filter(a => a.estado === estado);

  const cambiarEstado = async (act, estado) => {
    setLoading(p => ({ ...p, [act.id]: true }));
    try {
      await api.actualizarActividad(act.id, estado);
      const acts = await reload();
      if (detalle?.id === act.id) {
        const updated = acts.find(a => a.id === act.id);
        if (updated) setDetalle(updated);
      }
    } finally {
      setLoading(p => ({ ...p, [act.id]: false }));
    }
  };

  const abrirModalMiembros = (act, e) => {
    e?.stopPropagation();
    setSeleccion(new Set(act.miembros.map(m => m.id)));
    setModalMiembros(act);
  };

  const toggleMiembro = (id) => {
    setSeleccion(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const submitRapida = async (e) => {
    e.preventDefault();
    setCreando(true);
    try {
      const payload = { ...modalRapida };
      if (user.rol === "grupo") payload.grupo_id = user.grupo_id;
      await api.crearActividadRapida(payload);
      setModalRapida(null);
      await reload();
    } catch (err) {
      alert(err.message);
    } finally {
      setCreando(false);
    }
  };

  const guardarMiembros = async () => {
    setGuardando(true);
    try {
      await api.setMiembrosActividad(modalMiembros.id, [...seleccion]);
      const acts = await reload();
      if (detalle?.id === modalMiembros.id) {
        const updated = acts.find(a => a.id === modalMiembros.id);
        if (updated) setDetalle(updated);
      }
      setModalMiembros(null);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="modulo">
      <div className="act-header">
        <h2>📊 Tablero de Actividades</h2>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          {(isAdmin || grupos.length > 1) && (
            <div className="filtro-grupo">
              <label htmlFor="filtro-sel">Filtrar por grupo:</label>
              <select id="filtro-sel" value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value)}>
                <option value="todos">Todos ({actividades.length})</option>
                {grupos.map(g => (
                  <option key={g.id} value={String(g.id)}>
                    {g.nombre} ({actividades.filter(a => a.grupo.id === g.id).length})
                  </option>
                ))}
              </select>
            </div>
          )}
          <button className="btn-primary" onClick={() => setModalRapida({ ...FORM_RAPIDA })}>
            + Nueva Actividad
          </button>
        </div>
      </div>

      {/* ── Kanban ── */}
      <div className="kanban">
        {ESTADOS.map(estado => (
          <div key={estado} className="kanban-col">
            <div className="kanban-header" style={{ borderColor: COLOR[estado] }}>
              <span className="kanban-dot" style={{ background: COLOR[estado] }} />
              {estado}
              <span className="kanban-count">{byEstado(estado).length}</span>
            </div>
            <div className="kanban-cards">
              {byEstado(estado).length === 0
                ? <p className="empty">Sin actividades</p>
                : byEstado(estado).map(act => (
                  <div key={act.id} className="kanban-card"
                    style={{ cursor: "pointer" }}
                    onClick={() => abrirDetalle(act)}
                  >
                    <p className="kcard-desc">{act.solicitud.descripcion}</p>
                    <small className="kcard-meta">🏷️ {act.grupo.nombre}</small>
                    <small className="kcard-date">
                      Asignado: {new Date(act.fecha_asignacion).toLocaleDateString("es-VE")}
                    </small>

                    <div className="kcard-trabajando" onClick={e => e.stopPropagation()}>
                      <span className="trabajando-label">Trabajando:</span>
                      {act.miembros.length === 0
                        ? <span className="trabajando-vacio">Sin asignar</span>
                        : act.miembros.map(m => (
                          <span key={m.id} className="trabajando-chip">
                            {m.nombre.split(" ")[0]}{m.cargo ? ` (${m.cargo})` : ""}
                          </span>
                        ))
                      }
                      <button className="btn-asignar-miembros"
                        title="Asignar miembros"
                        onClick={e => abrirModalMiembros(act, e)}>
                        ✏️
                      </button>
                    </div>

                    <div className="kcard-actions" onClick={e => e.stopPropagation()}>
                      {ESTADOS.filter(e => e !== estado).map(e => (
                        <button key={e} disabled={loading[act.id]}
                          className="btn-estado"
                          style={{ borderColor: COLOR[e], color: COLOR[e] }}
                          onClick={() => cambiarEstado(act, e)}
                        >
                          → {e}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Modal detalle ── */}
      {detalle && (
        <div className="overlay" onClick={() => setDetalle(null)}>
          <div className="modal modal-detalle" onClick={e => e.stopPropagation()}>
            <div className="detalle-header">
              <span style={{
                padding: "3px 10px", borderRadius: 12, fontSize: "0.78rem", fontWeight: 700,
                background: COLOR[detalle.estado] + "22", color: COLOR[detalle.estado]
              }}>{detalle.estado}</span>
              <button className="btn-ghost" onClick={() => setDetalle(null)}>✕</button>
            </div>

            {/* Tabs */}
            <div className="detalle-tabs">
              <button className={`detalle-tab ${tabDetalle === "info" ? "detalle-tab-active" : ""}`}
                onClick={() => setTabDetalle("info")}>📋 Detalle</button>
              <button className={`detalle-tab ${tabDetalle === "comentarios" ? "detalle-tab-active" : ""}`}
                onClick={() => setTabDetalle("comentarios")}>💬 Comentarios</button>
            </div>

            {tabDetalle === "info" && (
              <>
                {/* Solicitud */}
                <div style={{ background: "#f8fafc", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "0.75rem" }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#9ca3af", letterSpacing: 1, marginBottom: "0.5rem" }}>SOLICITUD ASOCIADA</div>
                  <DetalleRow label="Descripción"  value={detalle.solicitud.descripcion} />
                  <DetalleRow label="Prioridad" value={
                    <span className="prioridad-tag"
                      style={{ background: PRIORIDAD_BG[detalle.solicitud.prioridad], color: PRIORIDAD_COLOR[detalle.solicitud.prioridad] }}>
                      {detalle.solicitud.prioridad}
                    </span>
                  } />
                  <DetalleRow label="Fecha/Hora"
                    value={detalle.solicitud.fecha_hora
                      ? new Date(detalle.solicitud.fecha_hora).toLocaleString("es-VE")
                      : "—"} />
                  <DetalleRow label="Ubicación"    value={detalle.solicitud.ubicacion || "—"} />
                  <DetalleRow label="Solicitante"  value={detalle.solicitud.solicitante_nombre || "—"} />
                  <DetalleRow label="Teléfono"     value={detalle.solicitud.solicitante_telefono || "—"} />
                  <DetalleRow label="Correo"       value={detalle.solicitud.solicitante_email || "—"} />
                  {detalle.solicitud.lat && (
                    <div style={{ marginTop: "0.6rem" }}>
                      <MapaReadOnly lat={detalle.solicitud.lat} lng={detalle.solicitud.lng} />
                    </div>
                  )}
                </div>

                {/* Actividad */}
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#9ca3af", letterSpacing: 1, marginBottom: "0.4rem" }}>ACTIVIDAD</div>
                <DetalleRow label="Grupo"        value={detalle.grupo.nombre} />
                <DetalleRow label="Asignado"     value={new Date(detalle.fecha_asignacion).toLocaleString("es-VE")} />
                <DetalleRow label="Actualizado"  value={new Date(detalle.fecha_actualizacion).toLocaleString("es-VE")} />

                <div style={{ marginTop: "0.75rem" }}>
                  <span className="detalle-label">Trabajando en esto:</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.4rem" }}>
                    {detalle.miembros.length === 0
                      ? <span className="trabajando-vacio">Sin miembros asignados</span>
                      : detalle.miembros.map(m => (
                        <span key={m.id} className="trabajando-chip" style={{ fontSize: "0.82rem", padding: "3px 10px" }}>
                          {m.nombre}{m.cargo ? ` · ${m.cargo}` : ""}
                        </span>
                      ))
                    }
                  </div>
                </div>

                <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button className="btn-secondary"
                    onClick={e => { abrirModalMiembros(detalle, e); setDetalle(null); }}>
                    ✏️ Asignar miembros
                  </button>
                  {ESTADOS.filter(e => e !== detalle.estado).map(e => (
                    <button key={e} className="btn-estado"
                      style={{ borderColor: COLOR[e], color: COLOR[e] }}
                      disabled={loading[detalle.id]}
                      onClick={() => cambiarEstado(detalle, e)}>
                      → {e}
                    </button>
                  ))}
                </div>
              </>
            )}

            {tabDetalle === "comentarios" && (
              <SeccionComentarios actividadId={detalle.id} />
            )}
          </div>
        </div>
      )}

      {/* ── Modal nueva actividad rápida ── */}
      {modalRapida && (
        <div className="overlay" onClick={() => setModalRapida(null)}>
          <div className="modal modal-detalle" onClick={e => e.stopPropagation()}>
            <div className="detalle-header">
              <h3 style={{ color: "var(--navy)", margin: 0 }}>Nueva Actividad</h3>
              <button className="btn-ghost" onClick={() => setModalRapida(null)}>✕</button>
            </div>
            <form onSubmit={submitRapida} className="form" style={{ marginTop: "0.75rem" }}>
              <label>Descripción *
                <textarea required rows={3} value={modalRapida.descripcion}
                  onChange={e => setModalRapida(p => ({ ...p, descripcion: e.target.value }))}
                  placeholder="¿Qué hay que hacer?" />
              </label>

              {isAdmin && (
                <label>Grupo de Trabajo *
                  <select required value={modalRapida.grupo_id}
                    onChange={e => setModalRapida(p => ({ ...p, grupo_id: e.target.value }))}>
                    <option value="">— Seleccionar grupo —</option>
                    {gruposAll.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                  </select>
                </label>
              )}

              <label>Prioridad
                <div className="prioridad-group">
                  {["Baja", "Normal", "Alta"].map(p => (
                    <button key={p} type="button"
                      className={`prioridad-btn ${modalRapida.prioridad === p ? "prioridad-active" : ""}`}
                      style={modalRapida.prioridad === p ? {
                        background: p === "Alta" ? "#fee2e2" : p === "Normal" ? "#fef3c7" : "#f3f4f6",
                        color: p === "Alta" ? "#dc2626" : p === "Normal" ? "#d97706" : "#6b7280",
                        borderColor: p === "Alta" ? "#dc2626" : p === "Normal" ? "#d97706" : "#6b7280",
                      } : {}}
                      onClick={() => setModalRapida(pr => ({ ...pr, prioridad: p }))}>
                      {p}
                    </button>
                  ))}
                </div>
              </label>

              <label>Ubicación — haz clic en el mapa o busca una dirección
                <Suspense fallback={<div className="mapa-loading">Cargando mapa...</div>}>
                  <MapaPicker
                    value={{ lat: modalRapida.lat, lng: modalRapida.lng, address: modalRapida.ubicacion }}
                    onChange={({ lat, lng, address }) => setModalRapida(p => ({ ...p, lat, lng, ubicacion: address }))}
                  />
                </Suspense>
              </label>

              <label>Fecha y hora estimada
                <input type="datetime-local" value={modalRapida.fecha_hora}
                  onChange={e => setModalRapida(p => ({ ...p, fecha_hora: e.target.value }))} />
              </label>

              <div className="modal-actions">
                <button type="submit" className="btn-primary" disabled={creando}>
                  {creando ? "Creando..." : "Crear Actividad"}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setModalRapida(null)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal asignación de miembros (solo grupos) ── */}
      {modalMiembros && (
        <div className="overlay" onClick={() => setModalMiembros(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>¿Quiénes trabajan en esto?</h3>
            <p className="modal-desc">{modalMiembros.solicitud.descripcion}</p>

            <div className="popover-list" style={{ maxHeight: 320, overflowY: "auto", margin: "0.75rem 0" }}>
              {miembros.length === 0
                ? <p className="empty">No hay miembros registrados.</p>
                : (() => {
                    const sinGrupo = miembros.filter(m => !m.grupo);
                    const conGrupo = miembros.filter(m => m.grupo);
                    const renderItem = (m) => (
                      <label key={m.id} className="popover-item">
                        <input type="checkbox"
                          checked={seleccion.has(m.id)}
                          onChange={() => toggleMiembro(m.id)}
                        />
                        <span>
                          {m.nombre}
                          {m.cargo && <span className="cargo-chip" style={{ marginLeft: 6 }}>{m.cargo}</span>}
                          {isAdmin && m.grupo && <span style={{ fontSize: "0.72rem", color: "#9ca3af", marginLeft: 6 }}>({m.grupo.nombre})</span>}
                        </span>
                      </label>
                    );
                    return (
                      <>
                        {sinGrupo.length > 0 && (
                          <>
                            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#9ca3af", padding: "4px 8px", letterSpacing: 1 }}>PERSONAL ADMINISTRATIVO</div>
                            {sinGrupo.map(renderItem)}
                          </>
                        )}
                        {conGrupo.length > 0 && (
                          <>
                            {sinGrupo.length > 0 && <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#9ca3af", padding: "4px 8px", letterSpacing: 1, marginTop: 4 }}>GRUPOS DE TRABAJO</div>}
                            {conGrupo.map(renderItem)}
                          </>
                        )}
                      </>
                    );
                  })()
              }
            </div>

            <div className="modal-actions">
              <button className="btn-primary" disabled={guardando} onClick={guardarMiembros}>
                {guardando ? "Guardando..." : "Guardar"}
              </button>
              <button className="btn-ghost" onClick={() => setModalMiembros(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SeccionComentarios({ actividadId }) {
  const { user } = useAuth();
  const [comentarios, setComentarios] = useState([]);
  const [texto, setTexto]             = useState("");
  const [enviando, setEnviando]       = useState(false);
  const bottomRef = useRef(null);

  const reload = async () => {
    try {
      const data = await api.getComentarios(actividadId);
      setComentarios(data);
    } catch {}
  };

  useEffect(() => { reload(); }, [actividadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comentarios]);

  const enviar = async (e) => {
    e.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      await api.crearComentario(actividadId, texto.trim());
      setTexto("");
      await reload();
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="comentarios-wrap">
      <div className="comentarios-lista">
        {comentarios.length === 0
          ? <p className="empty" style={{ textAlign: "center", marginTop: "2rem" }}>Sin comentarios aún. ¡Sé el primero!</p>
          : comentarios.map(c => {
            const esPropio = c.autor === user.username;
            return (
              <div key={c.id} className={`comentario ${esPropio ? "comentario-propio" : "comentario-otro"}`}>
                <div className="comentario-meta">
                  <span className="comentario-autor">{c.autor}</span>
                  <span className={`comentario-rol ${c.rol === "admin" ? "rol-admin" : "rol-grupo"}`}>
                    {c.rol === "admin" ? "🔑 Admin" : "🏷️ Grupo"}
                  </span>
                  <span className="comentario-fecha">
                    {new Date(c.fecha).toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </div>
                <p className="comentario-texto">{c.texto}</p>
              </div>
            );
          })
        }
        <div ref={bottomRef} />
      </div>

      <form className="comentario-form" onSubmit={enviar}>
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Escribe un comentario..."
          rows={2}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(e); } }}
        />
        <button type="submit" className="btn-primary" disabled={enviando || !texto.trim()}>
          {enviando ? "..." : "Enviar"}
        </button>
      </form>
    </div>
  );
}

function DetalleRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="detalle-row">
      <span className="detalle-label">{label}</span>
      <span className="detalle-value">{value}</span>
    </div>
  );
}

function MapaReadOnly({ lat, lng }) {
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng-0.005},${lat-0.005},${lng+0.005},${lat+0.005}&layer=mapnik&marker=${lat},${lng}`;
  return (
    <iframe
      title="ubicacion"
      src={src}
      width="100%"
      height="180"
      style={{ border: "1px solid #e5e7eb", borderRadius: 8, display: "block" }}
    />
  );
}

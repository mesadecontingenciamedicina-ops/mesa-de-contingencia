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

export default function ModuloTareas({ refresh, abrirTareaId, onTareaAbierta }) {
  const { user } = useAuth();
  const isAdmin = user.rol === "admin";
  const isPrivileged = isAdmin || user.es_coordinador;

  const [tareas,        setTareas]        = useState([]);
  const [miembros,      setMiembros]      = useState([]);
  const [gruposAll,     setGruposAll]     = useState([]);
  const [filtroGrupo,   setFiltroGrupo]   = useState("todos");
  const [filtroAbierto, setFiltroAbierto] = useState(false);
  const [loading,       setLoading]       = useState({});
  const [detalle,       setDetalle]       = useState(null);
  const [tabDetalle,    setTabDetalle]    = useState("info");
  const [modalMiembros, setModalMiembros] = useState(null);
  const [seleccion,     setSeleccion]     = useState(new Set());
  const [editDescripcion, setEditDescripcion] = useState("");
  const [dropdownMiembros, setDropdownMiembros] = useState(false);
  const [guardando,     setGuardando]     = useState(false);
  const [modalNueva,    setModalNueva]    = useState(null);
  const [creando,       setCreando]       = useState(false);

  const FORM_NUEVA = { descripcion: "", grupo_id: "", prioridad: "Normal", ubicacion: "", lat: null, lng: null, fecha_hora: "" };

  const reload = async () => {
    const [ts, ms, gs] = await Promise.all([api.getTareas(), api.getMiembros(), api.getGrupos()]);
    setTareas(ts);
    setMiembros(ms);
    setGruposAll(gs);
    return ts;
  };

  useEffect(() => { reload(); }, [refresh]);

  // Abrir tarea desde notificación
  useEffect(() => {
    if (!abrirTareaId || tareas.length === 0) return;
    const t = tareas.find(x => x.id === abrirTareaId);
    if (t) {
      abrirDetalle(t);
      onTareaAbierta?.();
    }
  }, [abrirTareaId, tareas]);

  const abrirDetalle = (t) => { setDetalle(t); setTabDetalle("info"); };

  const grupos = [...new Map(tareas.map(t => [t.grupo.id, t.grupo])).values()];
  const visibles = filtroGrupo === "todos"
    ? tareas
    : tareas.filter(t => String(t.grupo.id) === filtroGrupo);
  const byEstado = (estado) => visibles.filter(t => t.estado === estado);

  const cambiarEstado = async (t, estado) => {
    setLoading(p => ({ ...p, [t.id]: true }));
    try {
      await api.actualizarTarea(t.id, estado);
      const ts = await reload();
      if (detalle?.id === t.id) {
        const updated = ts.find(x => x.id === t.id);
        if (updated) setDetalle(updated);
      }
    } finally {
      setLoading(p => ({ ...p, [t.id]: false }));
    }
  };

  const abrirModalMiembros = (t, e) => {
    e?.stopPropagation();
    setSeleccion(new Set(t.miembros.map(m => m.id)));
    setEditDescripcion(t.descripcion || "");
    setDropdownMiembros(false);
    setModalMiembros(t);
  };

  const toggleMiembro = (id) => {
    setSeleccion(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const submitNueva = async (e) => {
    e.preventDefault();
    setCreando(true);
    try {
      const payload = { ...modalNueva };
      if (user.rol === "grupo") payload.grupo_id = user.grupo_id;
      await api.crearTarea(payload);
      setModalNueva(null);
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
      const promises = [api.setMiembrosTarea(modalMiembros.id, [...seleccion])];
      const descTrimmed = editDescripcion.trim();
      if (descTrimmed && descTrimmed !== (modalMiembros.descripcion || "").trim()) {
        promises.push(api.editarDescripcionTarea(modalMiembros.id, descTrimmed));
      }
      await Promise.all(promises);
      const ts = await reload();
      if (detalle?.id === modalMiembros.id) {
        const updated = ts.find(x => x.id === modalMiembros.id);
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
        <h2>📊 Tablero de Tareas</h2>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          {(isPrivileged || grupos.length > 1) && (
            <div className="filtro-grupo" style={{ position: "relative" }}>
              <label>Filtrar por grupo:</label>
              <div
                className="custom-select"
                style={{
                  padding: "0.4rem 0.75rem", border: "1px solid var(--border)",
                  borderRadius: 7, fontSize: "0.875rem", background: "#f9fafb",
                  cursor: "pointer", display: "flex", justifyContent: "space-between",
                  alignItems: "center", gap: "0.5rem", minWidth: 200
                }}
                onClick={() => setFiltroAbierto(!filtroAbierto)}
              >
                <span>
                  {filtroGrupo === "todos"
                    ? `Todos (${tareas.length})`
                    : `${grupos.find(g => String(g.id) === filtroGrupo)?.nombre || "Grupo"} (${tareas.filter(t => String(t.grupo.id) === filtroGrupo).length})`}
                </span>
                <span>▼</span>
              </div>
              {filtroAbierto && (
                <>
                  <div className="dropdown-backdrop" style={{ position: "fixed", inset: 0, zIndex: 98 }} onClick={() => setFiltroAbierto(false)} />
                  <div
                    className="dropdown-menu"
                    style={{
                      position: "absolute", top: "100%", left: 0, marginTop: "4px",
                      background: "#fff", border: "1px solid var(--border)",
                      borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      zIndex: 99, maxHeight: 250, overflowY: "auto",
                      minWidth: "100%", width: "max-content", maxWidth: 350
                    }}
                  >
                    <div
                      style={{ padding: "0.5rem 0.75rem", cursor: "pointer", borderBottom: "1px solid #f3f4f6", fontSize: "0.85rem" }}
                      onClick={() => { setFiltroGrupo("todos"); setFiltroAbierto(false); }}
                    >
                      Todos ({tareas.length})
                    </div>
                    {grupos.map(g => (
                      <div
                        key={g.id}
                        style={{
                          padding: "0.5rem 0.75rem", cursor: "pointer",
                          borderBottom: "1px solid #f3f4f6", fontSize: "0.85rem",
                          background: filtroGrupo === String(g.id) ? "#f9fafb" : "transparent"
                        }}
                        onClick={() => { setFiltroGrupo(String(g.id)); setFiltroAbierto(false); }}
                      >
                        {g.nombre} ({tareas.filter(t => t.grupo.id === g.id).length})
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <button className="btn-primary" onClick={() => setModalNueva({ ...FORM_NUEVA })}>
            + Nueva Tarea
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
                ? <p className="empty">Sin tareas</p>
                : byEstado(estado).map(t => (
                  <div key={t.id} className="kanban-card"
                    style={{ cursor: "pointer" }}
                    onClick={() => abrirDetalle(t)}
                  >
                    <p className="kcard-desc">{t.descripcion}</p>
                    <small className="kcard-meta">🏷️ {t.grupo.nombre}</small>
                    <small className="kcard-date">
                      Asignada: {new Date(t.fecha_asignacion).toLocaleDateString("es-VE")}
                    </small>

                    <div className="kcard-trabajando" onClick={e => e.stopPropagation()}>
                      <span className="trabajando-label">Trabajando:</span>
                      {t.miembros.length === 0
                        ? <span className="trabajando-vacio">Sin asignar</span>
                        : t.miembros.map(m => (
                          <span key={m.id} className="trabajando-chip">
                            {m.nombre.split(" ")[0]}{m.cargo ? ` (${m.cargo})` : ""}
                          </span>
                        ))
                      }
                      <button className="btn-asignar-miembros"
                        title="Asignar miembros"
                        onClick={e => abrirModalMiembros(t, e)}>
                        ✏️
                      </button>
                    </div>

                    <div className="kcard-actions" onClick={e => e.stopPropagation()}>
                      {ESTADOS.filter(e => e !== estado).map(e => (
                        <button key={e} disabled={loading[t.id]}
                          className="btn-estado"
                          style={{ borderColor: COLOR[e], color: COLOR[e] }}
                          onClick={() => cambiarEstado(t, e)}
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
              <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                <button className="btn-ghost" title="Archivar tarea"
                  style={{ color: "#dc2626", fontSize: "1rem" }}
                  onClick={async () => {
                    if (!confirm("¿Archivar esta tarea? Desaparecerá del tablero.")) return;
                    try {
                      await api.archivarTarea(detalle.id);
                      setDetalle(null);
                      await reload();
                    } catch (err) { alert(err.message); }
                  }}>🗑️</button>
                <button className="btn-ghost" onClick={() => setDetalle(null)}>✕</button>
              </div>
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
                <DetalleRow label="Descripción"  value={detalle.descripcion} />
                <DetalleRow label="Prioridad" value={
                  <span className="prioridad-tag"
                    style={{ background: PRIORIDAD_BG[detalle.prioridad], color: PRIORIDAD_COLOR[detalle.prioridad] }}>
                    {detalle.prioridad}
                  </span>
                } />
                <DetalleRow label="Fecha/Hora"
                  value={detalle.fecha_hora
                    ? new Date(detalle.fecha_hora).toLocaleString("es-VE")
                    : null} />
                <DetalleRow label="Ubicación"    value={detalle.ubicacion} />
                {detalle.lat && (
                  <div style={{ marginTop: "0.6rem" }}>
                    <MapaReadOnly lat={detalle.lat} lng={detalle.lng} />
                  </div>
                )}

                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#9ca3af", letterSpacing: 1, margin: "0.9rem 0 0.4rem" }}>ASIGNACIÓN</div>
                <DetalleRow label="Grupo"        value={detalle.grupo.nombre} />
                <DetalleRow label="Asignada"     value={new Date(detalle.fecha_asignacion).toLocaleString("es-VE")} />
                <DetalleRow label="Actualizada"  value={new Date(detalle.fecha_actualizacion).toLocaleString("es-VE")} />

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
              <SeccionComentarios tareaId={detalle.id} />
            )}
          </div>
        </div>
      )}

      {/* ── Modal nueva tarea ── */}
      {modalNueva && (
        <div className="overlay" onClick={() => setModalNueva(null)}>
          <div className="modal modal-detalle" onClick={e => e.stopPropagation()}>
            <div className="detalle-header">
              <h3 style={{ color: "var(--navy)", margin: 0 }}>Nueva Tarea</h3>
              <button className="btn-ghost" onClick={() => setModalNueva(null)}>✕</button>
            </div>
            <form onSubmit={submitNueva} className="form" style={{ marginTop: "0.75rem" }}>
              <label>Descripción *
                <textarea required rows={3} value={modalNueva.descripcion}
                  onChange={e => setModalNueva(p => ({ ...p, descripcion: e.target.value }))}
                  placeholder="¿Qué hay que hacer?" />
              </label>

              {isPrivileged && (
                <label>Grupo de Trabajo *
                  <select required value={modalNueva.grupo_id}
                    onChange={e => setModalNueva(p => ({ ...p, grupo_id: e.target.value }))}>
                    <option value="">— Seleccionar grupo —</option>
                    {gruposAll.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                  </select>
                </label>
              )}

              <label>Prioridad
                <div className="prioridad-group">
                  {["Baja", "Normal", "Alta"].map(p => (
                    <button key={p} type="button"
                      className={`prioridad-btn ${modalNueva.prioridad === p ? "prioridad-active" : ""}`}
                      style={modalNueva.prioridad === p ? {
                        background: p === "Alta" ? "#fee2e2" : p === "Normal" ? "#fef3c7" : "#f3f4f6",
                        color: p === "Alta" ? "#dc2626" : p === "Normal" ? "#d97706" : "#6b7280",
                        borderColor: p === "Alta" ? "#dc2626" : p === "Normal" ? "#d97706" : "#6b7280",
                      } : {}}
                      onClick={() => setModalNueva(pr => ({ ...pr, prioridad: p }))}>
                      {p}
                    </button>
                  ))}
                </div>
              </label>

              <label>Ubicación — haz clic en el mapa o busca una dirección
                <Suspense fallback={<div className="mapa-loading">Cargando mapa...</div>}>
                  <MapaPicker
                    value={{ lat: modalNueva.lat, lng: modalNueva.lng, address: modalNueva.ubicacion }}
                    onChange={({ lat, lng, address }) => setModalNueva(p => ({ ...p, lat, lng, ubicacion: address }))}
                  />
                </Suspense>
              </label>

              <label>Fecha y hora estimada
                <input type="datetime-local" value={modalNueva.fecha_hora}
                  onChange={e => setModalNueva(p => ({ ...p, fecha_hora: e.target.value }))} />
              </label>

              <div className="modal-actions">
                <button type="submit" className="btn-primary" disabled={creando}>
                  {creando ? "Creando..." : "Crear Tarea"}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setModalNueva(null)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal asignación de miembros ── */}
      {modalMiembros && (() => {
        // Filtrar solo miembros del grupo de la tarea
        const grupoTareaId = modalMiembros.grupo.id;
        const miembrosDelGrupo = miembros.filter(m => m.grupo && m.grupo.id === grupoTareaId);
        return (
          <div className="overlay" onClick={() => setModalMiembros(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h3>✏️ Editar tarea</h3>
              <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: "0 0 0.75rem" }}>
                🏷️ {modalMiembros.grupo.nombre}
              </p>

              {/* Campo de descripción editable */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#6b7280", letterSpacing: 1, display: "block", marginBottom: "0.35rem" }}>
                  DESCRIPCIÓN
                </label>
                <textarea
                  rows={3}
                  value={editDescripcion}
                  onChange={e => setEditDescripcion(e.target.value)}
                  placeholder="Descripción de la tarea..."
                  style={{
                    width: "100%", resize: "vertical", padding: "0.5rem 0.75rem",
                    border: "1px solid var(--border)", borderRadius: 8,
                    fontSize: "0.9rem", fontFamily: "inherit", boxSizing: "border-box",
                    lineHeight: 1.5, color: "var(--text)", background: "#f9fafb"
                  }}
                />
              </div>

              {/* Multi-select dropdown de miembros */}
              <div style={{ marginBottom: "0.75rem", position: "relative" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#6b7280", letterSpacing: 1, marginBottom: "0.4rem" }}>
                  MIEMBROS ASIGNADOS
                </div>

                {/* Trigger */}
                <div
                  onClick={() => setDropdownMiembros(p => !p)}
                  style={{
                    border: `1px solid ${dropdownMiembros ? "#3b82f6" : "var(--border)"}`,
                    borderRadius: 8, padding: "0.45rem 0.65rem",
                    cursor: "pointer", background: "#f9fafb",
                    minHeight: "2.4rem", display: "flex",
                    flexWrap: "wrap", gap: "0.3rem",
                    alignItems: "center", userSelect: "none",
                    transition: "border-color 0.15s",
                  }}
                >
                  {seleccion.size === 0
                    ? <span style={{ color: "#9ca3af", fontSize: "0.875rem", flexGrow: 1 }}>— Seleccionar miembros —</span>
                    : miembrosDelGrupo.filter(m => seleccion.has(m.id)).map(m => (
                        <span key={m.id} style={{
                          background: "#dbeafe", color: "#1d4ed8",
                          borderRadius: 20, padding: "2px 8px 2px 10px",
                          fontSize: "0.78rem", fontWeight: 600,
                          display: "flex", alignItems: "center", gap: 3,
                        }}>
                          {m.nombre.split(" ")[0]}{m.cargo ? ` (${m.cargo})` : ""}
                          <span
                            onClick={e => { e.stopPropagation(); toggleMiembro(m.id); }}
                            style={{ cursor: "pointer", fontWeight: 700, opacity: 0.6, fontSize: "0.9rem", lineHeight: 1 }}
                          >×</span>
                        </span>
                      ))
                  }
                  <span style={{ marginLeft: "auto", color: "#6b7280", fontSize: "0.75rem", flexShrink: 0 }}>
                    {dropdownMiembros ? "▲" : "▼"}
                  </span>
                </div>

                {/* Dropdown */}
                {dropdownMiembros && (
                  <>
                    <div
                      style={{ position: "fixed", inset: 0, zIndex: 10 }}
                      onClick={() => setDropdownMiembros(false)}
                    />
                    <div style={{
                      position: "absolute", top: "calc(100% + 4px)",
                      left: 0, right: 0,
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
                      zIndex: 11,
                      maxHeight: 220, overflowY: "auto",
                    }}>
                      {miembrosDelGrupo.length === 0
                        ? <p className="empty" style={{ padding: "0.75rem", margin: 0 }}>No hay miembros en este grupo.</p>
                        : miembrosDelGrupo.map(m => (
                          <div
                            key={m.id}
                            onClick={() => toggleMiembro(m.id)}
                            style={{
                              padding: "0.5rem 0.75rem",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.6rem",
                              background: seleccion.has(m.id) ? "#eff6ff" : "transparent",
                              borderBottom: "1px solid #f3f4f6",
                              fontSize: "0.875rem",
                              transition: "background 0.1s",
                            }}
                          >
                            {/* Checkbox visual */}
                            <span style={{
                              width: 16, height: 16, flexShrink: 0,
                              borderRadius: 4,
                              border: `2px solid ${seleccion.has(m.id) ? "#3b82f6" : "#d1d5db"}`,
                              background: seleccion.has(m.id) ? "#3b82f6" : "transparent",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              transition: "all 0.15s",
                            }}>
                              {seleccion.has(m.id) && (
                                <span style={{ color: "#fff", fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✓</span>
                              )}
                            </span>
                            <span style={{ flexGrow: 1 }}>
                              {m.nombre}
                              {m.cargo && (
                                <span style={{ fontSize: "0.72rem", color: "#6b7280", marginLeft: 6 }}>{m.cargo}</span>
                              )}
                            </span>
                          </div>
                        ))
                      }
                    </div>
                  </>
                )}
              </div>

              <div className="modal-actions">
                <button className="btn-primary" disabled={guardando} onClick={guardarMiembros}>
                  {guardando ? "Guardando..." : "Guardar cambios"}
                </button>
                <button className="btn-ghost" onClick={() => setModalMiembros(null)}>Cancelar</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function SeccionComentarios({ tareaId }) {
  const { user } = useAuth();
  const [comentarios, setComentarios] = useState([]);
  const [texto, setTexto]             = useState("");
  const [enviando, setEnviando]       = useState(false);
  const bottomRef = useRef(null);

  const reload = async () => {
    try {
      const data = await api.getComentariosTarea(tareaId);
      setComentarios(data);
    } catch {}
  };

  useEffect(() => { reload(); }, [tareaId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comentarios]);

  const enviar = async (e) => {
    e.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      await api.crearComentarioTarea(tareaId, texto.trim());
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

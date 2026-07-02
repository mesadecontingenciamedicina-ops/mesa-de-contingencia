import { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

const PRIORIDAD_COLOR = { Alta: "#dc2626", Normal: "#d97706", Baja: "#6b7280" };
const PRIORIDAD_BG    = { Alta: "#fee2e2", Normal: "#fef3c7", Baja: "#f3f4f6" };

const EVENTO_LABEL = {
  creada: "Creada", aprobada: "Aprobada", rechazada: "Rechazada", reenviada: "Reenviada",
  editada: "Editada", reclamada: "Bloqueada", liberada: "Avance guardado", resuelta: "Resuelta",
};

export default function ModuloSolicitudesAprobadas() {
  const { user } = useAuth();
  const puedeBloquear = user.rol === "grupo";

  const [lista,          setLista]          = useState([]);
  const [filtroOrigen,   setFiltroOrigen]   = useState("todos");
  const [filtroTipo,     setFiltroTipo]     = useState("todos");
  const [msg,            setMsg]            = useState(null);
  const [procesando,     setProcesando]     = useState({});
  const [aportes,        setAportes]        = useState({});
  const [mensajes,       setMensajes]       = useState({});
  const [historiales,    setHistoriales]    = useState({});

  const reload = async () => {
    const data = await api.getSolicitudesAprobadas();
    setLista(data);
    return data;
  };
  useEffect(() => { reload(); }, []);

  const flash = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 3500); };

  const origenes = [...new Map(lista.map(s => [`${s.origen.tipo}-${s.origen.id}`, s.origen])).values()]
    .filter(o => o.nombre);
  const tipos = [...new Set(lista.map(s => s.tipo_solicitud))];
  const visibles = lista
    .filter(s => filtroOrigen === "todos" || `${s.origen.tipo}-${s.origen.id}` === filtroOrigen)
    .filter(s => filtroTipo === "todos" || s.tipo_solicitud === filtroTipo);

  const esMia = (s) => s.reclamado_por && s.reclamado_por.id === user.grupo_id;

  const setAporte = (solId, itemId, campo, valor) =>
    setAportes(p => ({
      ...p,
      [solId]: { ...p[solId], [itemId]: { ...p[solId]?.[itemId], [campo]: valor } },
    }));

  const construirAportes = (s) => {
    const propios = aportes[s.id] || {};
    return Object.entries(propios)
      .map(([item_id, a]) => ({ item_id: Number(item_id), cantidad: Number(a.cantidad) || 0, comentario: a.comentario }))
      .filter(a => a.cantidad > 0);
  };

  const limpiarAportes = (solId) => {
    setAportes(p => ({ ...p, [solId]: {} }));
    setMensajes(p => ({ ...p, [solId]: "" }));
  };

  const bloquear = async (s) => {
    setProcesando(p => ({ ...p, [s.id]: true }));
    try {
      await api.reclamarSolicitud(s.id);
      await reload();
      flash("Solicitud bloqueada. Ahora solo tu grupo puede resolverla.");
    } catch (err) { flash(err.message, false); }
    finally { setProcesando(p => ({ ...p, [s.id]: false })); }
  };

  const terminarYGuardar = async (s) => {
    setProcesando(p => ({ ...p, [s.id]: true }));
    try {
      await api.liberarSolicitud(s.id, construirAportes(s), mensajes[s.id]);
      limpiarAportes(s.id);
      await reload();
      flash("Aportes guardados.");
    } catch (err) { flash(err.message, false); }
    finally { setProcesando(p => ({ ...p, [s.id]: false })); }
  };

  const resolverYGuardar = async (s) => {
    if (!confirm("¿Marcar esta solicitud como resuelta por completo?")) return;
    setProcesando(p => ({ ...p, [s.id]: true }));
    try {
      await api.marcarResueltaSolicitud(s.id, construirAportes(s), mensajes[s.id]);
      limpiarAportes(s.id);
      await reload();
      flash("Solicitud marcada como resuelta.");
    } catch (err) { flash(err.message, false); }
    finally { setProcesando(p => ({ ...p, [s.id]: false })); }
  };

  const toggleHistorial = async (s) => {
    if (historiales[s.id]) {
      setHistoriales(p => { const cp = { ...p }; delete cp[s.id]; return cp; });
      return;
    }
    try {
      const data = await api.getHistorialSolicitud(s.id);
      setHistoriales(p => ({ ...p, [s.id]: data }));
    } catch (err) { flash(err.message, false); }
  };

  return (
    <div className="modulo">
      <h2>📦 Solicitudes Aprobadas</h2>
      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "-0.5rem", marginBottom: "1rem" }}>
        Tablero colaborativo: cualquier grupo puede bloquear una solicitud aprobada y resolverla, total o parcialmente.
      </p>
      {msg && <div className={`alert ${msg.ok ? "alert-ok" : "alert-err"}`}>{msg.text}</div>}

      {tipos.length > 1 && (
        <div className="prioridad-group" style={{ marginBottom: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" className={`prioridad-btn ${filtroTipo === "todos" ? "prioridad-active" : ""}`}
            onClick={() => setFiltroTipo("todos")}>Todos los tipos</button>
          {tipos.map(t => (
            <button key={t} type="button"
              className={`prioridad-btn ${filtroTipo === t ? "prioridad-active" : ""}`}
              onClick={() => setFiltroTipo(t)}>
              {t}
            </button>
          ))}
        </div>
      )}

      {origenes.length > 1 && (
        <div className="prioridad-group" style={{ marginBottom: "1rem", flexWrap: "wrap" }}>
          <button type="button" className={`prioridad-btn ${filtroOrigen === "todos" ? "prioridad-active" : ""}`}
            onClick={() => setFiltroOrigen("todos")}>Todos ({lista.length})</button>
          {origenes.map(o => (
            <button key={`${o.tipo}-${o.id}`} type="button"
              className={`prioridad-btn ${filtroOrigen === `${o.tipo}-${o.id}` ? "prioridad-active" : ""}`}
              onClick={() => setFiltroOrigen(`${o.tipo}-${o.id}`)}>
              {o.tipo === "centro" ? "🏥" : "📤"} {o.nombre}
            </button>
          ))}
        </div>
      )}

      {visibles.length === 0
        ? <p className="empty">No hay solicitudes aprobadas pendientes de resolver.</p>
        : (
          <div className="card-list">
            {visibles.map(s => {
              const mia = esMia(s);
              const enProceso = !!s.reclamado_por;
              return (
                <div key={s.id} className="card sol-card">
                  {/* Cabecera: datos primordiales a la izquierda, bloquear/desbloquear a la derecha */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                    <div className="card-body">
                      <div className="sol-card-top">
                        <span className="prioridad-tag"
                          style={{ background: PRIORIDAD_BG[s.prioridad], color: PRIORIDAD_COLOR[s.prioridad] }}>
                          {s.prioridad}
                        </span>
                        {s.origen?.nombre
                          ? <span className="origen-badge">{s.origen.tipo === "centro" ? "🏥" : "📤"} {s.origen.nombre}</span>
                          : <span className="origen-badge">🏛️ {s.tipo_solicitud}</span>}
                      </div>
                      <p className="card-desc">{s.descripcion}</p>
                      <div className="sol-meta">
                        {s.items && s.items.length > 0 && <span>📦 {s.items.length} ítem{s.items.length !== 1 ? "s" : ""}</span>}
                        {s.receptor_nombre && <span>👤 Recibe: {s.receptor_nombre}{s.receptor_telefono ? ` · ${s.receptor_telefono}` : ""}</span>}
                        {s.solicitante?.nombre && <span>🙋 Solicitante: {s.solicitante.nombre}</span>}
                        {s.ubicacion && <span>📍 {s.ubicacion}</span>}
                        {s.fecha_hora && <span>🗓️ {new Date(s.fecha_hora).toLocaleString("es-VE")}</span>}
                        <span className="date">Aprobada: {new Date(s.aprobado_en).toLocaleDateString("es-VE")}{s.aprobado_por ? ` por ${s.aprobado_por}` : ""}</span>
                      </div>
                      {enProceso
                        ? <p style={{ fontSize: "0.8rem", color: mia ? "#16a34a" : "#2563eb", marginTop: "0.4rem", fontWeight: 600 }}>
                            {mia ? "🔒 Bloqueada por tu grupo — puedes resolverla" : `🔒 En proceso — bloqueada por ${s.reclamado_por.nombre}`}
                          </p>
                        : <p style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: "0.4rem" }}>🟢 Disponible para bloquear</p>
                      }
                      <button type="button" className="btn-ghost" style={{ padding: "2px 8px", fontSize: "0.78rem", marginTop: "0.2rem" }}
                        onClick={() => toggleHistorial(s)}>
                        {historiales[s.id] ? "▲ Ocultar historial" : "🕘 Ver historial"}
                      </button>
                      {historiales[s.id] && (
                        <div style={{ marginTop: "0.4rem", borderTop: "1px solid #e5e7eb", paddingTop: "0.4rem" }}>
                          {historiales[s.id].length === 0
                            ? <p style={{ fontSize: "0.78rem", color: "#6b7280" }}>Sin eventos registrados.</p>
                            : historiales[s.id].map((h, i) => (
                                <div key={i} style={{ fontSize: "0.78rem", color: "#374151", marginBottom: "0.3rem" }}>
                                  <strong>{EVENTO_LABEL[h.evento] || h.evento}</strong>
                                  {h.usuario ? ` · ${h.usuario}` : ""} · {new Date(h.fecha).toLocaleString("es-VE")}
                                  {h.detalle && <div style={{ color: "#6b7280" }}>{h.detalle}</div>}
                                </div>
                              ))
                          }
                        </div>
                      )}
                    </div>
                    {puedeBloquear && (!enProceso || mia) && (
                      <button className={mia ? "btn-secondary" : "btn-assign"} disabled={procesando[s.id]}
                        onClick={() => mia ? terminarYGuardar(s) : bloquear(s)}>
                        {procesando[s.id] ? "..." : mia ? "🔓 Desbloquear" : "🔒 Bloquear"}
                      </button>
                    )}
                  </div>

                  {/* Ítems de la solicitud */}
                  {s.items && s.items.length > 0 && (
                    <div style={{ marginTop: "0.75rem" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                        <thead>
                          <tr style={{ background: "#f3f4f6" }}>
                            <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 700 }}>Nombre</th>
                            <th style={{ textAlign: "center", padding: "6px 10px", fontWeight: 700, width: 130 }}>Progreso</th>
                            {mia && <th style={{ textAlign: "center", padding: "6px 10px", fontWeight: 700, width: 140 }}>Aportar ahora</th>}
                            {mia && <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 700, width: 160 }}>Comentario</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {s.items.map(item => {
                            const cubierto = !item.cantidad_flexible && item.cantidad_resuelta >= item.cantidad;
                            return (
                              <tr key={item.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                                <td style={{ padding: "6px 10px" }}>{item.nombre}</td>
                                <td style={{ padding: "6px 10px", textAlign: "center", fontWeight: 700, color: cubierto ? "#16a34a" : "#374151" }}>
                                  {item.cantidad_flexible
                                    ? `${item.cantidad_resuelta} aportado(s)`
                                    : `${item.cantidad_resuelta} / ${item.cantidad}`}
                                </td>
                                {mia && (
                                  <td style={{ padding: "4px 6px", textAlign: "center" }}>
                                    {cubierto
                                      ? <span style={{ color: "#16a34a", fontSize: "0.8rem" }}>✔ Completo</span>
                                      : <input type="number" min={0}
                                          value={aportes[s.id]?.[item.id]?.cantidad ?? ""}
                                          onChange={e => setAporte(s.id, item.id, "cantidad", e.target.value)}
                                          style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 4, padding: "4px 8px", fontSize: "0.85rem", textAlign: "center" }} />
                                    }
                                  </td>
                                )}
                                {mia && (
                                  <td style={{ padding: "4px 6px" }}>
                                    <input value={aportes[s.id]?.[item.id]?.comentario ?? ""}
                                      placeholder="Opcional"
                                      onChange={e => setAporte(s.id, item.id, "comentario", e.target.value)}
                                      style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 4, padding: "4px 8px", fontSize: "0.85rem" }} />
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Mensaje general de la resolución + acciones de cierre */}
                  {mia && (
                    <div style={{ marginTop: "0.9rem" }}>
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                        Mensaje general de esta resolución (opcional)
                      </label>
                      <textarea rows={2} placeholder="Ej: se entregó todo en mano al receptor a las 3pm..."
                        value={mensajes[s.id] ?? ""}
                        onChange={e => setMensajes(p => ({ ...p, [s.id]: e.target.value }))}
                        style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px", fontSize: "0.85rem", fontFamily: "inherit", resize: "vertical" }} />
                      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.6rem", flexWrap: "wrap" }}>
                        <button className="btn-primary" disabled={procesando[s.id]} onClick={() => terminarYGuardar(s)}>
                          {procesando[s.id] ? "..." : "💾 Terminar y guardar"}
                        </button>
                        <button className="btn-secondary" disabled={procesando[s.id]} onClick={() => resolverYGuardar(s)}>
                          {procesando[s.id] ? "..." : "✅ Resolver y guardar"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}

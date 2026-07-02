import { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

const PRIORIDAD_COLOR = { Alta: "#dc2626", Normal: "#d97706", Baja: "#6b7280" };
const PRIORIDAD_BG    = { Alta: "#fee2e2", Normal: "#fef3c7", Baja: "#f3f4f6" };

export default function ModuloSolicitudesAprobadas() {
  const { user } = useAuth();
  const puedeReclamar = user.rol === "grupo";

  const [lista,          setLista]          = useState([]);
  const [filtroOrigen,   setFiltroOrigen]   = useState("todos");
  const [filtroTipo,     setFiltroTipo]     = useState("todos");
  const [msg,            setMsg]            = useState(null);
  const [procesando,     setProcesando]     = useState({});
  const [detalle,        setDetalle]        = useState(null);
  const [aportes,        setAportes]        = useState({});

  const reload = async () => {
    const data = await api.getSolicitudesAprobadas();
    setLista(data);
    if (detalle) {
      const actualizada = data.find(s => s.id === detalle.id);
      setDetalle(actualizada || null);
    }
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

  const abrirDetalle = (s) => {
    setDetalle(s);
    const inicial = {};
    (s.items || []).forEach(i => { inicial[i.id] = { cantidad: "", comentario: "" }; });
    setAportes(inicial);
  };

  const reclamar = async (s) => {
    setProcesando(p => ({ ...p, [s.id]: true }));
    try {
      await api.reclamarSolicitud(s.id);
      const data = await reload();
      const actualizada = data.find(x => x.id === s.id);
      if (actualizada) abrirDetalle(actualizada);
      flash("Solicitud reclamada. Ahora solo tu grupo puede resolverla.");
    } catch (err) { flash(err.message, false); }
    finally { setProcesando(p => ({ ...p, [s.id]: false })); }
  };

  const setAporte = (itemId, campo, valor) =>
    setAportes(p => ({ ...p, [itemId]: { ...p[itemId], [campo]: valor } }));

  const liberar = async () => {
    setProcesando(p => ({ ...p, [detalle.id]: true }));
    try {
      const payload = Object.entries(aportes)
        .map(([item_id, a]) => ({ item_id: Number(item_id), cantidad: Number(a.cantidad) || 0, comentario: a.comentario }))
        .filter(a => a.cantidad > 0);
      await api.liberarSolicitud(detalle.id, payload);
      await reload();
      flash("Aportes guardados.");
    } catch (err) { flash(err.message, false); }
    finally { setProcesando(p => ({ ...p, [detalle.id]: false })); }
  };

  const marcarResuelta = async () => {
    if (!confirm("¿Marcar esta solicitud como resuelta por completo?")) return;
    setProcesando(p => ({ ...p, [detalle.id]: true }));
    try {
      await api.marcarResueltaSolicitud(detalle.id);
      setDetalle(null);
      await reload();
      flash("Solicitud marcada como resuelta.");
    } catch (err) { flash(err.message, false); }
    finally { setProcesando(p => ({ ...p, [detalle.id]: false })); }
  };

  const esMia = (s) => s.reclamado_por && s.reclamado_por.id === user.grupo_id;

  return (
    <div className="modulo">
      <h2>📦 Solicitudes Aprobadas</h2>
      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "-0.5rem", marginBottom: "1rem" }}>
        Tablero colaborativo: cualquier grupo puede reclamar una solicitud aprobada y resolverla, total o parcialmente.
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
            {visibles.map(s => (
              <div key={s.id} className="card sol-card" onClick={() => abrirDetalle(s)} style={{ cursor: "pointer" }}>
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
                    {s.receptor_nombre && <span>👤 Recibe: {s.receptor_nombre}</span>}
                    {s.ubicacion && <span>📍 {s.ubicacion.slice(0, 60)}{s.ubicacion.length > 60 ? "…" : ""}</span>}
                    <span className="date">Aprobada: {new Date(s.aprobado_en).toLocaleDateString("es-VE")}</span>
                  </div>
                  {s.reclamado_por
                    ? <p style={{ fontSize: "0.8rem", color: esMia(s) ? "#16a34a" : "#2563eb", marginTop: "0.4rem", fontWeight: 600 }}>
                        {esMia(s) ? "🔓 Reclamada por tu grupo — puedes resolverla" : `🔒 En proceso — reclamada por ${s.reclamado_por.nombre}`}
                      </p>
                    : <p style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: "0.4rem" }}>🟢 Disponible para reclamar</p>
                  }
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "flex-end" }}
                  onClick={e => e.stopPropagation()}>
                  {puedeReclamar && !s.reclamado_por && (
                    <button className="btn-assign" disabled={procesando[s.id]} onClick={() => reclamar(s)}>
                      {procesando[s.id] ? "..." : "🙋 Reclamar"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      {/* Modal detalle / resolución */}
      {detalle && (
        <div className="overlay" onClick={() => setDetalle(null)}>
          <div className="modal modal-detalle" onClick={e => e.stopPropagation()}>
            <div className="detalle-header">
              <span className="prioridad-tag"
                style={{ background: PRIORIDAD_BG[detalle.prioridad], color: PRIORIDAD_COLOR[detalle.prioridad] }}>
                {detalle.prioridad}
              </span>
              <button className="btn-ghost" onClick={() => setDetalle(null)}>✕</button>
            </div>
            <h3 style={{ marginBottom: "1rem" }}>Detalle de Solicitud Aprobada</h3>
            <DetalleRow label="Descripción" value={detalle.descripcion} />
            <DetalleRow label="Origen" value={detalle.origen?.nombre} />
            <DetalleRow label="Ubicación" value={detalle.ubicacion} />
            <DetalleRow label="Fecha / Hora" value={detalle.fecha_hora ? new Date(detalle.fecha_hora).toLocaleString("es-VE") : null} />
            <DetalleRow label="Solicitante" value={detalle.solicitante?.nombre} />
            <DetalleRow label="Recibe" value={detalle.receptor_nombre} />
            <DetalleRow label="Tel. de quien recibe" value={detalle.receptor_telefono} />
            <DetalleRow label="Aprobada por" value={detalle.aprobado_por ? `${detalle.aprobado_por} · ${new Date(detalle.aprobado_en).toLocaleString("es-VE")}` : null} />

            {detalle.reclamado_por && (
              <div style={{
                marginTop: "0.75rem", padding: "0.6rem 0.85rem", borderRadius: 8,
                background: esMia(detalle) ? "#dcfce7" : "#dbeafe",
                color: esMia(detalle) ? "#16a34a" : "#2563eb", fontWeight: 600, fontSize: "0.85rem"
              }}>
                {esMia(detalle) ? "🔓 Reclamada por tu grupo" : `🔒 En proceso — reclamada por ${detalle.reclamado_por.nombre}`}
              </div>
            )}

            {detalle.items && detalle.items.length > 0 && (
              <div style={{ marginTop: "0.9rem" }}>
                <div className="detalle-label" style={{ marginBottom: "0.4rem" }}>Ítems solicitados</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ background: "#f3f4f6" }}>
                      <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 700 }}>Nombre</th>
                      <th style={{ textAlign: "center", padding: "6px 10px", fontWeight: 700, width: 130 }}>Progreso</th>
                      {esMia(detalle) && <th style={{ textAlign: "center", padding: "6px 10px", fontWeight: 700, width: 140 }}>Aportar ahora</th>}
                      {esMia(detalle) && <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 700, width: 160 }}>Comentario</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.items.map(item => {
                      const cubierto = !item.cantidad_flexible && item.cantidad_resuelta >= item.cantidad;
                      return (
                        <tr key={item.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                          <td style={{ padding: "6px 10px" }}>{item.nombre}</td>
                          <td style={{ padding: "6px 10px", textAlign: "center", fontWeight: 700, color: cubierto ? "#16a34a" : "#374151" }}>
                            {item.cantidad_flexible
                              ? `${item.cantidad_resuelta} aportado(s)`
                              : `${item.cantidad_resuelta} / ${item.cantidad}`}
                          </td>
                          {esMia(detalle) && (
                            <td style={{ padding: "4px 6px", textAlign: "center" }}>
                              {cubierto
                                ? <span style={{ color: "#16a34a", fontSize: "0.8rem" }}>✔ Completo</span>
                                : <input type="number" min={0}
                                    value={aportes[item.id]?.cantidad ?? ""}
                                    onChange={e => setAporte(item.id, "cantidad", e.target.value)}
                                    style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 4, padding: "4px 8px", fontSize: "0.85rem", textAlign: "center" }} />
                              }
                            </td>
                          )}
                          {esMia(detalle) && (
                            <td style={{ padding: "4px 6px" }}>
                              <input value={aportes[item.id]?.comentario ?? ""}
                                placeholder="Opcional"
                                onChange={e => setAporte(item.id, "comentario", e.target.value)}
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

            <div className="modal-actions" style={{ marginTop: "1rem" }}>
              {puedeReclamar && !detalle.reclamado_por && (
                <button className="btn-primary" disabled={procesando[detalle.id]} onClick={() => reclamar(detalle)}>
                  {procesando[detalle.id] ? "..." : "🙋 Reclamar solicitud"}
                </button>
              )}
              {esMia(detalle) && (
                <>
                  <button className="btn-primary" disabled={procesando[detalle.id]} onClick={liberar}>
                    {procesando[detalle.id] ? "..." : "💾 Guardar aportes y liberar"}
                  </button>
                  <button className="btn-secondary" disabled={procesando[detalle.id]} onClick={marcarResuelta}>
                    ✔ Marcar como resuelta
                  </button>
                </>
              )}
              <button className="btn-ghost" onClick={() => setDetalle(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
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

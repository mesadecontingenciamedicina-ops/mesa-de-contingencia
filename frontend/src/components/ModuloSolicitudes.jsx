import { useState, useEffect, lazy, Suspense, useRef } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

const MapaPicker = lazy(() => import("./MapaPicker"));

const PRIORIDADES = ["Baja", "Normal", "Alta"];
const PRIORIDAD_COLOR = { Alta: "#dc2626", Normal: "#d97706", Baja: "#6b7280" };
const PRIORIDAD_BG    = { Alta: "#fee2e2", Normal: "#fef3c7", Baja: "#f3f4f6" };

function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const FORM_VACIO = () => ({
  descripcion: "", solicitante_id: "", prioridad: "Normal",
  ubicacion: "", lat: null, lng: null, fecha_hora: nowLocal(),
  items: [],
});

export default function ModuloSolicitudes({ onDataChange }) {
  const { user } = useAuth();
  const isAdmin = user.rol === "admin";

  const [pendientes,     setPendientes]     = useState([]);
  const [misSolicitudes, setMisSolicitudes] = useState([]);
  const [grupos,         setGrupos]         = useState([]);
  const [miembros,       setMiembros]       = useState([]);
  const [modal,          setModal]          = useState(null);
  const [grupoSel,       setGrupoSel]       = useState("");
  const [form,           setForm]           = useState(FORM_VACIO);
  const [showForm,       setShowForm]       = useState(false);
  const [msg,            setMsg]            = useState(null);
  const [autoasignando,  setAutoasignando]  = useState({});
  const [detalle,        setDetalle]        = useState(null);
  const [editando,       setEditando]       = useState(null);

  const reload = async () => {
    const [ms] = await Promise.all([api.getMiembros()]);
    setMiembros(ms);
    if (isAdmin) {
      const [p, g] = await Promise.all([api.getSolicitudesPendientes(), api.getGrupos()]);
      setPendientes(p); setGrupos(g);
    } else {
      setMisSolicitudes(await api.getSolicitudes());
    }
  };
  useEffect(() => { reload(); }, []);

  const flash = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 3500); };
  const f = (campo, valor) => setForm(p => ({ ...p, [campo]: valor }));

  const abrirForm = () => { setForm(FORM_VACIO()); setShowForm(true); };

  const submitSolicitud = async (e) => {
    e.preventDefault();
    if (!form.descripcion.trim()) return flash("La descripción es obligatoria.", false);
    try {
      await api.crearSolicitud(form);
      setShowForm(false);
      await reload(); onDataChange();
      flash("Solicitud registrada.");
    } catch (err) { flash(err.message, false); }
  };

  const abrirEditar = (s) => {
    setEditando({
      id: s.id,
      descripcion: s.descripcion || "",
      prioridad: s.prioridad || "Normal",
      ubicacion: s.ubicacion || "",
      lat: s.lat || null,
      lng: s.lng || null,
      fecha_hora: s.fecha_hora ? s.fecha_hora.slice(0, 16) : nowLocal(),
      solicitante_id: s.solicitante_id || "",
      items: (s.items || []).map(i => ({ nombre: i.nombre, cantidad: i.cantidad })),
    });
  };

  const submitEditar = async (e) => {
    e.preventDefault();
    if (!editando.descripcion.trim()) return flash("La descripción es obligatoria.", false);
    try {
      await api.editarSolicitud(editando.id, editando);
      setEditando(null);
      await reload(); onDataChange();
      flash("Solicitud actualizada.");
    } catch (err) { flash(err.message, false); }
  };

  const autoasignar = async (solicitudId) => {
    setAutoasignando(p => ({ ...p, [solicitudId]: true }));
    try {
      await api.crearActividad({ solicitud_id: solicitudId, grupo_id: user.grupo_id });
      await reload(); onDataChange();
      flash("Solicitud autoasignada. Ya aparece en tus actividades.");
    } catch (err) { flash(err.message, false); }
    finally { setAutoasignando(p => ({ ...p, [solicitudId]: false })); }
  };

  const asignar = async () => {
    if (!grupoSel) return flash("Selecciona un grupo.", false);
    try {
      await api.crearActividad({ solicitud_id: modal.id, grupo_id: Number(grupoSel) });
      setModal(null); setGrupoSel("");
      await reload(); onDataChange();
      flash("Solicitud asignada y convertida en actividad.");
    } catch (err) { flash(err.message, false); }
  };

  const lista = isAdmin ? pendientes : misSolicitudes;

  return (
    <div className="modulo">
      <h2>{isAdmin ? "📥 Bandeja de Solicitudes" : "📥 Mis Solicitudes"}</h2>
      {msg && <div className={`alert ${msg.ok ? "alert-ok" : "alert-err"}`}>{msg.text}</div>}

      <button className="btn-secondary" onClick={() => showForm ? setShowForm(false) : abrirForm()}>
        {showForm ? "✕ Cancelar" : "+ Nueva Solicitud"}
      </button>

      {showForm && (
        <form onSubmit={submitSolicitud} className="form sol-form" style={{ maxWidth: "100%", marginTop: "1.25rem" }}>

          {/* Fila 1: descripción + prioridad */}
          <div className="form-row">
            <label>Descripción / Solicitud *
              <textarea required rows={4} value={form.descripcion}
                onChange={e => f("descripcion", e.target.value)}
                placeholder="Describe detalladamente la necesidad o situación..." />
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
              <label>Prioridad *
                <div className="prioridad-group">
                  {PRIORIDADES.map(p => (
                    <button key={p} type="button"
                      className={`prioridad-btn ${form.prioridad === p ? "prioridad-active" : ""}`}
                      style={form.prioridad === p
                        ? { background: PRIORIDAD_BG[p], color: PRIORIDAD_COLOR[p], borderColor: PRIORIDAD_COLOR[p] }
                        : {}}
                      onClick={() => f("prioridad", p)}
                    >{p}</button>
                  ))}
                </div>
              </label>
              <label>Fecha y hora del evento *
                <input type="datetime-local" value={form.fecha_hora}
                  onChange={e => f("fecha_hora", e.target.value)} />
              </label>
              <label>Solicitante (miembro)
                <select value={form.solicitante_id}
                  onChange={e => f("solicitante_id", e.target.value || "")}>
                  <option value="">— Seleccionar miembro —</option>
                  {miembros.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}{m.cargo ? ` · ${m.cargo}` : ""}{m.cedula ? ` (${m.cedula})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <TablaItems items={form.items || []}
            onChange={items => setForm(p => ({ ...p, items }))} />

          {/* Mapa */}
          <label>Ubicación — haz clic en el mapa o busca una dirección
            <Suspense fallback={<div className="mapa-loading">Cargando mapa...</div>}>
              <MapaPicker
                value={{ lat: form.lat, lng: form.lng, address: form.ubicacion }}
                onChange={({ lat, lng, address }) => setForm(p => ({ ...p, lat, lng, ubicacion: address }))}
              />
            </Suspense>
          </label>

          <button type="submit" className="btn-primary">Guardar Solicitud</button>
        </form>
      )}

      <h3 style={{ marginTop: "1.5rem" }}>
        {isAdmin ? `Pendientes de asignación (${lista.length})` : `Solicitudes enviadas (${lista.length})`}
      </h3>

      {lista.length === 0
        ? <p className="empty">{isAdmin ? "No hay solicitudes pendientes." : "Tu grupo no ha enviado solicitudes aún."}</p>
        : (
          <div className="card-list">
            {lista.map(s => (
              <div key={s.id} className="card sol-card" onClick={() => setDetalle(s)} style={{ cursor: "pointer" }}>
                <div className="card-body">
                  <div className="sol-card-top">
                    <span className="prioridad-tag"
                      style={{ background: PRIORIDAD_BG[s.prioridad], color: PRIORIDAD_COLOR[s.prioridad] }}>
                      {s.prioridad}
                    </span>
                    {s.grupo_origen && <span className="origen-badge">📤 {s.grupo_origen.nombre}</span>}
                  </div>
                  <p className="card-desc">{s.descripcion}</p>
                  <div className="sol-meta">
                    {s.solicitante_nombre && <span>👤 {s.solicitante_nombre}</span>}
                    {s.ubicacion && <span>📍 {s.ubicacion.slice(0, 60)}{s.ubicacion.length > 60 ? "…" : ""}</span>}
                    {s.fecha_hora && <span>🕐 {new Date(s.fecha_hora).toLocaleString("es-VE")}</span>}
                    <span className="date">Creada: {new Date(s.fecha_creacion).toLocaleDateString("es-VE")}</span>
                    {s.fecha_actualizacion && (
                      <span className="date" style={{ color: "#d97706" }}>
                        ✏️ Actualizada: {new Date(s.fecha_actualizacion).toLocaleString("es-VE")}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:"0.4rem", alignItems:"flex-end" }}
                     onClick={e => e.stopPropagation()}>
                  <button className="btn-edit-grupo" title="Editar" onClick={() => abrirEditar(s)}>✏️</button>
                  {s.actividad_estado
                    ? <span className={`badge-estado badge-${s.actividad_estado.replace(/ /g,"-").toLowerCase()}`}>
                        {s.actividad_estado}
                      </span>
                    : isAdmin
                      ? <button className="btn-assign" onClick={() => { setModal(s); setGrupoSel(""); }}>Asignar →</button>
                      : <button className="btn-assign" disabled={autoasignando[s.id]}
                          onClick={() => autoasignar(s.id)}>
                          {autoasignando[s.id] ? "..." : "⚡ Autoasignar"}
                        </button>
                  }
                </div>
              </div>
            ))}
          </div>
        )}

      {/* Modal asignación */}
      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Asignar al Grupo</h3>
            <p className="modal-desc">{modal.descripcion}</p>
            {modal.grupo_origen && <p style={{ fontSize:"0.82rem", color:"#6b7280", marginBottom:"0.75rem" }}>📤 {modal.grupo_origen.nombre}</p>}
            <label>Grupo de Trabajo
              <select value={grupoSel} onChange={e => setGrupoSel(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
              </select>
            </label>
            <div className="modal-actions">
              <button className="btn-primary" onClick={asignar}>Confirmar</button>
              <button className="btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle */}
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
            <h3 style={{ marginBottom:"1rem" }}>Detalle de Solicitud</h3>
            <DetalleRow label="Descripción"  value={detalle.descripcion} />
            <DetalleRow label="Ubicación"    value={detalle.ubicacion} />
            {detalle.lat && <DetalleRow label="Coordenadas" value={`${detalle.lat?.toFixed(5)}, ${detalle.lng?.toFixed(5)}`} />}
            <DetalleRow label="Fecha / Hora" value={detalle.fecha_hora ? new Date(detalle.fecha_hora).toLocaleString("es-VE") : null} />
            <DetalleRow label="Solicitante"  value={detalle.solicitante_nombre} />
            <DetalleRow label="Teléfono"     value={detalle.solicitante_telefono} />
            <DetalleRow label="Correo"       value={detalle.solicitante_email} />
            <DetalleRow label="Grupo origen" value={detalle.grupo_origen?.nombre} />
            <DetalleRow label="Estado"       value={detalle.actividad_estado || "Pendiente de asignación"} />
            <DetalleRow label="Registrada"   value={new Date(detalle.fecha_creacion).toLocaleString("es-VE")} />
            {detalle.fecha_actualizacion && (
              <DetalleRow label="Última edición" value={new Date(detalle.fecha_actualizacion).toLocaleString("es-VE")} />
            )}
            {detalle.items && detalle.items.length > 0 && (
              <div style={{ marginTop: "0.75rem" }}>
                <div className="detalle-label" style={{ marginBottom: "0.4rem" }}>Ítems solicitados</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ background: "#f3f4f6" }}>
                      <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 700 }}>Nombre</th>
                      <th style={{ textAlign: "center", padding: "6px 10px", fontWeight: 700, width: 90 }}>Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.items.map((item, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
                        <td style={{ padding: "6px 10px" }}>{item.nombre}</td>
                        <td style={{ padding: "6px 10px", textAlign: "center", fontWeight: 700 }}>{item.cantidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {detalle.lat && (
              <div style={{ marginTop:"0.75rem" }}>
                <MapaReadOnly lat={detalle.lat} lng={detalle.lng} />
              </div>
            )}
          </div>
        </div>
      )}
      {/* Modal editar solicitud */}
      {editando && (
        <div className="overlay" onClick={() => setEditando(null)}>
          <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
            <h3>✏️ Editar Solicitud</h3>
            <form onSubmit={submitEditar} className="form" style={{ marginTop: "0.75rem" }}>
              <div className="form-row">
                <label>Descripción / Solicitud *
                  <textarea required rows={4} value={editando.descripcion}
                    onChange={e => setEditando(p => ({ ...p, descripcion: e.target.value }))}
                    placeholder="Describe detalladamente la necesidad..." />
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                  <label>Prioridad *
                    <div className="prioridad-group">
                      {PRIORIDADES.map(p => (
                        <button key={p} type="button"
                          className={`prioridad-btn ${editando.prioridad === p ? "prioridad-active" : ""}`}
                          style={editando.prioridad === p
                            ? { background: PRIORIDAD_BG[p], color: PRIORIDAD_COLOR[p], borderColor: PRIORIDAD_COLOR[p] }
                            : {}}
                          onClick={() => setEditando(prev => ({ ...prev, prioridad: p }))}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </label>
                  <label>Fecha y hora del evento
                    <input type="datetime-local" value={editando.fecha_hora}
                      onChange={e => setEditando(p => ({ ...p, fecha_hora: e.target.value }))} />
                  </label>
                  <label>Solicitante (miembro)
                    <select value={editando.solicitante_id}
                      onChange={e => setEditando(p => ({ ...p, solicitante_id: e.target.value || "" }))}>
                      <option value="">— Seleccionar miembro —</option>
                      {miembros.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.nombre}{m.cargo ? ` · ${m.cargo}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <TablaItems items={editando.items || []}
                onChange={items => setEditando(p => ({ ...p, items }))} />
              <label>Ubicación — haz clic en el mapa o busca una dirección
                <Suspense fallback={<div className="mapa-loading">Cargando mapa...</div>}>
                  <MapaPicker
                    value={{ lat: editando.lat, lng: editando.lng, address: editando.ubicacion }}
                    onChange={({ lat, lng, address }) => setEditando(p => ({ ...p, lat, lng, ubicacion: address }))}
                  />
                </Suspense>
              </label>

              <div className="modal-actions">
                <button type="submit" className="btn-primary">Guardar cambios</button>
                <button type="button" className="btn-ghost" onClick={() => setEditando(null)}>Cancelar</button>
              </div>
            </form>
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

function TablaItems({ items, onChange }) {
  const agregar = () => onChange([...items, { nombre: "", cantidad: 1 }]);
  const actualizar = (i, campo, valor) => {
    const copia = items.map((it, idx) => idx === i ? { ...it, [campo]: valor } : it);
    onChange(copia);
  };
  const eliminar = (i) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div style={{ marginTop: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#374151" }}>Ítems requeridos</span>
        <button type="button" className="btn-secondary" style={{ fontSize: "0.8rem", padding: "4px 12px" }}
          onClick={agregar}>+ Agregar ítem</button>
      </div>
      {items.length === 0
        ? <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>Sin ítems añadidos.</p>
        : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 700 }}>Nombre del ítem</th>
                <th style={{ textAlign: "center", padding: "6px 10px", fontWeight: 700, width: 100 }}>Cantidad</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "4px 6px" }}>
                    <input value={item.nombre} placeholder="Ej. Camillas"
                      onChange={e => actualizar(i, "nombre", e.target.value)}
                      style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 4, padding: "4px 8px", fontSize: "0.85rem" }} />
                  </td>
                  <td style={{ padding: "4px 6px" }}>
                    <input type="number" min={0} value={item.cantidad}
                      onChange={e => actualizar(i, "cantidad", e.target.value === "" ? 0 : parseInt(e.target.value) || 0)}
                      onFocus={e => e.target.select()}
                      style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 4, padding: "4px 8px", fontSize: "0.85rem", textAlign: "center" }} />
                  </td>
                  <td style={{ padding: "4px 6px", textAlign: "center" }}>
                    <button type="button" onClick={() => eliminar(i)}
                      style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 4,
                        width: 26, height: 26, cursor: "pointer", fontSize: "0.8rem", lineHeight: 1 }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    </div>
  );
}

// Mini mapa de solo lectura para el detalle
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

import { useState, useEffect, lazy, Suspense, useRef } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import 'react-phone-number-input/style.css';
import PhoneInput from 'react-phone-number-input';

const MapaPicker = lazy(() => import("./MapaPicker"));

const PRIORIDADES = ["Baja", "Normal", "Alta"];
const PRIORIDAD_COLOR = { Alta: "#dc2626", Normal: "#d97706", Baja: "#6b7280" };
const PRIORIDAD_BG    = { Alta: "#fee2e2", Normal: "#fef3c7", Baja: "#f3f4f6" };

const ESTADOS = ["Pendiente", "Aprobada", "Rechazada", "Resuelta"];
const ESTADO_COLOR = { Pendiente: "#d97706", Aprobada: "#16a34a", Rechazada: "#dc2626", Resuelta: "#2563eb" };
const ESTADO_BG    = { Pendiente: "#fef3c7", Aprobada: "#dcfce7", Rechazada: "#fee2e2", Resuelta: "#dbeafe" };

const TIPOS_SOLICITUD = ["Grupo", "Centro", "Administración", "Externos"];

const EVENTO_LABEL = {
  creada: "Creada", aprobada: "Aprobada", rechazada: "Rechazada", reenviada: "Reenviada",
  editada: "Editada", reclamada: "Bloqueada", liberada: "Avance guardado", resuelta: "Resuelta",
};

function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const FORM_VACIO = () => ({
  descripcion: "", solicitante_id: "", prioridad: "Normal",
  ubicacion: "", lat: null, lng: null, fecha_hora: nowLocal(),
  receptor_nombre: "", receptor_telefono: "",
  items: [],
});

export default function ModuloSolicitudes({ onDataChange }) {
  const { user } = useAuth();
  const isAdmin = user.rol === "admin";
  const isPrivileged = isAdmin || user.es_coordinador;

  const [lista,          setLista]          = useState([]);
  const [estadoFiltro,   setEstadoFiltro]   = useState("Pendiente");
  const [tipoFiltro,     setTipoFiltro]     = useState("Todas");
  const [miembros,       setMiembros]       = useState([]);
  const [form,           setForm]           = useState(FORM_VACIO);
  const [showForm,       setShowForm]       = useState(false);
  const [msg,            setMsg]            = useState(null);
  const [procesando,     setProcesando]     = useState({});
  const [detalle,        setDetalle]        = useState(null);
  const [historial,      setHistorial]      = useState(null);
  const [editando,       setEditando]       = useState(null);
  const [modalRechazo,   setModalRechazo]   = useState(null);
  const [motivoRechazo,  setMotivoRechazo]  = useState("");

  const reload = async () => {
    const [ms] = await Promise.all([api.getMiembros()]);
    setMiembros(ms);
    setLista(await api.getSolicitudes(isPrivileged ? (estadoFiltro === "Todas" ? null : estadoFiltro) : null));
  };
  useEffect(() => { reload(); }, [estadoFiltro]);

  useEffect(() => {
    if (!detalle) { setHistorial(null); return; }
    api.getHistorialSolicitud(detalle.id).then(setHistorial).catch(() => setHistorial([]));
  }, [detalle?.id]);

  const visibles = lista.filter(s => tipoFiltro === "Todas" || s.tipo_solicitud === tipoFiltro);

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

  const puedeEditar = (s) =>
    (s.estado === "Pendiente" || s.estado === "Rechazada") &&
    (isAdmin || (s.origen.tipo === "grupo" && s.origen.id === user.grupo_id));

  const puedeEliminar = (s) =>
    isPrivileged || (s.estado === "Pendiente" && s.origen.tipo === "grupo" && s.origen.id === user.grupo_id);

  const abrirEditar = (s) => {
    setEditando({
      id: s.id,
      descripcion: s.descripcion || "",
      prioridad: s.prioridad || "Normal",
      ubicacion: s.ubicacion || "",
      lat: s.lat || null,
      lng: s.lng || null,
      fecha_hora: s.fecha_hora ? s.fecha_hora.slice(0, 16) : nowLocal(),
      solicitante_id: s.solicitante?.id || "",
      receptor_nombre: s.receptor_nombre || "",
      receptor_telefono: s.receptor_telefono || "",
      items: (s.items || []).map(i => ({
        nombre: i.nombre, cantidad: i.cantidad,
        cantidad_flexible: i.cantidad_flexible, insumo_id: i.insumo_id || null,
      })),
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

  const eliminar = async (s) => {
    if (!confirm(`¿Eliminar la solicitud "${s.descripcion.slice(0, 60)}…"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.eliminarSolicitud(s.id);
      await reload(); onDataChange();
      flash("Solicitud eliminada.");
    } catch (err) { flash(err.message, false); }
  };

  const aprobar = async (s) => {
    setProcesando(p => ({ ...p, [s.id]: true }));
    try {
      await api.aprobarSolicitud(s.id);
      await reload(); onDataChange();
      flash("Solicitud aprobada.");
    } catch (err) { flash(err.message, false); }
    finally { setProcesando(p => ({ ...p, [s.id]: false })); }
  };

  const submitRechazo = async (e) => {
    e.preventDefault();
    if (!motivoRechazo.trim()) return flash("El motivo de rechazo es obligatorio.", false);
    setProcesando(p => ({ ...p, [modalRechazo.id]: true }));
    try {
      await api.rechazarSolicitud(modalRechazo.id, motivoRechazo.trim());
      setModalRechazo(null); setMotivoRechazo("");
      await reload(); onDataChange();
      flash("Solicitud rechazada.");
    } catch (err) { flash(err.message, false); }
    finally { setProcesando(p => ({ ...p, [modalRechazo.id]: false })); }
  };

  return (
    <div className="modulo">
      <h2>{isPrivileged ? "📥 Bandeja de Solicitudes" : "📥 Mis Solicitudes"}</h2>
      {msg && <div className={`alert ${msg.ok ? "alert-ok" : "alert-err"}`}>{msg.text}</div>}

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.5rem" }}>
        <button className="btn-secondary" onClick={() => showForm ? setShowForm(false) : abrirForm()}>
          {showForm ? "✕ Cancelar" : "+ Nueva Solicitud"}
        </button>
        {isPrivileged && (
          <div className="prioridad-group">
            {["Todas", ...ESTADOS].map(e => (
              <button key={e} type="button"
                className={`prioridad-btn ${estadoFiltro === e ? "prioridad-active" : ""}`}
                style={estadoFiltro === e && e !== "Todas"
                  ? { background: ESTADO_BG[e], color: ESTADO_COLOR[e], borderColor: ESTADO_COLOR[e] }
                  : {}}
                onClick={() => setEstadoFiltro(e)}>
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      {isPrivileged && (
        <div className="prioridad-group" style={{ marginBottom: "0.5rem", flexWrap: "wrap" }}>
          {["Todas", ...TIPOS_SOLICITUD].map(t => (
            <button key={t} type="button"
              className={`prioridad-btn ${tipoFiltro === t ? "prioridad-active" : ""}`}
              onClick={() => setTipoFiltro(t)}>
              {t}
            </button>
          ))}
        </div>
      )}

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

          {/* Receptor */}
          <div className="form-row">
            <label>Nombre de quien recibe
              <input value={form.receptor_nombre}
                onChange={e => f("receptor_nombre", e.target.value)}
                placeholder="Nombre de la persona que recibirá lo solicitado" />
            </label>
            <label>Teléfono de quien recibe
              <PhoneInput defaultCountry="VE" value={form.receptor_telefono}
                onChange={val => f("receptor_telefono", val || "")}
                placeholder="+58 412 1234567" />
            </label>
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
        {isPrivileged ? `Solicitudes (${visibles.length})` : `Solicitudes enviadas (${visibles.length})`}
      </h3>

      {visibles.length === 0
        ? <p className="empty">{isPrivileged ? "No hay solicitudes en este estado." : "Tu grupo no ha enviado solicitudes aún."}</p>
        : (
          <div className="card-list">
            {visibles.map(s => (
              <div key={s.id} className="card sol-card" onClick={() => setDetalle(s)} style={{ cursor: "pointer" }}>
                <div className="card-body">
                  <div className="sol-card-top">
                    <span className="prioridad-tag"
                      style={{ background: PRIORIDAD_BG[s.prioridad], color: PRIORIDAD_COLOR[s.prioridad] }}>
                      {s.prioridad}
                    </span>
                    <span className="prioridad-tag" style={{ background: ESTADO_BG[s.estado], color: ESTADO_COLOR[s.estado] }}>
                      {s.estado}
                    </span>
                    {s.origen?.nombre
                      ? <span className="origen-badge">{s.origen.tipo === "centro" ? "🏥" : "📤"} {s.origen.nombre}</span>
                      : <span className="origen-badge">🏛️ {s.tipo_solicitud}</span>}
                  </div>
                  <p className="card-desc">{s.descripcion}</p>
                  <div className="sol-meta">
                    {s.solicitante && <span>👤 {s.solicitante.nombre}</span>}
                    {s.ubicacion && <span>📍 {s.ubicacion.slice(0, 60)}{s.ubicacion.length > 60 ? "…" : ""}</span>}
                    {s.fecha_hora && <span>🕐 {new Date(s.fecha_hora).toLocaleString("es-VE")}</span>}
                    <span className="date">Creada: {new Date(s.fecha_creacion).toLocaleDateString("es-VE")}</span>
                    {s.fecha_actualizacion && (
                      <span className="date" style={{ color: "#d97706" }}>
                        ✏️ Actualizada: {new Date(s.fecha_actualizacion).toLocaleString("es-VE")}
                      </span>
                    )}
                  </div>
                  {s.estado === "Rechazada" && s.rechazo_motivo && (
                    <p style={{ fontSize: "0.8rem", color: "#dc2626", marginTop: "0.4rem" }}>
                      ❌ Motivo: {s.rechazo_motivo}
                    </p>
                  )}
                  {s.reclamado_por && (
                    <p style={{ fontSize: "0.8rem", color: "#2563eb", marginTop: "0.4rem" }}>
                      🔒 En proceso — reclamada por {s.reclamado_por.nombre}
                    </p>
                  )}
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:"0.4rem", alignItems:"flex-end" }}
                     onClick={e => e.stopPropagation()}>
                  {puedeEditar(s) && (
                    <button className="btn-edit-grupo" title="Editar" onClick={() => abrirEditar(s)}>✏️</button>
                  )}
                  {puedeEliminar(s) && (
                    <button className="btn-edit-grupo" style={{ background: "#dc2626" }} title="Eliminar"
                      onClick={() => eliminar(s)}>🗑️</button>
                  )}
                  {isPrivileged && s.estado === "Pendiente" && (
                    <>
                      <button className="btn-assign" disabled={procesando[s.id]} onClick={() => aprobar(s)}>
                        {procesando[s.id] ? "..." : "✅ Aprobar"}
                      </button>
                      <button className="btn-edit-grupo" style={{ background: "#dc2626" }}
                        onClick={() => { setModalRechazo(s); setMotivoRechazo(""); }}>
                        ❌ Rechazar
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      {/* Modal rechazo */}
      {modalRechazo && (
        <div className="overlay" onClick={() => setModalRechazo(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Rechazar Solicitud</h3>
            <p className="modal-desc">{modalRechazo.descripcion}</p>
            <form onSubmit={submitRechazo}>
              <label>Motivo del rechazo *
                <textarea required rows={3} value={motivoRechazo}
                  onChange={e => setMotivoRechazo(e.target.value)}
                  placeholder="Explica por qué se rechaza esta solicitud..." />
              </label>
              <div className="modal-actions">
                <button type="submit" className="btn-primary" disabled={procesando[modalRechazo.id]}>
                  {procesando[modalRechazo.id] ? "..." : "Confirmar rechazo"}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setModalRechazo(null)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal detalle */}
      {detalle && (
        <div className="overlay" onClick={() => setDetalle(null)}>
          <div className="modal modal-detalle" onClick={e => e.stopPropagation()}>
            <div className="detalle-header">
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <span className="prioridad-tag"
                  style={{ background: PRIORIDAD_BG[detalle.prioridad], color: PRIORIDAD_COLOR[detalle.prioridad] }}>
                  {detalle.prioridad}
                </span>
                <span className="prioridad-tag" style={{ background: ESTADO_BG[detalle.estado], color: ESTADO_COLOR[detalle.estado] }}>
                  {detalle.estado}
                </span>
              </div>
              <button className="btn-ghost" onClick={() => setDetalle(null)}>✕</button>
            </div>
            <h3 style={{ marginBottom:"1rem" }}>Detalle de Solicitud</h3>
            <DetalleRow label="Descripción"  value={detalle.descripcion} />
            <DetalleRow label="Ubicación"    value={detalle.ubicacion} />
            {detalle.lat && <DetalleRow label="Coordenadas" value={`${detalle.lat?.toFixed(5)}, ${detalle.lng?.toFixed(5)}`} />}
            <DetalleRow label="Fecha / Hora" value={detalle.fecha_hora ? new Date(detalle.fecha_hora).toLocaleString("es-VE") : null} />
            <DetalleRow label="Solicitante"  value={detalle.solicitante?.nombre} />
            <DetalleRow label="Teléfono"     value={detalle.solicitante?.telefono} />
            <DetalleRow label="Correo"       value={detalle.solicitante?.email} />
            <DetalleRow label="Origen"       value={detalle.origen?.nombre} />
            <DetalleRow label="Recibe"       value={detalle.receptor_nombre} />
            <DetalleRow label="Tel. de quien recibe" value={detalle.receptor_telefono} />
            <DetalleRow label="Registrada"   value={new Date(detalle.fecha_creacion).toLocaleString("es-VE")} />
            {detalle.fecha_actualizacion && (
              <DetalleRow label="Última edición" value={new Date(detalle.fecha_actualizacion).toLocaleString("es-VE")} />
            )}
            {detalle.aprobado_por && (
              <DetalleRow label="Aprobada por" value={`${detalle.aprobado_por} · ${new Date(detalle.aprobado_en).toLocaleString("es-VE")}`} />
            )}
            {detalle.estado === "Rechazada" && (
              <DetalleRow label="Motivo de rechazo" value={detalle.rechazo_motivo} />
            )}
            {detalle.reclamado_por && (
              <DetalleRow label="En proceso por" value={`${detalle.reclamado_por.nombre} · ${new Date(detalle.reclamado_en).toLocaleString("es-VE")}`} />
            )}
            {detalle.items && detalle.items.length > 0 && (
              <div style={{ marginTop: "0.75rem" }}>
                <div className="detalle-label" style={{ marginBottom: "0.4rem" }}>Ítems solicitados</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ background: "#f3f4f6" }}>
                      <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 700 }}>Nombre</th>
                      <th style={{ textAlign: "center", padding: "6px 10px", fontWeight: 700, width: 130 }}>Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.items.map((item) => (
                      <tr key={item.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                        <td style={{ padding: "6px 10px" }}>{item.nombre}</td>
                        <td style={{ padding: "6px 10px", textAlign: "center", fontWeight: 700 }}>
                          {item.cantidad_flexible
                            ? `cualquier cantidad (${item.cantidad_resuelta} aportado)`
                            : `${item.cantidad_resuelta} / ${item.cantidad}`}
                        </td>
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
            {historial && historial.length > 0 && (
              <div style={{ marginTop: "0.9rem" }}>
                <div className="detalle-label" style={{ marginBottom: "0.4rem" }}>Historial</div>
                {historial.map((h, i) => (
                  <div key={i} style={{ fontSize: "0.8rem", color: "#374151", marginBottom: "0.35rem" }}>
                    <strong>{EVENTO_LABEL[h.evento] || h.evento}</strong>
                    {h.usuario ? ` · ${h.usuario}` : ""} · {new Date(h.fecha).toLocaleString("es-VE")}
                    {h.detalle && <div style={{ color: "#6b7280" }}>{h.detalle}</div>}
                  </div>
                ))}
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
              <div className="form-row">
                <label>Nombre de quien recibe
                  <input value={editando.receptor_nombre}
                    onChange={e => setEditando(p => ({ ...p, receptor_nombre: e.target.value }))} />
                </label>
                <label>Teléfono de quien recibe
                  <PhoneInput defaultCountry="VE" value={editando.receptor_telefono}
                    onChange={val => setEditando(p => ({ ...p, receptor_telefono: val || "" }))} />
                </label>
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
  const agregar = () => onChange([...items, { nombre: "", cantidad: 1, cantidad_flexible: false, insumo_id: null }]);
  const actualizar = (i, campo, valor) =>
    onChange(items.map((it, idx) => idx === i ? { ...it, [campo]: valor } : it));
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
                <th style={{ textAlign: "center", padding: "6px 10px", fontWeight: 700, width: 110 }}>Cualquier cantidad</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "4px 6px" }}>
                    <InsumoInput value={item.nombre}
                      onChange={({ nombre, insumo_id }) => {
                        const copia = items.map((it, idx) =>
                          idx === i ? { ...it, nombre, insumo_id: insumo_id ?? it.insumo_id } : it
                        );
                        onChange(copia);
                      }} />
                  </td>
                  <td style={{ padding: "4px 6px" }}>
                    <input type="number" min={0} disabled={item.cantidad_flexible}
                      value={item.cantidad_flexible ? "" : item.cantidad}
                      onChange={e => actualizar(i, "cantidad", e.target.value === "" ? "" : parseInt(e.target.value) || 1)}
                      onBlur={e => { if (!e.target.value || parseInt(e.target.value) < 1) actualizar(i, "cantidad", 1); }}
                      onFocus={e => e.target.select()}
                      style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 4, padding: "4px 8px", fontSize: "0.85rem", textAlign: "center",
                        background: item.cantidad_flexible ? "#f3f4f6" : "#fff" }} />
                  </td>
                  <td style={{ padding: "4px 6px", textAlign: "center" }}>
                    <input type="checkbox" checked={!!item.cantidad_flexible}
                      onChange={e => actualizar(i, "cantidad_flexible", e.target.checked)} />
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

function InsumoInput({ value, onChange }) {
  const [sugerencias, setSugerencias] = useState([]);
  const [abierto, setAbierto]         = useState(false);
  const [timer, setTimer]             = useState(null);
  const ref = useRef(null);

  const buscar = (q) => {
    if (timer) clearTimeout(timer);
    if (!q || q.length < 2) { setSugerencias([]); setAbierto(false); return; }
    setTimer(setTimeout(async () => {
      try {
        const res = await api.buscarInsumos(q);
        setSugerencias(res);
        setAbierto(res.length > 0);
      } catch { setSugerencias([]); setAbierto(false); }
    }, 250));
  };

  const seleccionar = (ins) => {
    const label = ins.concentracion
      ? `${ins.nombre} ${ins.forma_farmaceutica || ""} ${ins.concentracion}`.trim()
      : `${ins.nombre} ${ins.forma_farmaceutica || ""}`.trim();
    onChange({ nombre: label, insumo_id: ins.id });
    setSugerencias([]); setAbierto(false);
  };

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input value={value} placeholder="Ej. Acetaminofén…"
        onChange={e => { onChange({ nombre: e.target.value, insumo_id: null }); buscar(e.target.value); }}
        onFocus={() => { if (sugerencias.length) setAbierto(true); }}
        style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 4, padding: "4px 8px", fontSize: "0.85rem" }} />
      {abierto && (
        <ul style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 999,
          background: "#fff", border: "1px solid #d1d5db", borderRadius: 4,
          boxShadow: "0 4px 12px rgba(0,0,0,0.12)", margin: 0, padding: 0,
          listStyle: "none", maxHeight: 220, overflowY: "auto",
        }}>
          {sugerencias.map(ins => (
            <li key={ins.id}
              onMouseDown={() => seleccionar(ins)}
              style={{ padding: "6px 10px", cursor: "pointer", borderBottom: "1px solid #f3f4f6" }}
              onMouseEnter={e => e.currentTarget.style.background = "#f0f4ff"}
              onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
              <span style={{ fontWeight: 600 }}>{ins.nombre}</span>
              {ins.forma_farmaceutica && <span style={{ color: "#6b7280", marginLeft: 6 }}>{ins.forma_farmaceutica}</span>}
              {ins.concentracion && <span style={{ color: "#9ca3af", marginLeft: 6, fontSize: "0.78rem" }}>{ins.concentracion}</span>}
            </li>
          ))}
        </ul>
      )}
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

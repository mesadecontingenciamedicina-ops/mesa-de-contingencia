import { useState, useEffect, useRef } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

const PRIORIDADES = ["Baja", "Normal", "Alta"];
const PRIORIDAD_COLOR = { Alta: "#dc2626", Normal: "#d97706", Baja: "#6b7280" };
const PRIORIDAD_BG = { Alta: "#fee2e2", Normal: "#fef3c7", Baja: "#f3f4f6" };
const ESTADO_COLOR = { Pendiente: "#d97706", Aprobada: "#16a34a", Rechazada: "#dc2626", Resuelta: "#2563eb" };
const ESTADO_BG = { Pendiente: "#fef3c7", Aprobada: "#dcfce7", Rechazada: "#fee2e2", Resuelta: "#dbeafe" };
const ESTADO_LABEL = {
  Pendiente: "⏳ Pendiente de aprobación",
  Aprobada: "✅ Aprobada — a la espera de ser resuelta",
  Rechazada: "❌ Rechazada",
  Resuelta: "✔ Resuelta",
};

function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const FORM_VACIO = (user) => ({
  descripcion: "", prioridad: "Normal",
  ubicacion: user?.centro_direccion || "",
  lat: user?.centro_lat || null,
  lng: user?.centro_lng || null,
  fecha_hora: nowLocal(),
  items: [],
});

export default function VistaCentro() {
  const { user, logout } = useAuth();
  const [solicitudes, setSolicitudes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO(user));
  const [editando, setEditando] = useState(null);
  const [msg, setMsg] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [modalPassword, setModalPassword] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleGuardarPassword = async (e) => {
    e.preventDefault();
    const { id, password } = modalPassword;
    if ((password || "").trim().length < 6) {
      flash("La contraseña debe tener al menos 6 caracteres.", false);
      return;
    }
    try {
      await api.cambiarPasswordCentro(id, { password });
      setModalPassword(null);
      setShowPassword(false);
      flash("Contraseña modificada exitosamente.");
    } catch (err) { flash(err.message, false); }
  };

  const handleLogout = async () => {
    try { await api.logout(); } catch { }
    logout();
  };

  const reload = async () => setSolicitudes(await api.getSolicitudesCentro());
  useEffect(() => { reload(); }, []);

  const flash = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000); };
  const f = (campo, valor) => setForm(p => ({ ...p, [campo]: valor }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.descripcion.trim()) return flash("La descripción es obligatoria.", false);
    try {
      await api.crearSolicitud(form);
      setShowForm(false);
      setForm(FORM_VACIO(user));
      await reload();
      flash("Solicitud enviada correctamente.");
    } catch (err) { flash(err.message, false); }
  };

  const abrirEditar = (s) => {
    setEditando({
      id: s.id,
      descripcion: s.descripcion || "",
      prioridad: s.prioridad || "Normal",
      ubicacion: s.ubicacion || "",
      lat: s.lat || null, lng: s.lng || null,
      fecha_hora: s.fecha_hora ? s.fecha_hora.slice(0, 16) : nowLocal(),
      items: (s.items || []).map(i => ({ nombre: i.nombre, cantidad: i.cantidad, insumo_id: i.insumo_id || null })),
    });
    setDetalle(null);
  };

  const submitEditar = async (e) => {
    e.preventDefault();
    if (!editando.descripcion.trim()) return flash("La descripción es obligatoria.", false);
    try {
      await api.editarSolicitud(editando.id, editando);
      setEditando(null);
      await reload();
      flash("Solicitud actualizada.");
    } catch (err) { flash(err.message, false); }
  };

  const puedeEditar = (s) => s.estado === "Pendiente" || s.estado === "Rechazada";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Header */}
      <div style={{ background: "var(--navy)", color: "#fff", padding: "1rem 1.5rem", borderBottom: "3px solid var(--gold)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <img src="/logo-facmed.png" alt="Logo" style={{ width: 42, height: 42, borderRadius: "50%", background: "#fff", padding: 2, boxShadow: "0 0 0 2px var(--gold)" }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>Mesa de Contingencia</div>
              <div style={{ fontSize: "0.75rem", color: "var(--gold-light)", opacity: 0.85 }}>Centro: {user.centro_nombre}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button className="btn-secondary" style={{ fontSize: "0.75rem", padding: "4px 10px", height: "fit-content" }}
              onClick={() => { setModalPassword({ id: user.centro_id, centro_nombre: user.centro_nombre, password: "" }); setShowPassword(false); }}>
              🔑 Cambiar Contraseña
            </button>
            <button className="btn-logout" onClick={handleLogout}>Salir</button>
          </div>
        </div>
      </div>

      <div style={{ padding: "1.5rem", maxWidth: 760, margin: "0 auto" }}>
        {msg && <div className={`alert ${msg.ok ? "alert-ok" : "alert-err"}`} style={{ marginBottom: "1rem" }}>{msg.text}</div>}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <h2 style={{ color: "var(--navy)", fontSize: "1.1rem", fontWeight: 700 }}>
            📥 Mis Solicitudes ({solicitudes.length})
          </h2>
          <button className="btn-primary" onClick={() => { setForm(FORM_VACIO()); setShowForm(v => !v); }}>
            {showForm ? "✕ Cancelar" : "+ Nueva Solicitud"}
          </button>
        </div>

        {/* Formulario nueva solicitud */}
        {showForm && (
          <div className="modulo" style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ marginBottom: "1rem", color: "var(--navy)" }}>Nueva Solicitud</h3>
            <form onSubmit={submit} className="form" style={{ maxWidth: "100%" }}>
              <label>Descripción / Situación *
                <textarea required rows={4} value={form.descripcion}
                  onChange={e => f("descripcion", e.target.value)}
                  placeholder="Describe detalladamente la necesidad o situación..." />
              </label>

              <TablaItems items={form.items || []}
                onChange={items => setForm(p => ({ ...p, items }))} />

              <label>Prioridad
                <div className="prioridad-group">
                  {PRIORIDADES.map(p => (
                    <button key={p} type="button"
                      className={`prioridad-btn ${form.prioridad === p ? "prioridad-active" : ""}`}
                      style={form.prioridad === p ? { background: PRIORIDAD_BG[p], color: PRIORIDAD_COLOR[p], borderColor: PRIORIDAD_COLOR[p] } : {}}
                      onClick={() => f("prioridad", p)}>{p}</button>
                  ))}
                </div>
              </label>

              <label>Fecha y hora del evento
                <input type="datetime-local" value={form.fecha_hora}
                  onChange={e => f("fecha_hora", e.target.value)} />
              </label>

              {form.ubicacion && (
                <div style={{ fontSize: "0.82rem", color: "#374151", background: "#f0f6ff", border: "1px solid #c3d9ff", borderRadius: 8, padding: "0.5rem 0.75rem" }}>
                  📍 <strong>Ubicación:</strong> {form.ubicacion}
                </div>
              )}

              <button type="submit" className="btn-primary">Enviar Solicitud</button>
            </form>
          </div>
        )}

        {/* Lista */}
        {solicitudes.length === 0 && !showForm
          ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📋</div>
              <p>Aún no has enviado solicitudes.</p>
              <p style={{ fontSize: "0.85rem" }}>Usa el botón "Nueva Solicitud" para comenzar.</p>
            </div>
          )
          : (
            <div className="card-list">
              {solicitudes.map(s => (
                <div key={s.id} className="card sol-card"
                  style={{ cursor: "pointer", borderLeft: `4px solid ${ESTADO_COLOR[s.estado] || "#9ca3af"}` }}
                  onClick={() => setDetalle(s)}>
                  <div className="card-body">
                    <div className="sol-card-top">
                      <span className="prioridad-tag"
                        style={{ background: PRIORIDAD_BG[s.prioridad], color: PRIORIDAD_COLOR[s.prioridad] }}>
                        {s.prioridad}
                      </span>
                      <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: "0.75rem", fontWeight: 700, background: ESTADO_BG[s.estado], color: ESTADO_COLOR[s.estado] }}>
                        {ESTADO_LABEL[s.estado] || s.estado}
                      </span>
                    </div>
                    <p className="card-desc" style={{ marginTop: "0.35rem" }}>{s.descripcion}</p>
                    <div className="sol-meta">
                      {s.items && s.items.length > 0 && (
                        <span>📦 {s.items.length} ítem{s.items.length !== 1 ? "s" : ""}</span>
                      )}
                      {s.ubicacion && <span>📍 {s.ubicacion.slice(0, 60)}{s.ubicacion.length > 60 ? "…" : ""}</span>}
                      {s.fecha_hora && <span>🕐 {new Date(s.fecha_hora).toLocaleString("es-VE")}</span>}
                      <span className="date">Creada: {new Date(s.fecha_creacion).toLocaleDateString("es-VE")}</span>
                      {s.fecha_actualizacion && (
                        <span className="date" style={{ color: "#d97706" }}>✏️ {new Date(s.fecha_actualizacion).toLocaleString("es-VE")}</span>
                      )}
                    </div>
                    {s.estado === "Rechazada" && s.rechazo_motivo && (
                      <p style={{ fontSize: "0.8rem", color: "#dc2626", marginTop: "0.4rem" }}>❌ Motivo: {s.rechazo_motivo}</p>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "flex-end" }}
                    onClick={e => e.stopPropagation()}>
                    {puedeEditar(s) && (
                      <button className="btn-edit-grupo" title="Editar" onClick={() => abrirEditar(s)}>✏️</button>
                    )}
                  </div>
                </div>
              ))}
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
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#9ca3af", letterSpacing: 1, marginBottom: "0.4rem" }}>ESTADO</div>
                <span style={{ padding: "4px 14px", borderRadius: 12, fontSize: "0.85rem", fontWeight: 700, background: ESTADO_BG[detalle.estado], color: ESTADO_COLOR[detalle.estado] }}>
                  {ESTADO_LABEL[detalle.estado] || detalle.estado}
                </span>
              </div>
              {detalle.estado === "Rechazada" && (
                <DetalleRow label="Motivo de rechazo" value={detalle.rechazo_motivo} />
              )}
              <DetalleRow label="Descripción" value={detalle.descripcion} />
              <DetalleRow label="Ubicación" value={detalle.ubicacion} />
              <DetalleRow label="Fecha / Hora" value={detalle.fecha_hora ? new Date(detalle.fecha_hora).toLocaleString("es-VE") : null} />
              <DetalleRow label="Registrada" value={new Date(detalle.fecha_creacion).toLocaleString("es-VE")} />
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
                <div style={{ marginTop: "0.75rem" }}>
                  <iframe title="mapa"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${detalle.lng - 0.005},${detalle.lat - 0.005},${detalle.lng + 0.005},${detalle.lat + 0.005}&layer=mapnik&marker=${detalle.lat},${detalle.lng}`}
                    width="100%" height="180"
                    style={{ border: "1px solid #e5e7eb", borderRadius: 8, display: "block" }}
                  />
                </div>
              )}
              {puedeEditar(detalle) && (
                <div style={{ marginTop: "1rem" }}>
                  <button className="btn-secondary" onClick={() => abrirEditar(detalle)}>✏️ Editar solicitud</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal editar */}
        {editando && (
          <div className="overlay" onClick={() => setEditando(null)}>
            <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
              <h3>✏️ Editar Solicitud</h3>
              <form onSubmit={submitEditar} className="form" style={{ marginTop: "0.75rem" }}>
                <label>Descripción / Situación *
                  <textarea required rows={4} value={editando.descripcion}
                    onChange={e => setEditando(p => ({ ...p, descripcion: e.target.value }))}
                    placeholder="Describe detalladamente la necesidad..." />
                </label>

                <TablaItems items={editando.items || []}
                  onChange={items => setEditando(p => ({ ...p, items }))} />

                <label>Prioridad
                  <div className="prioridad-group">
                    {PRIORIDADES.map(p => (
                      <button key={p} type="button"
                        className={`prioridad-btn ${editando.prioridad === p ? "prioridad-active" : ""}`}
                        style={editando.prioridad === p ? { background: PRIORIDAD_BG[p], color: PRIORIDAD_COLOR[p], borderColor: PRIORIDAD_COLOR[p] } : {}}
                        onClick={() => setEditando(prev => ({ ...prev, prioridad: p }))}>{p}</button>
                    ))}
                  </div>
                </label>

                <label>Fecha y hora del evento
                  <input type="datetime-local" value={editando.fecha_hora}
                    onChange={e => setEditando(p => ({ ...p, fecha_hora: e.target.value }))} />
                </label>

                {editando.ubicacion && (
                  <div style={{ fontSize: "0.82rem", color: "#374151", background: "#f0f6ff", border: "1px solid #c3d9ff", borderRadius: 8, padding: "0.5rem 0.75rem" }}>
                    📍 <strong>Ubicación:</strong> {editando.ubicacion}
                  </div>
                )}

                <div className="modal-actions">
                  <button type="submit" className="btn-primary">Guardar cambios</button>
                  <button type="button" className="btn-ghost" onClick={() => setEditando(null)}>Cancelar</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Modal Cambiar Contraseña */}
        {modalPassword && (
          <div className="overlay" onClick={() => { setModalPassword(null); setShowPassword(false); }}>
            <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
              <h3 style={{ marginBottom: "1rem", color: "var(--navy)" }}>🔑 Cambiar Contraseña</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
                Establecer nueva contraseña para tu cuenta de acceso.
              </p>
              <form onSubmit={handleGuardarPassword} className="form">
                <label>Nueva Contraseña
                  <div className="password-input-container">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      autoFocus
                      value={modalPassword.password}
                      onChange={e => setModalPassword(p => ({ ...p, password: e.target.value }))}
                      placeholder="Mínimo 6 caracteres"
                    />
                    <button
                      type="button"
                      className="toggle-password-btn"
                      onClick={() => setShowPassword(p => !p)}
                      title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-eye-off">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                          <line x1="1" y1="1" x2="23" y2="23"></line>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-eye">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                      )}
                    </button>
                  </div>
                </label>
                <div className="modal-actions" style={{ marginTop: "1.25rem" }}>
                  <button type="submit" className="btn-primary">Guardar</button>
                  <button type="button" className="btn-ghost" onClick={() => { setModalPassword(null); setShowPassword(false); }}>Cancelar</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TablaItems({ items, onChange }) {
  const agregar = () => onChange([...items, { nombre: "", cantidad: 1, insumo_id: null }]);
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
                    <input type="number" min={0} value={item.cantidad}
                      onChange={e => actualizar(i, "cantidad", e.target.value === "" ? "" : parseInt(e.target.value) || 1)}
                      onBlur={e => { if (!e.target.value || parseInt(e.target.value) < 1) actualizar(i, "cantidad", 1); }}
                      onFocus={e => e.target.select()}
                      style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 4, padding: "4px 8px", fontSize: "0.85rem", textAlign: "center" }} />
                  </td>
                  <td style={{ padding: "4px 6px", textAlign: "center" }}>
                    <button type="button" onClick={() => eliminar(i)}
                      style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 4, width: 26, height: 26, cursor: "pointer", fontSize: "0.8rem", lineHeight: 1 }}>✕</button>
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
  const [abierto, setAbierto] = useState(false);
  const [timer, setTimer] = useState(null);
  const ref = useRef(null);

  const buscar = (q) => {
    if (timer) clearTimeout(timer);
    if (!q || q.length < 2) { setSugerencias([]); setAbierto(false); return; }
    setTimer(setTimeout(async () => {
      try {
        const res = await api.buscarInsumos(q);
        setSugerencias(res); setAbierto(res.length > 0);
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
            <li key={ins.id} onMouseDown={() => seleccionar(ins)}
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

function DetalleRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="detalle-row">
      <span className="detalle-label">{label}</span>
      <span className="detalle-value">{value}</span>
    </div>
  );
}

import { useState, useEffect, lazy, Suspense } from "react";
import { api } from "../api/client";
import TelefonoInput from "./TelefonoInput";

const MapaPicker = lazy(() => import("./MapaPicker"));

const CONTACTO_VACIO = { nombre: "", cargo: "", telefono: "", email: "" };
const FORM_VACIO = { nombre: "", descripcion: "", lat: null, lng: null, contactos: [] };

export default function ModuloCentros() {
  const [centros,    setCentros]    = useState([]);
  const [msg,        setMsg]        = useState(null);
  const [modalForm,  setModalForm]  = useState(null);
  const [modalPassword, setModalPassword] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPassMap, setShowPassMap] = useState({});

  const toggleCardPass = (id) => setShowPassMap(p => ({ ...p, [id]: !p[id] }));

  const reload = async () => setCentros(await api.getCentros());
  useEffect(() => { reload(); }, []);

  const flash = (text, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4000);
  };

  const guardar = async (e) => {
    e.preventDefault();
    const { modo, data } = modalForm;
    try {
      if (modo === "nuevo") {
        await api.crearCentro(data);
        flash("Centro creado. Las credenciales aparecen en la tarjeta.");
      } else {
        await api.editarCentro(data.id, data);
        flash("Centro actualizado.");
      }
      setModalForm(null);
      await reload();
    } catch (err) { flash(err.message, false); }
  };

  const eliminar = async (c) => {
    if (!confirm(`¿Eliminar "${c.nombre}"? No se puede deshacer.`)) return;
    try {
      await api.eliminarCentro(c.id);
      await reload();
      flash(`Centro "${c.nombre}" eliminado.`);
    } catch (err) { flash(err.message, false); }
  };

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
      await reload();
      flash("Contraseña actualizada con éxito.");
    } catch (err) { flash(err.message, false); }
  };

  const setField = (key, val) =>
    setModalForm(p => ({ ...p, data: { ...p.data, [key]: val } }));

  const setContacto = (i, key, val) =>
    setModalForm(p => {
      const contactos = [...p.data.contactos];
      contactos[i] = { ...contactos[i], [key]: val };
      return { ...p, data: { ...p.data, contactos } };
    });

  const addContacto = () =>
    setModalForm(p => ({
      ...p, data: { ...p.data, contactos: [...p.data.contactos, { ...CONTACTO_VACIO }] },
    }));

  const removeContacto = (i) =>
    setModalForm(p => ({
      ...p, data: { ...p.data, contactos: p.data.contactos.filter((_, idx) => idx !== i) },
    }));

  const abrirNuevo  = () => setModalForm({ modo: "nuevo",  data: { ...FORM_VACIO, contactos: [] } });
  const abrirEditar = (c) => setModalForm({ modo: "editar", data: { ...c, contactos: c.contactos || [] } });

  return (
    <div className="modulo">
      <h2>🏥 Centros de Atención</h2>
      {msg && <div className={`alert ${msg.ok ? "alert-ok" : "alert-err"}`}>{msg.text}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
        <button className="btn-primary" onClick={abrirNuevo}>+ Nuevo Centro</button>
      </div>

      {centros.length === 0
        ? <p className="empty">No hay centros registrados.</p>
        : (
          <div className="grupo-cards">
            {centros.map(c => (
              <div key={c.id} className="grupo-card">
                <div className="grupo-card-header">
                  <span className="grupo-nombre">🏥 {c.nombre}</span>
                  <div className="grupo-card-actions">
                    <button className="btn-edit-grupo" onClick={() => abrirEditar(c)} title="Editar">✏️</button>
                    <button className="btn-edit-grupo" style={{ background: "#dc2626" }} onClick={() => eliminar(c)} title="Eliminar">🗑️</button>
                  </div>
                </div>

                {c.descripcion && <p className="grupo-desc">{c.descripcion}</p>}

                {c.contactos?.length > 0 && (
                  <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    {c.contactos.map(ct => (
                      <div key={ct.id} style={{ fontSize: "0.8rem", color: "var(--navy)" }}>
                        <strong>{ct.nombre}</strong>
                        {ct.cargo    && <span style={{ color: "var(--text-muted)", marginLeft: "0.4rem" }}>— {ct.cargo}</span>}
                        {ct.telefono && <span style={{ marginLeft: "0.5rem" }}>📞 {ct.telefono}</span>}
                        {ct.email    && <span style={{ marginLeft: "0.5rem" }}>✉️ {ct.email}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {c.usuario && (
                  <div style={{
                    marginTop: "0.75rem", background: "#f0f6ff",
                    border: "1px solid #c3d9ff", borderRadius: 8, padding: "0.6rem 0.75rem",
                  }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.3rem", fontWeight: 600 }}>
                      CREDENCIALES DE ACCESO
                    </div>
                    <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
                      <div>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Usuario</span>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--navy)" }}>{c.usuario.username}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Contraseña</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--navy)", fontFamily: "monospace" }}>
                            {showPassMap[c.id] ? (c.usuario.password_plain || "—") : "••••••••••"}
                          </div>
                          <button
                            type="button"
                            className="toggle-password-btn"
                            style={{ position: "static", padding: 2 }}
                            onClick={() => toggleCardPass(c.id)}
                            title={showPassMap[c.id] ? "Ocultar contraseña" : "Mostrar contraseña"}
                          >
                            {showPassMap[c.id] ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                <line x1="1" y1="1" x2="23" y2="23"></line>
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                      <button className="btn-secondary" style={{ marginLeft: "auto", padding: "3px 10px", fontSize: "0.72rem" }}
                        onClick={() => { setModalPassword({ id: c.id, centro_nombre: c.nombre, password: "" }); setShowPassword(false); }}>
                        🔑 Cambiar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      }

      {/* ── Modal Cambiar Contraseña ── */}
      {modalPassword && (
        <div className="overlay" onClick={() => { setModalPassword(null); setShowPassword(false); }}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: "1rem", color: "var(--navy)" }}>🔑 Cambiar Contraseña</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
              Establecer nueva contraseña para el centro: <strong>{modalPassword.centro_nombre}</strong>
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

      {/* ── Modal crear / editar ── */}
      {modalForm && (
        <div className="overlay" onClick={() => setModalForm(null)}>
          <div className="modal" style={{ maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}
               onClick={e => e.stopPropagation()}>
            <h3>{modalForm.modo === "nuevo" ? "Nuevo Centro de Atención" : "Editar Centro"}</h3>
            <form onSubmit={guardar} className="form" style={{ marginTop: "0.75rem" }}>

              <label>Nombre *
                <input required autoFocus value={modalForm.data.nombre}
                  onChange={e => setField("nombre", e.target.value)}
                  placeholder="Ej. Hospital Clínico Universitario" />
              </label>
              <label>Descripción
                <input value={modalForm.data.descripcion || ""}
                  onChange={e => setField("descripcion", e.target.value)}
                  placeholder="Opcional" />
              </label>

              <div style={{ marginBottom: "0.75rem" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>Ubicación del centro</div>
                <Suspense fallback={<div style={{ height: 220, background: "#f0f0f0", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#999" }}>Cargando mapa…</div>}>
                  <MapaPicker
                    value={{ lat: modalForm.data.lat, lng: modalForm.data.lng, address: modalForm.data.direccion || "" }}
                    onChange={({ lat, lng, address }) => setModalForm(p => ({ ...p, data: { ...p.data, lat, lng, direccion: address } }))}
                  />
                </Suspense>
              </div>

              <div style={{ marginBottom: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Contactos</span>
                  <button type="button" className="btn-secondary" style={{ fontSize: "0.78rem", padding: "3px 10px" }}
                    onClick={addContacto}>+ Agregar</button>
                </div>
                {modalForm.data.contactos.length === 0
                  ? <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Sin contactos aún.</p>
                  : modalForm.data.contactos.map((ct, i) => (
                    <div key={i} style={{ background: "#f8f9fa", borderRadius: 8, padding: "0.6rem 0.75rem", marginBottom: "0.5rem", border: "1px solid #e5e7eb" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--navy)" }}>Contacto {i + 1}</span>
                        <button type="button" onClick={() => removeContacto(i)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: "1rem" }}>✕</button>
                      </div>
                      <div className="form-row">
                        <label style={{ flex: 2 }}>Nombre *
                          <input required value={ct.nombre}
                            onChange={e => setContacto(i, "nombre", e.target.value)} placeholder="María González" />
                        </label>
                        <label style={{ flex: 1 }}>Cargo
                          <input value={ct.cargo || ""}
                            onChange={e => setContacto(i, "cargo", e.target.value)} placeholder="Directora" />
                        </label>
                      </div>
                      <div className="form-row">
                        <label style={{ flex: 1 }}>Teléfono
                          <TelefonoInput value={ct.telefono || ""}
                            onChange={val => setContacto(i, "telefono", val || "")} />
                        </label>
                        <label style={{ flex: 1 }}>Email
                          <input value={ct.email || ""}
                            onChange={e => setContacto(i, "email", e.target.value)} placeholder="maria@ucv.ve" />
                        </label>
                      </div>
                    </div>
                  ))
                }
              </div>

              {modalForm.modo === "nuevo" && (
                <div style={{ fontSize: "0.8rem", color: "var(--navy)", background: "#f0f6ff", border: "1px solid #c3d9ff", borderRadius: 8, padding: "0.6rem 0.75rem" }}>
                  🔑 El usuario y contraseña se generarán automáticamente y quedarán visibles en la tarjeta del centro.
                </div>
              )}

              <div className="modal-actions" style={{ marginTop: "1rem" }}>
                <button type="submit" className="btn-primary">
                  {modalForm.modo === "nuevo" ? "Crear Centro" : "Guardar cambios"}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setModalForm(null)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

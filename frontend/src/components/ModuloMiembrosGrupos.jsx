import { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { validarFormMiembro, normalizarCedula } from "../utils/validaciones";

const CARGOS = ["Profesor", "Estudiante", "BR", "Auxiliar", "Voluntario"];
const FORM_VACIO = { nombre: "", cedula: "", telefono: "", tlf_alternativo: "", cargo: "", email: "", grupo_ids: [] };

export default function ModuloMiembrosGrupos({ onDataChange }) {
  const { user } = useAuth();
  const isAdmin = user.rol === "admin";

  const [miembros, setMiembros] = useState([]);
  const [grupos,   setGrupos]   = useState([]);
  const [tab, setTab] = useState(user.rol === "admin" ? "miembros" : "registrar");
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [errores, setErrores] = useState({});
  const [tocado, setTocado] = useState({});
  const [editandoGrupo,   setEditandoGrupo]   = useState(null);
  const [usuarioGrupo,    setUsuarioGrupo]    = useState(null);
  const [nuevoUser,       setNuevoUser]       = useState({ username: "", password: "", password2: "" });
  const [nuevaPass,       setNuevaPass]       = useState("");
  const [nuevoGrupo,      setNuevoGrupo]      = useState(null);
  const [editandoMiembro, setEditandoMiembro] = useState(null); // miembro en edición

  const reload = async () => {
    const [m, g] = await Promise.all([api.getMiembros(), api.getGrupos()]);
    setMiembros(m);
    setGrupos(g);
  };
  useEffect(() => { reload(); }, []);

  const flash = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 3500); };

  const cambiarCampo = (campo, valor) => {
    const nuevo = { ...form, [campo]: valor };
    setForm(nuevo);
    if (tocado[campo]) setErrores(validarFormMiembro(nuevo));
  };
  const marcarTocado = (campo) => {
    const t = { ...tocado, [campo]: true };
    setTocado(t);
    setErrores(validarFormMiembro(form));
  };

  const submitMiembro = async (e) => {
    e.preventDefault();
    const errs = validarFormMiembro(form);
    if (Object.keys(errs).length > 0) {
      setErrores(errs);
      setTocado({ nombre: true, cedula: true, telefono: true, tlf_alternativo: true, email: true, cargo: true });
      return;
    }
    if (isAdmin && (!form.grupo_ids || form.grupo_ids.length === 0)) {
      setTocado(p => ({ ...p, grupo_ids: true }));
      flash("Selecciona al menos un grupo.", false); return;
    }
    try {
      await api.crearMiembro(form);
      setForm(FORM_VACIO); setErrores({}); setTocado({});
      await reload(); onDataChange();
      flash(`Miembro registrado${!isAdmin ? " y asignado a tu grupo" : ""}.`);
    } catch (err) { flash(err.message, false); }
  };

  // ── Edición de grupo (solo admin) ──
  const abrirEdicion = async (g) => {
    setEditandoGrupo({
      id: g.id, nombre: g.nombre, descripcion: g.descripcion || "",
      representante_principal_id: g.representante ? String(g.representante.id) : "",
    });
    setNuevoUser({ username: "", password: "", password2: "" });
    setNuevaPass("");
    setTab("editarGrupo");
    try {
      const u = await api.getUsuarioGrupo(g.id);
      setUsuarioGrupo(u);
    } catch { setUsuarioGrupo(null); }
  };

  const submitEdicion = async (e) => {
    e.preventDefault();
    try {
      await api.editarGrupo(editandoGrupo.id, {
        nombre: editandoGrupo.nombre,
        descripcion: editandoGrupo.descripcion,
        representante_principal_id: editandoGrupo.representante_principal_id
          ? Number(editandoGrupo.representante_principal_id) : null,
      });
      await reload(); onDataChange();
      flash("Grupo actualizado."); setTab("grupos");
    } catch (err) { flash(err.message, false); }
  };

  const crearUsuario = async (e) => {
    e.preventDefault();
    if (nuevoUser.password !== nuevoUser.password2) { flash("Las contraseñas no coinciden.", false); return; }
    try {
      const u = await api.crearUsuarioGrupo(editandoGrupo.id, { username: nuevoUser.username, password: nuevoUser.password });
      setUsuarioGrupo(u);
      setNuevoUser({ username: "", password: "", password2: "" });
      flash("Usuario de acceso creado.");
    } catch (err) { flash(err.message, false); }
  };

  const cambiarPassword = async (e) => {
    e.preventDefault();
    try {
      await api.cambiarPasswordGrupo(editandoGrupo.id, { password: nuevaPass });
      setNuevaPass("");
      flash("Contraseña actualizada.");
    } catch (err) { flash(err.message, false); }
  };

  const submitNuevoGrupo = async (e) => {
    e.preventDefault();
    try {
      await api.crearGrupo(nuevoGrupo);
      setNuevoGrupo(null);
      await reload(); onDataChange();
      flash("Grupo creado.");
    } catch (err) { flash(err.message, false); }
  };

  const eliminarGrupo = async (g) => {
    if (!confirm(`¿Eliminar el grupo "${g.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.eliminarGrupo(g.id);
      await reload(); onDataChange();
      flash(`Grupo "${g.nombre}" eliminado.`);
    } catch (err) { flash(err.message, false); }
  };

  // ── Editar / Eliminar miembro ──
  const abrirEditarMiembro = (m) => {
    const grupo_ids = miembros
      .filter(x => x.id === m.id && x.grupo)
      .map(x => x.grupo.id);
    setEditandoMiembro({ ...m, grupo_ids: grupo_ids.length ? grupo_ids : (m.grupo ? [m.grupo.id] : []) });
  };

  const submitEditarMiembro = async (e) => {
    e.preventDefault();
    const errs = validarFormMiembro(editandoMiembro);
    if (Object.keys(errs).length > 0) { flash("Corrige los errores del formulario.", false); return; }
    try {
      await api.editarMiembro(editandoMiembro.id, editandoMiembro);
      setEditandoMiembro(null);
      await reload(); onDataChange();
      flash("Miembro actualizado.");
    } catch (err) { flash(err.message, false); }
  };

  const eliminarMiembro = async (m) => {
    if (!confirm(`¿Eliminar a "${m.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.eliminarMiembro(m.id);
      await reload(); onDataChange();
      flash(`Miembro "${m.nombre}" eliminado.`);
    } catch (err) { flash(err.message, false); }
  };

  // ── Tabs según rol ──
  const tabsDisponibles = isAdmin
    ? [
        { id: "miembros",  label: "👤 Miembros" },
        { id: "registrar", label: "+ Agregar Miembro" },
        { id: "grupos",    label: "🏷️ Grupos" },
      ]
    : [
        { id: "registrar", label: "+ Registrar Miembro" },
        { id: "miembros",  label: "👤 Mi Grupo" },
      ];

  return (
    <div className="modulo">
      <h2>{isAdmin ? "👥 Gestión de Miembros y Grupos" : `👤 Mi Grupo — ${user.grupo_nombre}`}</h2>
      {msg && <div className={`alert ${msg.ok ? "alert-ok" : "alert-err"}`}>{msg.text}</div>}

      <div className="tabs">
        {tabsDisponibles.map(t => (
          <button key={t.id} className={tab === t.id ? "tab active" : "tab"} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
        {tab === "editarGrupo" && <button className="tab active">✏️ Editando Grupo</button>}
      </div>

      {/* ── Formulario registro ── */}
      {tab === "registrar" && (
        <form onSubmit={submitMiembro} className="form">
          {!isAdmin && (
            <div className="info-banner">
              Este miembro será asignado automáticamente a <strong>{user.grupo_nombre}</strong>.
            </div>
          )}
          <div className="form-row">
            <Campo label="Nombre completo *" error={tocado.nombre && errores.nombre}>
              <input value={form.nombre} placeholder="Ej. María González"
                onChange={e => cambiarCampo("nombre", e.target.value)} onBlur={() => marcarTocado("nombre")}
                className={tocado.nombre && errores.nombre ? "input-err" : ""} />
            </Campo>
            <Campo label="N° de Cédula" error={tocado.cedula && errores.cedula}>
              <input value={form.cedula} placeholder="V-12345678"
                onChange={e => cambiarCampo("cedula", e.target.value)}
                onBlur={() => { cambiarCampo("cedula", normalizarCedula(form.cedula)); marcarTocado("cedula"); }}
                className={tocado.cedula && errores.cedula ? "input-err" : ""} />
            </Campo>
          </div>
          <div className="form-row">
            <Campo label="Teléfono principal *" error={tocado.telefono && errores.telefono} hint="0412-1234567">
              <input value={form.telefono} placeholder="0412-1234567"
                onChange={e => cambiarCampo("telefono", e.target.value)} onBlur={() => marcarTocado("telefono")}
                className={tocado.telefono && errores.telefono ? "input-err" : ""} />
            </Campo>
            <Campo label="Teléfono alternativo" error={tocado.tlf_alternativo && errores.tlf_alternativo} hint="0212-5554321 (opcional)">
              <input value={form.tlf_alternativo} placeholder="0212-5554321"
                onChange={e => cambiarCampo("tlf_alternativo", e.target.value)} onBlur={() => marcarTocado("tlf_alternativo")}
                className={tocado.tlf_alternativo && errores.tlf_alternativo ? "input-err" : ""} />
            </Campo>
          </div>
          <div className="form-row">
            <Campo label="Cargo *" error={tocado.cargo && errores.cargo}>
              <select value={form.cargo} onBlur={() => marcarTocado("cargo")}
                onChange={e => cambiarCampo("cargo", e.target.value)}
                className={tocado.cargo && errores.cargo ? "input-err" : ""}>
                <option value="">— Seleccionar —</option>
                {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Campo>
            <Campo label="Correo electrónico *" error={tocado.email && errores.email}>
              <input type="text" value={form.email} placeholder="correo@ejemplo.com"
                onChange={e => cambiarCampo("email", e.target.value)} onBlur={() => marcarTocado("email")}
                className={tocado.email && errores.email ? "input-err" : ""} />
            </Campo>
          </div>
          {isAdmin && (
            <Campo label="Grupos de Trabajo *">
              {/* Pills de grupos seleccionados */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.5rem", minHeight: "1.5rem" }}>
                {(form.grupo_ids || []).map(id => {
                  const g = grupos.find(x => x.id === id);
                  if (!g) return null;
                  return (
                    <span key={id} style={{
                      display: "inline-flex", alignItems: "center", gap: "0.3rem",
                      background: "var(--navy)", color: "#fff",
                      borderRadius: 20, padding: "3px 10px", fontSize: "0.8rem", fontWeight: 600,
                    }}>
                      {g.nombre}
                      <button type="button" onClick={() =>
                        setForm(p => ({ ...p, grupo_ids: p.grupo_ids.filter(x => x !== id) }))
                      } style={{
                        background: "none", border: "none", color: "#fff", cursor: "pointer",
                        fontSize: "0.85rem", lineHeight: 1, padding: 0, opacity: 0.8,
                      }}>✕</button>
                    </span>
                  );
                })}
                {(form.grupo_ids || []).length === 0 && (
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Sin grupos seleccionados</span>
                )}
              </div>
              {/* Dropdown para agregar */}
              <select
                value=""
                onChange={e => {
                  const id = parseInt(e.target.value);
                  if (!id) return;
                  if (!(form.grupo_ids || []).includes(id))
                    setForm(p => ({ ...p, grupo_ids: [...(p.grupo_ids || []), id] }));
                }}
                style={{ width: "100%" }}
              >
                <option value="">+ Agregar grupo…</option>
                {grupos
                  .filter(g => !(form.grupo_ids || []).includes(g.id))
                  .map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)
                }
              </select>
              {(form.grupo_ids || []).length === 0 && tocado.grupo_ids && (
                <span className="campo-error">Selecciona al menos un grupo.</span>
              )}
            </Campo>
          )}
          <button type="submit" className="btn-primary">Registrar Miembro</button>
        </form>
      )}

      {/* ── Lista miembros ── */}
      {(tab === "miembros") && (
        <div className="ver-registros">
          <h3>({miembros.length} miembro{miembros.length !== 1 ? "s" : ""})</h3>
          {miembros.length === 0
            ? <p className="empty">No hay miembros registrados.</p>
            : (
              <div className="table-wrap">
                <table className="reg-table">
                  <thead><tr><th>#</th><th>Nombre</th><th>Cédula</th><th>Cargo</th><th>Teléfono</th><th>Tlf. Alt.</th><th>Email</th><th></th></tr></thead>
                  <tbody>
                    {miembros.map(m => (
                      <tr key={m.id}>
                        <td className="td-id">{m.id}</td>
                        <td><strong>{m.nombre}</strong></td>
                        <td>{m.cedula || <span className="td-empty">—</span>}</td>
                        <td>{m.cargo ? <span className="cargo-chip">{m.cargo}</span> : <span className="td-empty">—</span>}</td>
                        <td>{m.telefono || <span className="td-empty">—</span>}</td>
                        <td>{m.tlf_alternativo || <span className="td-empty">—</span>}</td>
                        <td>{m.email || <span className="td-empty">—</span>}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="btn-edit-grupo" style={{ marginRight: 4 }}
                            onClick={() => abrirEditarMiembro(m)} title="Editar">✏️</button>
                          <button className="btn-edit-grupo" style={{ background: "#dc2626" }}
                            onClick={() => eliminarMiembro(m)} title="Eliminar">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}

      {/* ── Lista grupos (solo admin) ── */}
      {tab === "grupos" && isAdmin && (
        <div className="ver-registros">
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
            <button className="btn-primary" onClick={() => setNuevoGrupo({ nombre: "", descripcion: "" })}>
              + Nuevo Grupo
            </button>
          </div>

          {/* Modal crear grupo */}
          {nuevoGrupo && (
            <div className="overlay" onClick={() => setNuevoGrupo(null)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <h3>Nuevo Grupo de Trabajo</h3>
                <form onSubmit={submitNuevoGrupo} className="form" style={{ marginTop: "0.75rem" }}>
                  <label>Nombre del Grupo *
                    <input required autoFocus value={nuevoGrupo.nombre}
                      onChange={e => setNuevoGrupo(p => ({ ...p, nombre: e.target.value }))}
                      placeholder="Ej. Grupo Logística" />
                  </label>
                  <label>Descripción
                    <input value={nuevoGrupo.descripcion}
                      onChange={e => setNuevoGrupo(p => ({ ...p, descripcion: e.target.value }))}
                      placeholder="Opcional" />
                  </label>
                  <div className="modal-actions">
                    <button type="submit" className="btn-primary">Crear Grupo</button>
                    <button type="button" className="btn-ghost" onClick={() => setNuevoGrupo(null)}>Cancelar</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="grupo-cards">
            {grupos.map(g => (
              <div key={g.id} className="grupo-card">
                <div className="grupo-card-header">
                  <span className="grupo-nombre">{g.nombre}</span>
                  <div className="grupo-card-actions">
                    <span className="grupo-badge">{g.miembros.length} miembro{g.miembros.length !== 1 ? "s" : ""}</span>
                    <button className="btn-edit-grupo" onClick={() => abrirEdicion(g)} title="Editar">✏️</button>
                    <button className="btn-edit-grupo" style={{ background: "#dc2626" }} onClick={() => eliminarGrupo(g)} title="Eliminar">🗑️</button>
                  </div>
                </div>
                {g.descripcion && <p className="grupo-desc">{g.descripcion}</p>}
                {g.representante && (
                  <div className="grupo-rep">
                    <span className="rep-label">Representante:</span>
                    <span className="rep-nombre">⭐ {g.representante.nombre}</span>
                  </div>
                )}
                {g.miembros.length > 0 && (
                  <div className="grupo-miembros">
                    {g.miembros.map(m => <span key={m.id} className="miembro-chip">{m.nombre}{m.cargo ? ` · ${m.cargo}` : ""}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Editar grupo (solo admin) ── */}
      {tab === "editarGrupo" && isAdmin && editandoGrupo && (
        <div>
          {/* Info del grupo */}
          <form onSubmit={submitEdicion} className="form" style={{ marginBottom: "1.5rem" }}>
            <div className="form-row">
              <label>Nombre del Grupo *
                <input required value={editandoGrupo.nombre}
                  onChange={e => setEditandoGrupo(p => ({ ...p, nombre: e.target.value }))} />
              </label>
              <label>Descripción
                <input value={editandoGrupo.descripcion}
                  onChange={e => setEditandoGrupo(p => ({ ...p, descripcion: e.target.value }))} />
              </label>
            </div>
            <label>Representante Principal
              <select value={editandoGrupo.representante_principal_id}
                onChange={e => setEditandoGrupo(p => ({ ...p, representante_principal_id: e.target.value }))}>
                <option value="">— Ninguno —</option>
                {miembros.filter(m => m.grupo?.id === editandoGrupo.id).map(m => (
                  <option key={m.id} value={m.id}>{m.nombre}{m.cargo ? ` (${m.cargo})` : ""}</option>
                ))}
              </select>
            </label>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button type="submit" className="btn-primary">Guardar Cambios</button>
              <button type="button" className="btn-ghost" onClick={() => setTab("grupos")}>Cancelar</button>
            </div>
          </form>

          {/* Usuario de acceso */}
          <div className="form" style={{ borderTop: "2px solid #e5e7eb", paddingTop: "1.25rem" }}>
            <h3 style={{ marginBottom: "1rem" }}>🔑 Usuario de Acceso del Grupo</h3>
            {usuarioGrupo ? (
              <>
                <div className="info-banner" style={{ marginBottom: "1rem" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>Usuario de acceso</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--navy)", letterSpacing: "0.02em" }}>
                      {usuarioGrupo.username}
                    </span>
                    <span style={{ fontSize: "0.8rem", fontWeight: 600, color: usuarioGrupo.activo ? "#16a34a" : "#dc2626" }}>
                      {usuarioGrupo.activo ? "● Activo" : "● Inactivo"}
                    </span>
                  </div>
                </div>
                <form onSubmit={cambiarPassword}>
                  <label style={{ display:"flex", flexDirection:"column", gap:4, fontSize:"0.85rem", fontWeight:600, marginBottom:"0.75rem" }}>
                    Nueva contraseña (mín. 6 caracteres)
                    <input type="password" value={nuevaPass} minLength={6} required
                      placeholder="Nueva contraseña"
                      onChange={e => setNuevaPass(e.target.value)} />
                  </label>
                  <button type="submit" className="btn-secondary">Cambiar contraseña</button>
                </form>
              </>
            ) : (
              <>
                <p className="empty" style={{ marginBottom: "0.75rem" }}>Este grupo aún no tiene usuario de acceso.</p>
                <form onSubmit={crearUsuario}>
                  <div className="form-row">
                    <label style={{ display:"flex", flexDirection:"column", gap:4, fontSize:"0.85rem", fontWeight:600 }}>
                      Nombre de usuario *
                      <input required value={nuevoUser.username} placeholder="ej. grupo_acopio"
                        onChange={e => setNuevoUser(p => ({ ...p, username: e.target.value }))} />
                    </label>
                    <label style={{ display:"flex", flexDirection:"column", gap:4, fontSize:"0.85rem", fontWeight:600 }}>
                      Contraseña * (mín. 6 caracteres)
                      <input type="password" required minLength={6} value={nuevoUser.password} placeholder="Contraseña"
                        onChange={e => setNuevoUser(p => ({ ...p, password: e.target.value }))} />
                    </label>
                  </div>
                  <label style={{ display:"flex", flexDirection:"column", gap:4, fontSize:"0.85rem", fontWeight:600, marginBottom:"0.75rem" }}>
                    Confirmar contraseña *
                    <input type="password" required value={nuevoUser.password2} placeholder="Repetir contraseña"
                      onChange={e => setNuevoUser(p => ({ ...p, password2: e.target.value }))} />
                  </label>
                  <button type="submit" className="btn-primary">Crear Usuario de Acceso</button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
      {/* ── Modal editar miembro ── */}
      {editandoMiembro && (
        <div className="overlay" onClick={() => setEditandoMiembro(null)}>
          <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <h3>✏️ Editar Miembro</h3>
            <form onSubmit={submitEditarMiembro} className="form" style={{ marginTop: "0.75rem" }}>
              <div className="form-row">
                <Campo label="Nombre completo *">
                  <input required value={editandoMiembro.nombre}
                    onChange={e => setEditandoMiembro(p => ({ ...p, nombre: e.target.value }))} />
                </Campo>
                <Campo label="N° de Cédula">
                  <input value={editandoMiembro.cedula || ""}
                    onChange={e => setEditandoMiembro(p => ({ ...p, cedula: e.target.value }))}
                    onBlur={() => setEditandoMiembro(p => ({ ...p, cedula: normalizarCedula(p.cedula) }))}
                    placeholder="V-12345678" />
                </Campo>
              </div>
              <div className="form-row">
                <Campo label="Teléfono principal *">
                  <input required value={editandoMiembro.telefono || ""}
                    onChange={e => setEditandoMiembro(p => ({ ...p, telefono: e.target.value }))}
                    placeholder="0412-1234567" />
                </Campo>
                <Campo label="Teléfono alternativo">
                  <input value={editandoMiembro.tlf_alternativo || ""}
                    onChange={e => setEditandoMiembro(p => ({ ...p, tlf_alternativo: e.target.value }))}
                    placeholder="Opcional" />
                </Campo>
              </div>
              <div className="form-row">
                <Campo label="Correo electrónico *">
                  <input required type="email" value={editandoMiembro.email || ""}
                    onChange={e => setEditandoMiembro(p => ({ ...p, email: e.target.value }))} />
                </Campo>
                <Campo label="Cargo *">
                  <select required value={editandoMiembro.cargo || ""}
                    onChange={e => setEditandoMiembro(p => ({ ...p, cargo: e.target.value }))}>
                    <option value="">Seleccionar…</option>
                    {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Campo>
              </div>
              {isAdmin && (
                <Campo label="Grupos de Trabajo *">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.5rem", minHeight: "1.5rem" }}>
                    {(editandoMiembro.grupo_ids || []).map(id => {
                      const g = grupos.find(x => x.id === id);
                      if (!g) return null;
                      return (
                        <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", background: "var(--navy)", color: "#fff", borderRadius: 20, padding: "3px 10px", fontSize: "0.8rem", fontWeight: 600 }}>
                          {g.nombre}
                          <button type="button" onClick={() => setEditandoMiembro(p => ({ ...p, grupo_ids: p.grupo_ids.filter(x => x !== id) }))}
                            style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: "0.85rem", lineHeight: 1, padding: 0, opacity: 0.8 }}>✕</button>
                        </span>
                      );
                    })}
                    {!(editandoMiembro.grupo_ids || []).length && <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Sin grupos</span>}
                  </div>
                  <select value="" onChange={e => {
                    const id = parseInt(e.target.value);
                    if (!id) return;
                    if (!(editandoMiembro.grupo_ids || []).includes(id))
                      setEditandoMiembro(p => ({ ...p, grupo_ids: [...(p.grupo_ids || []), id] }));
                  }} style={{ width: "100%" }}>
                    <option value="">+ Agregar grupo…</option>
                    {grupos.filter(g => !(editandoMiembro.grupo_ids || []).includes(g.id)).map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                  </select>
                </Campo>
              )}
              <div className="modal-actions">
                <button type="submit" className="btn-primary">Guardar cambios</button>
                <button type="button" className="btn-ghost" onClick={() => setEditandoMiembro(null)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Campo({ label, error, hint, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.85rem", fontWeight: 600, color: "#374151" }}>
      {label}
      {children}
      {hint && !error && <span className="campo-hint">{hint}</span>}
      {error && <span className="campo-error">{error}</span>}
    </label>
  );
}

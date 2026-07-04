import { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { validarFormMiembro, normalizarCedula } from "../utils/validaciones";
import TelefonoInput from "./TelefonoInput";

const CARGOS = ["Profesor", "Estudiante", "BR", "Auxiliar", "Voluntario"];
const FORM_VACIO = { nombre: "", cedula: "", telefono: "", tlf_alternativo: "", cargo: "", email: "", grupo_ids: [] };

function slugify(nombre) {
  let s = (nombre || "").toLowerCase().trim();
  s = s.replace(/[áàä]/g,"a").replace(/[éèë]/g,"e").replace(/[íìï]/g,"i").replace(/[óòö]/g,"o").replace(/[úùü]/g,"u");
  s = s.replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,25);
  return s ? `grupo_${s}` : "grupo";
}
function genPassword(n=10) {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({length:n},()=>c[Math.floor(Math.random()*c.length)]).join("");
}

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
  const [editandoMiembro, setEditandoMiembro] = useState(null);
  const [modalPA, setModalPA] = useState(null); // null | form-obj para Personal Admin

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
    if (isAdmin && (!form.grupo_ids || form.grupo_ids.length === 0) && tab !== "personal_admin") {
      setTocado(p => ({ ...p, grupo_ids: true }));
      flash("Selecciona al menos un grupo.", false); return;
    }
    try {
      await api.crearMiembro(form);
      setForm(FORM_VACIO); setErrores({}); setTocado({});
      await reload(); onDataChange();
      flash(`Miembro registrado${!isAdmin ? " y asignado a tu grupo" : ""}.`);
    } catch (err) { 
      if (err.campos) {
        setErrores(err.campos);
        const keys = Object.keys(err.campos);
        const newTocado = {};
        keys.forEach(k => newTocado[k] = true);
        setTocado(p => ({ ...p, ...newTocado }));
        flash("Por favor corrige los campos marcados en rojo.", false);
      } else {
        flash(err.message, false); 
      }
    }
  };

  // ── Edición de grupo (solo admin) ──
  const abrirEdicion = async (g) => {
    setEditandoGrupo({
      id: g.id, nombre: g.nombre, descripcion: g.descripcion || "",
      representante_principal_id: g.representante ? String(g.representante.id) : "",
      es_coordinador: g.es_coordinador || false,
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
        es_coordinador: editandoGrupo.es_coordinador,
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
      setUsuarioGrupo(p => ({ ...p, password_plain: nuevaPass }));
      setNuevaPass("");
      flash("Contraseña actualizada.");
    } catch (err) { flash(err.message, false); }
  };

  const submitNuevoGrupo = async (e) => {
    e.preventDefault();
    if (!nuevoGrupo.username.trim()) { flash("El usuario no puede estar vacío.", false); return; }
    if ((nuevoGrupo.password || "").length < 6) { flash("La contraseña debe tener al menos 6 caracteres.", false); return; }
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
    const sanitized = {
      ...editandoMiembro,
      nombre: editandoMiembro.nombre || "",
      telefono: editandoMiembro.telefono || "",
      email: editandoMiembro.email || "",
      tlf_alternativo: editandoMiembro.tlf_alternativo || "",
      cargo: editandoMiembro.cargo || "",
    };
    const errs = validarFormMiembro(sanitized);
    if (Object.keys(errs).length > 0) { flash("Corrige los errores del formulario.", false); return; }
    try {
      await api.editarMiembro(editandoMiembro.id, sanitized);
      setEditandoMiembro(null);
      await reload(); onDataChange();
      flash("Miembro actualizado.");
    } catch (err) { 
      if (err.campos) {
        flash(`Error: ${Object.values(err.campos).join(" ")}`, false);
      } else {
        flash(err.message, false); 
      }
    }
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
        { id: "miembros",       label: "👤 Miembros" },
        { id: "personal_admin", label: "👔 Personal Admin" },
        { id: "registrar",      label: "+ Agregar Miembro" },
        { id: "grupos",         label: "🏷️ Grupos" },
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
            <Campo label="Teléfono principal *" error={tocado.telefono && errores.telefono}>
              <TelefonoInput value={form.telefono}
                onChange={val => cambiarCampo("telefono", val || "")} onBlur={() => marcarTocado("telefono")}
                className={tocado.telefono && errores.telefono ? "input-err" : ""} />
            </Campo>
            <Campo label="Teléfono alternativo" error={tocado.tlf_alternativo && errores.tlf_alternativo} hint="Opcional">
              <TelefonoInput value={form.tlf_alternativo}
                onChange={val => cambiarCampo("tlf_alternativo", val || "")} onBlur={() => marcarTocado("tlf_alternativo")}
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
      {(tab === "miembros") && (() => {
        const miembrosUnicos = [...new Map(miembros.map(m => [m.id, m])).values()];
        return (
        <div className="ver-registros">
          <h3>({miembrosUnicos.length} miembro{miembrosUnicos.length !== 1 ? "s" : ""})</h3>
          {miembrosUnicos.length === 0
            ? <p className="empty">No hay miembros registrados.</p>
            : (
              <div className="table-wrap">
                <table className="reg-table">
                  <thead><tr><th>#</th><th>Nombre</th><th>Cédula</th><th>Cargo</th><th>Teléfono</th><th>Tlf. Alt.</th><th>Email</th><th></th></tr></thead>
                  <tbody>
                    {miembrosUnicos.map(m => (
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
        );
      })()}

      {/* ── Personal Administrativo (solo admin) ── */}
      {tab === "personal_admin" && isAdmin && (() => {
        const personalAdmin = [...new Map(miembros.filter(m => !m.grupo).map(m => [m.id, m])).values()];
        const FORM_PA = { nombre: "", cedula: "", telefono: "", tlf_alternativo: "", cargo: "", email: "", grupo_ids: [] };
        return (
          <div className="ver-registros">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>
                Personas del equipo administrativo asignables a tareas.
              </p>
              <button className="btn-primary" onClick={() => setModalPA({ ...FORM_PA })}>
                + Nuevo
              </button>
            </div>

            {personalAdmin.length === 0
              ? <p className="empty">No hay personal administrativo registrado. Agrega el primero.</p>
              : (
                <div className="table-wrap">
                  <table className="reg-table">
                    <thead><tr><th>Nombre</th><th>Cargo</th><th>Teléfono</th><th>Email</th><th></th></tr></thead>
                    <tbody>
                      {personalAdmin.map(m => (
                        <tr key={m.id}>
                          <td><strong>{m.nombre}</strong></td>
                          <td>{m.cargo ? <span className="cargo-chip">{m.cargo}</span> : <span className="td-empty">—</span>}</td>
                          <td>{m.telefono || <span className="td-empty">—</span>}</td>
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
              )
            }

            {/* Modal crear personal admin */}
            {modalPA && (
              <div className="overlay" onClick={() => setModalPA(null)}>
                <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
                  <h3>👔 Nuevo Personal Administrativo</h3>
                  <form className="form" style={{ marginTop: "0.75rem" }} onSubmit={async (e) => {
                    e.preventDefault();
                    const errs = validarFormMiembro(modalPA);
                    if (Object.keys(errs).length > 0) { flash("Corrige los errores.", false); return; }
                    try {
                      await api.crearMiembro({ ...modalPA, grupo_ids: [] });
                      setModalPA(null);
                      await reload(); onDataChange();
                      flash("Personal registrado correctamente.");
                    } catch (err) { 
                      if (err.campos) {
                        flash(`Error: ${Object.values(err.campos).join(" ")}`, false);
                      } else {
                        flash(err.message, false); 
                      }
                    }
                  }}>
                    <div className="form-row">
                      <Campo label="Nombre completo *">
                        <input required value={modalPA.nombre} placeholder="Ej. Juan Pérez"
                          onChange={e => setModalPA(p => ({ ...p, nombre: e.target.value }))} />
                      </Campo>
                      <Campo label="N° de Cédula">
                        <input value={modalPA.cedula || ""} placeholder="V-12345678"
                          onChange={e => setModalPA(p => ({ ...p, cedula: e.target.value }))}
                          onBlur={() => setModalPA(p => ({ ...p, cedula: normalizarCedula(p.cedula) }))} />
                      </Campo>
                    </div>
                    <div className="form-row">
                      <Campo label="Teléfono *">
                        <TelefonoInput required value={modalPA.telefono || ""}
                          onChange={val => setModalPA(p => ({ ...p, telefono: val || "" }))} />
                      </Campo>
                      <Campo label="Teléfono alternativo">
                        <TelefonoInput value={modalPA.tlf_alternativo || ""}
                          onChange={val => setModalPA(p => ({ ...p, tlf_alternativo: val || "" }))} />
                      </Campo>
                    </div>
                    <div className="form-row">
                      <Campo label="Cargo *">
                        <select required value={modalPA.cargo || ""}
                          onChange={e => setModalPA(p => ({ ...p, cargo: e.target.value }))}>
                          <option value="">— Seleccionar —</option>
                          {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </Campo>
                      <Campo label="Correo electrónico *">
                        <input required type="email" value={modalPA.email || ""} placeholder="correo@ucv.ve"
                          onChange={e => setModalPA(p => ({ ...p, email: e.target.value }))} />
                      </Campo>
                    </div>
                    <div className="modal-actions">
                      <button type="submit" className="btn-primary">Registrar</button>
                      <button type="button" className="btn-ghost" onClick={() => setModalPA(null)}>Cancelar</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Lista grupos (solo admin) ── */}
      {tab === "grupos" && isAdmin && (
        <div className="ver-registros">
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
            <button className="btn-primary" onClick={() => setNuevoGrupo({ nombre: "", descripcion: "", username: "", password: genPassword() })}>
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
                      onChange={e => {
                        const nombre = e.target.value;
                        setNuevoGrupo(p => ({ ...p, nombre, username: slugify(nombre) }));
                      }}
                      placeholder="Ej. Grupo Logística" />
                  </label>
                  <label>Descripción
                    <input value={nuevoGrupo.descripcion}
                      onChange={e => setNuevoGrupo(p => ({ ...p, descripcion: e.target.value }))}
                      placeholder="Opcional" />
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
                    <input type="checkbox" checked={nuevoGrupo.es_coordinador || false}
                      onChange={e => setNuevoGrupo(p => ({ ...p, es_coordinador: e.target.checked }))} />
                    <span style={{ fontWeight: "normal" }}>Otorgar permisos de coordinador (gestión global)</span>
                  </label>
                  <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "0.75rem", marginTop: "0.25rem" }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "0.4rem" }}>Credenciales de acceso</div>
                    <label>Usuario
                      <input value={nuevoGrupo.username}
                        onChange={e => setNuevoGrupo(p => ({ ...p, username: e.target.value }))}
                        placeholder="grupo_nombre" style={{ fontFamily: "monospace" }} />
                    </label>
                    <label style={{ marginTop: "0.5rem" }}>Contraseña
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <input value={nuevoGrupo.password}
                          onChange={e => setNuevoGrupo(p => ({ ...p, password: e.target.value }))}
                          style={{ fontFamily: "monospace", flex: 1 }} />
                        <button type="button" className="btn-secondary" style={{ whiteSpace: "nowrap" }}
                          onClick={() => setNuevoGrupo(p => ({ ...p, password: genPassword() }))}>
                          🔄 Generar
                        </button>
                      </div>
                    </label>
                  </div>
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
                  <span className="grupo-nombre">{g.nombre} {g.es_coordinador && <span title="Coordinador" style={{ fontSize: "1rem" }}>📡</span>}</span>
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
                {g.usuario && (
                  <div style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "var(--text-muted)", borderTop: "1px solid #e5e7eb", paddingTop: "0.5rem" }}>
                    <span style={{ marginRight: "0.75rem" }}>🔑 <strong style={{ fontFamily: "monospace", color: "var(--navy)" }}>{g.usuario.username}</strong></span>
                    <span>🔒 <strong style={{ fontFamily: "monospace", color: "#374151", background: "#f3f4f6", padding: "1px 6px", borderRadius: 3 }}>{g.usuario.password_plain || "••••••"}</strong></span>
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
            <div className="form-row">
              <label>Representante Principal
                <select value={editandoGrupo.representante_principal_id}
                  onChange={e => setEditandoGrupo(p => ({ ...p, representante_principal_id: e.target.value }))}>
                  <option value="">— Ninguno —</option>
                  {miembros.filter(m => m.grupo?.id === editandoGrupo.id).map(m => (
                    <option key={m.id} value={m.id}>{m.nombre}{m.cargo ? ` (${m.cargo})` : ""}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", alignSelf: "flex-end", marginBottom: "0.5rem" }}>
                <input type="checkbox" checked={editandoGrupo.es_coordinador || false}
                  onChange={e => setEditandoGrupo(p => ({ ...p, es_coordinador: e.target.checked }))} />
                <span style={{ fontWeight: "normal" }}>Es Coordinador (permisos elevados)</span>
              </label>
            </div>
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
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.4rem" }}>Credenciales de acceso</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", width: 80 }}>Usuario:</span>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "1rem", color: "var(--navy)" }}>
                        {usuarioGrupo.username}
                      </span>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: usuarioGrupo.activo ? "#16a34a" : "#dc2626" }}>
                        {usuarioGrupo.activo ? "● Activo" : "● Inactivo"}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", width: 80 }}>Contraseña:</span>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "1rem", color: "#374151",
                        background: "#f3f4f6", padding: "2px 8px", borderRadius: 4 }}>
                        {usuarioGrupo.password_plain || <em style={{ fontStyle: "italic", opacity: 0.5 }}>no disponible</em>}
                      </span>
                    </div>
                  </div>
                </div>
                <form onSubmit={cambiarPassword} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
                  <label style={{ display:"flex", flexDirection:"column", gap:4, fontSize:"0.85rem", fontWeight:600, flex: 1 }}>
                    Nueva contraseña (mín. 6 caracteres)
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <input type="text" value={nuevaPass} minLength={6} required
                        placeholder="Nueva contraseña" style={{ fontFamily: "monospace", flex: 1 }}
                        onChange={e => setNuevaPass(e.target.value)} />
                      <button type="button" className="btn-secondary" style={{ whiteSpace: "nowrap" }}
                        onClick={() => setNuevaPass(genPassword())}>
                        🔄 Generar
                      </button>
                    </div>
                  </label>
                  <button type="submit" className="btn-primary" style={{ whiteSpace: "nowrap" }}>Guardar</button>
                </form>
              </>
            ) : (
              <p className="empty">No se encontró usuario para este grupo.</p>
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
                  <TelefonoInput required value={editandoMiembro.telefono || ""}
                    onChange={val => setEditandoMiembro(p => ({ ...p, telefono: val || "" }))} />
                </Campo>
                <Campo label="Teléfono alternativo">
                  <TelefonoInput value={editandoMiembro.tlf_alternativo || ""}
                    onChange={val => setEditandoMiembro(p => ({ ...p, tlf_alternativo: val || "" }))} />
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

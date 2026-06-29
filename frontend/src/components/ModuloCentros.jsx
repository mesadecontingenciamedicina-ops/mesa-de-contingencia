import { useState, useEffect } from "react";
import { api } from "../api/client";

export default function ModuloCentros() {
  const [centros,     setCentros]     = useState([]);
  const [msg,         setMsg]         = useState(null);
  const [modalNuevo,  setModalNuevo]  = useState(null);
  const [editando,    setEditando]    = useState(null);
  const [modalUser,   setModalUser]   = useState(null); // { centro, usuario }
  const [nuevoUser,   setNuevoUser]   = useState({ username: "", password: "", password2: "" });
  const [nuevaPass,   setNuevaPass]   = useState("");

  const reload = async () => setCentros(await api.getCentros());
  useEffect(() => { reload(); }, []);

  const flash = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 3500); };

  const crearCentro = async (e) => {
    e.preventDefault();
    try {
      await api.crearCentro(modalNuevo);
      setModalNuevo(null);
      await reload();
      flash("Centro creado.");
    } catch (err) { flash(err.message, false); }
  };

  const guardarEdicion = async (e) => {
    e.preventDefault();
    try {
      await api.editarCentro(editando.id, editando);
      setEditando(null);
      await reload();
      flash("Centro actualizado.");
    } catch (err) { flash(err.message, false); }
  };

  const eliminarCentro = async (c) => {
    if (!confirm(`¿Eliminar "${c.nombre}"? No se puede deshacer.`)) return;
    try {
      await api.eliminarCentro(c.id);
      await reload();
      flash(`Centro "${c.nombre}" eliminado.`);
    } catch (err) { flash(err.message, false); }
  };

  const abrirUsuario = (c) => {
    setModalUser({ centro: c, usuario: c.usuario });
    setNuevoUser({ username: "", password: "", password2: "" });
    setNuevaPass("");
  };

  const crearUsuario = async (e) => {
    e.preventDefault();
    if (nuevoUser.password !== nuevoUser.password2) { flash("Las contraseñas no coinciden.", false); return; }
    try {
      const u = await api.crearUsuarioCentro(modalUser.centro.id, { username: nuevoUser.username, password: nuevoUser.password });
      setModalUser(p => ({ ...p, usuario: u }));
      setNuevoUser({ username: "", password: "", password2: "" });
      await reload();
      flash("Usuario creado.");
    } catch (err) { flash(err.message, false); }
  };

  const cambiarPassword = async (e) => {
    e.preventDefault();
    try {
      await api.cambiarPasswordCentro(modalUser.centro.id, { password: nuevaPass });
      setNuevaPass("");
      flash("Contraseña actualizada.");
    } catch (err) { flash(err.message, false); }
  };

  return (
    <div className="modulo">
      <h2>🏥 Centros de Atención</h2>
      {msg && <div className={`alert ${msg.ok ? "alert-ok" : "alert-err"}`}>{msg.text}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
        <button className="btn-primary" onClick={() => setModalNuevo({ nombre: "", descripcion: "" })}>
          + Nuevo Centro
        </button>
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
                    <button className="btn-edit-grupo" onClick={() => setEditando({ ...c })} title="Editar">✏️</button>
                    <button className="btn-edit-grupo" style={{ background: "#dc2626" }} onClick={() => eliminarCentro(c)} title="Eliminar">🗑️</button>
                  </div>
                </div>
                {c.descripcion && <p className="grupo-desc">{c.descripcion}</p>}
                <div style={{ marginTop: "0.5rem" }}>
                  {c.usuario
                    ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.82rem", color: "var(--navy)", fontWeight: 700 }}>
                          👤 {c.usuario.username}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: c.usuario.activo ? "#16a34a" : "#dc2626" }}>
                          {c.usuario.activo ? "● Activo" : "● Inactivo"}
                        </span>
                        <button className="btn-edit-grupo" style={{ fontSize: "0.72rem", padding: "2px 8px" }} onClick={() => abrirUsuario(c)}>
                          🔑 Contraseña
                        </button>
                      </div>
                    )
                    : (
                      <button className="btn-secondary" style={{ fontSize: "0.78rem", padding: "4px 12px" }} onClick={() => abrirUsuario(c)}>
                        + Crear usuario de acceso
                      </button>
                    )
                  }
                </div>
              </div>
            ))}
          </div>
        )
      }

      {/* Modal nuevo centro */}
      {modalNuevo && (
        <div className="overlay" onClick={() => setModalNuevo(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Nuevo Centro de Atención</h3>
            <form onSubmit={crearCentro} className="form" style={{ marginTop: "0.75rem" }}>
              <label>Nombre *
                <input required autoFocus value={modalNuevo.nombre}
                  onChange={e => setModalNuevo(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej. Centro de Salud La Florida" />
              </label>
              <label>Descripción
                <input value={modalNuevo.descripcion}
                  onChange={e => setModalNuevo(p => ({ ...p, descripcion: e.target.value }))}
                  placeholder="Opcional" />
              </label>
              <div className="modal-actions">
                <button type="submit" className="btn-primary">Crear Centro</button>
                <button type="button" className="btn-ghost" onClick={() => setModalNuevo(null)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal editar centro */}
      {editando && (
        <div className="overlay" onClick={() => setEditando(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Editar Centro</h3>
            <form onSubmit={guardarEdicion} className="form" style={{ marginTop: "0.75rem" }}>
              <label>Nombre *
                <input required value={editando.nombre}
                  onChange={e => setEditando(p => ({ ...p, nombre: e.target.value }))} />
              </label>
              <label>Descripción
                <input value={editando.descripcion || ""}
                  onChange={e => setEditando(p => ({ ...p, descripcion: e.target.value }))} />
              </label>
              <div className="modal-actions">
                <button type="submit" className="btn-primary">Guardar</button>
                <button type="button" className="btn-ghost" onClick={() => setEditando(null)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal usuario de acceso */}
      {modalUser && (
        <div className="overlay" onClick={() => setModalUser(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>🔑 Usuario — {modalUser.centro.nombre}</h3>
            {modalUser.usuario ? (
              <>
                <div className="info-banner" style={{ margin: "0.75rem 0 1rem" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>Usuario de acceso</div>
                  <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--navy)" }}>{modalUser.usuario.username}</span>
                  <span style={{ marginLeft: "0.75rem", fontSize: "0.8rem", fontWeight: 600, color: modalUser.usuario.activo ? "#16a34a" : "#dc2626" }}>
                    {modalUser.usuario.activo ? "● Activo" : "● Inactivo"}
                  </span>
                </div>
                <form onSubmit={cambiarPassword} className="form">
                  <label>Nueva contraseña (mín. 6 caracteres)
                    <input type="password" value={nuevaPass} minLength={6} required
                      placeholder="Nueva contraseña"
                      onChange={e => setNuevaPass(e.target.value)} />
                  </label>
                  <div className="modal-actions">
                    <button type="submit" className="btn-secondary">Cambiar contraseña</button>
                    <button type="button" className="btn-ghost" onClick={() => setModalUser(null)}>Cerrar</button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <p className="empty" style={{ margin: "0.75rem 0" }}>Este centro aún no tiene usuario de acceso.</p>
                <form onSubmit={crearUsuario} className="form">
                  <label>Nombre de usuario *
                    <input required autoFocus value={nuevoUser.username}
                      placeholder="ej. centro_florida"
                      onChange={e => setNuevoUser(p => ({ ...p, username: e.target.value }))} />
                  </label>
                  <label>Contraseña * (mín. 6 caracteres)
                    <input type="password" required minLength={6} value={nuevoUser.password}
                      onChange={e => setNuevoUser(p => ({ ...p, password: e.target.value }))} />
                  </label>
                  <label>Confirmar contraseña *
                    <input type="password" required value={nuevoUser.password2}
                      onChange={e => setNuevoUser(p => ({ ...p, password2: e.target.value }))} />
                  </label>
                  <div className="modal-actions">
                    <button type="submit" className="btn-primary">Crear Usuario</button>
                    <button type="button" className="btn-ghost" onClick={() => setModalUser(null)}>Cancelar</button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

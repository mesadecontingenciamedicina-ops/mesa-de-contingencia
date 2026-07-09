import { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function ModuloPublicaciones() {
  const { user } = useAuth();
  const [publicaciones, setPublicaciones] = useState([]);
  const [miembrosGrupo, setMiembrosGrupo] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  
  // Estado del formulario
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nuevaDesc, setNuevaDesc] = useState("");
  const [autorSeleccionado, setAutorSeleccionado] = useState("");
  const [archivoAdjunto, setArchivoAdjunto] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // Estado de comentarios
  const [comentariosData, setComentariosData] = useState({});
  const [pubAbierta, setPubAbierta] = useState(null);
  const [textoComentario, setTextoComentario] = useState({});

  const isAdmin = user?.rol === "admin";
  const isPrivileged = isAdmin || user?.es_coordinador;

  const cargarPublicaciones = async () => {
    try {
      const data = await api.getPublicaciones();
      setPublicaciones(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const cargarMiembrosGrupo = async () => {
    if (!isPrivileged) return; // Solo privilegiados necesitan publicar
    
    if (isAdmin) {
      // El admin no tiene un grupo específico en esta lógica, su "autor" es él mismo
      setMiembrosGrupo([{ username: user.username, nombre: user.username }]);
      setAutorSeleccionado(user.username);
    } else {
      // Es coordinador, cargar miembros de su grupo
      try {
        const miembros = await api.getMiembros(); // Como es grupo, getMiembros retorna solo los suyos
        const miembrosMapeados = miembros.map(m => ({
          username: m.nombre, // Usamos el nombre del miembro como "username/autor" para display
          nombre: m.nombre
        }));
        
        // Agregar también el usuario del grupo actual por si quiere publicar como el grupo
        miembrosMapeados.unshift({ username: user.username, nombre: `Representante (${user.username})` });
        
        setMiembrosGrupo(miembrosMapeados);
        if (miembrosMapeados.length > 0) {
          setAutorSeleccionado(miembrosMapeados[0].username);
        }
      } catch (err) {
        console.error("Error al cargar miembros del grupo:", err);
      }
    }
  };

  useEffect(() => {
    cargarPublicaciones();
    cargarMiembrosGrupo();
  }, []);

  const handleCrear = async (e) => {
    e.preventDefault();
    if (!nuevaDesc.trim()) return;
    if (nuevaDesc.length > 2000) return;

    setGuardando(true);
    setError(null);
    let url = null;
    let nombre = null;

    if (archivoAdjunto) {
      try {
        const uploadRes = await api.uploadAdjunto(archivoAdjunto);
        url = uploadRes.url;
        nombre = uploadRes.nombre;
      } catch (err) {
        setError("Error subiendo archivo: " + err.message);
        setGuardando(false);
        return;
      }
    }

    try {
      await api.crearPublicacion({ 
        descripcion: nuevaDesc,
        autor_username: autorSeleccionado,
        archivo_url: url,
        archivo_nombre: nombre
      });
      setNuevaDesc("");
      setArchivoAdjunto(null);
      setMostrarForm(false);
      await cargarPublicaciones();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta publicación?")) return;
    try {
      await api.eliminarPublicacion(id);
      await cargarPublicaciones();
    } catch (err) {
      alert("Error al eliminar: " + err.message);
    }
  };

  const toggleComentarios = async (pubId) => {
    if (pubAbierta === pubId) {
      setPubAbierta(null);
      return;
    }
    setPubAbierta(pubId);
    if (!comentariosData[pubId] || !comentariosData[pubId].lista) {
      cargarComentarios(pubId);
    }
  };

  const cargarComentarios = async (pubId) => {
    setComentariosData(prev => ({ ...prev, [pubId]: { ...prev[pubId], cargando: true } }));
    try {
      const data = await api.getComentariosPub(pubId);
      setComentariosData(prev => ({ ...prev, [pubId]: { cargando: false, lista: data } }));
    } catch (err) {
      console.error(err);
      setComentariosData(prev => ({ ...prev, [pubId]: { cargando: false, lista: [] } }));
    }
  };

  const enviarComentario = async (pubId) => {
    const texto = textoComentario[pubId] || "";
    if (!texto.trim() || texto.length > 750) return;

    try {
      await api.crearComentarioPub(pubId, texto);
      setTextoComentario(prev => ({ ...prev, [pubId]: "" }));
      await cargarComentarios(pubId);
      setPublicaciones(prev => prev.map(p => 
        p.id === pubId ? { ...p, num_comentarios: (p.num_comentarios || 0) + 1 } : p
      ));
    } catch (err) {
      alert("Error al enviar comentario: " + err.message);
    }
  };

  const eliminarComentario = async (pubId, comId) => {
    if (!window.confirm("¿Eliminar este comentario?")) return;
    try {
      await api.eliminarComentarioPub(pubId, comId);
      await cargarComentarios(pubId);
      setPublicaciones(prev => prev.map(p => 
        p.id === pubId ? { ...p, num_comentarios: Math.max(0, (p.num_comentarios || 1) - 1) } : p
      ));
    } catch (err) {
      alert("Error al eliminar: " + err.message);
    }
  };

  const formValido = nuevaDesc.trim().length > 0 && nuevaDesc.length <= 2000 && autorSeleccionado;

  return (
    <div className="modulo">
      <div className="act-header">
        <h2>📢 Tablón de Publicaciones</h2>
        {isPrivileged && !mostrarForm && (
          <button className="btn-primary" onClick={() => setMostrarForm(true)}>
            + Nueva Publicación
          </button>
        )}
      </div>

      {error && <div className="alert alert-err">{error}</div>}

      {isPrivileged && mostrarForm && (
        <form className="form pub-form" onSubmit={handleCrear} style={{ maxWidth: "100%", marginTop: "1.25rem" }}>
          
          <div className="form-row">
            <label>
              Contenido / Anuncio *
              <textarea
                rows={5}
                value={nuevaDesc}
                onChange={(e) => setNuevaDesc(e.target.value)}
                placeholder="Escribe aquí la información importante a compartir..."
                maxLength={2000}
                required
              />
              <div className={`pub-char-count ${nuevaDesc.length > 1900 ? 'count-warn' : ''}`}>
                {nuevaDesc.length} / 2000
              </div>
            </label>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
              <label>
                Publicar como (Autor) *
                <select 
                  value={autorSeleccionado} 
                  onChange={(e) => setAutorSeleccionado(e.target.value)}
                  required
                >
                  {miembrosGrupo.map(m => (
                    <option key={m.username} value={m.username}>{m.nombre}</option>
                  ))}
                </select>
              </label>

              <label>
                Adjuntar Archivo (Opcional, max 1 semana)
                <input 
                  type="file" 
                  accept="image/*,.pdf" 
                  onChange={(e) => setArchivoAdjunto(e.target.files[0] || null)}
                  style={{ marginTop: "0.5rem" }}
                />
              </label>
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: "1rem" }}>
            <button type="submit" className="btn-primary" disabled={guardando || !formValido}>
              {guardando ? "Publicando..." : "Publicar"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => { setMostrarForm(false); setNuevaDesc(""); }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {cargando ? (
        <div className="empty">Cargando publicaciones...</div>
      ) : publicaciones.length === 0 ? (
        <div className="empty">No hay publicaciones activas.</div>
      ) : (
        <div className="pub-list">
          {publicaciones.map(pub => (
            <div key={pub.id} className="pub-card">
              <div className="pub-card-header">
                <div className="pub-meta-info">
                  <span className="pub-autor">👤 {pub.autor_username}</span>
                  {pub.grupo_nombre && (
                    <span className="pub-grupo">🏷️ {pub.grupo_nombre}</span>
                  )}
                  <span className="pub-fecha">📅 {new Date(pub.fecha).toLocaleString()}</span>
                </div>
                {isPrivileged && (
                  <button 
                    className="pub-btn-delete" 
                    title="Eliminar publicación"
                    onClick={() => handleEliminar(pub.id)}
                  >
                    🗑️
                  </button>
                )}
              </div>
              <div className="pub-card-body">
                {pub.descripcion}
                
                {pub.archivo_nombre && (
                  <div className="pub-archivo" style={{ marginTop: "1rem" }}>
                    {pub.archivo_url ? (
                      <a 
                        href={pub.archivo_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="btn-ghost"
                        style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem", border: "1px solid #ccc", borderRadius: "8px", textDecoration: "none", color: "inherit", fontSize: "0.9rem" }}
                      >
                        📎 Descargar {pub.archivo_nombre}
                      </a>
                    ) : (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem", border: "1px dashed #999", borderRadius: "8px", color: "#666", backgroundColor: "#f9f9f9", fontSize: "0.9rem" }}>
                        ⚠️ Archivo adjunto vencido: {pub.archivo_nombre}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="pub-footer">
                <button 
                  className={`pub-btn-comentarios ${pubAbierta === pub.id ? 'active' : ''}`}
                  onClick={() => toggleComentarios(pub.id)}
                >
                  💬 {pub.num_comentarios || 0}
                </button>
              </div>

              {pubAbierta === pub.id && (
                <div className="pub-comentarios-panel">
                  {comentariosData[pub.id]?.cargando ? (
                    <div className="empty">Cargando comentarios...</div>
                  ) : (
                    <>
                      <div className="pub-comentarios-lista">
                        {(comentariosData[pub.id]?.lista || []).length === 0 ? (
                          <div className="empty" style={{ padding: "0.5rem" }}>Aún no hay comentarios.</div>
                        ) : (
                          comentariosData[pub.id].lista.map(c => {
                            const esMio = c.autor === user.username;
                            const puedeBorrar = esMio || isPrivileged;
                            return (
                              <div key={c.id} className={`comentario ${esMio ? "comentario-propio" : "comentario-otro"}`}>
                                <div className="comentario-meta">
                                  <span className="comentario-autor">{c.autor}</span>
                                  <span className={`comentario-rol ${c.rol === 'admin' ? 'rol-admin' : 'rol-grupo'}`}>
                                    {c.rol}
                                  </span>
                                  <span className="comentario-fecha">
                                    {new Date(c.fecha).toLocaleString(undefined, {
                                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                                    })}
                                  </span>
                                  {puedeBorrar && (
                                    <button 
                                      className="pub-btn-delete" 
                                      style={{ marginLeft: "auto", fontSize: "0.85rem", padding: "0 4px" }}
                                      onClick={() => eliminarComentario(pub.id, c.id)}
                                      title="Eliminar comentario"
                                    >
                                      🗑️
                                    </button>
                                  )}
                                </div>
                                <p className="comentario-texto">{c.texto}</p>
                              </div>
                            );
                          })
                        )}
                      </div>
                      
                      <div className="comentario-form" style={{ marginTop: "1rem" }}>
                        <textarea
                          placeholder="Escribe un comentario..."
                          rows={2}
                          maxLength={750}
                          value={textoComentario[pub.id] || ""}
                          onChange={e => setTextoComentario({ ...textoComentario, [pub.id]: e.target.value })}
                        />
                        <button 
                          className="btn-assign"
                          disabled={!(textoComentario[pub.id] || "").trim()}
                          onClick={() => enviarComentario(pub.id)}
                        >
                          Enviar
                        </button>
                      </div>
                      
                      <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
                        <button 
                          className="btn-ghost" 
                          style={{ fontSize: "0.8rem", padding: "0.3rem 0.8rem" }}
                          onClick={() => setPubAbierta(null)}
                        >
                          — Cerrar comentarios
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

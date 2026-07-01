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
  const [guardando, setGuardando] = useState(false);

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
    try {
      await api.crearPublicacion({ 
        descripcion: nuevaDesc,
        autor_username: autorSeleccionado
      });
      setNuevaDesc("");
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
        <form className="pub-form" onSubmit={handleCrear}>
          <h3>Crear Anuncio o Publicación</h3>
          
          <div className="form-row" style={{ gridTemplateColumns: "1fr" }}>
            <label>
              Publicar como (Autor):
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
          </div>

          <label>
            Contenido:
            <textarea
              rows={4}
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

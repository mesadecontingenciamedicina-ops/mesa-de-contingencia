import React, { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import FormBuilder from "./FormBuilder";
import DashboardRespuestas from "./DashboardRespuestas";

export default function ModuloFormularios() {
  const { user } = useAuth();
  const [formularios, setFormularios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Vista: 'lista', 'crear', 'respuestas'
  const [vista, setVista] = useState("lista");
  const [formActivo, setFormActivo] = useState(null);
  
  // Para creación
  const [nuevoTitulo, setNuevoTitulo] = useState("");
  const [configuracion, setConfiguracion] = useState([]);
  const [creando, setCreando] = useState(false);

  const cargarFormularios = async () => {
    try {
      setLoading(true);
      const res = await api.getFormularios();
      setFormularios(res);
      setError("");
    } catch (err) {
      setError("Error al cargar formularios: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarFormularios();
  }, []);

  const handleCrear = async () => {
    if (!nuevoTitulo.trim()) {
      alert("El título es obligatorio");
      return;
    }
    if (configuracion.length === 0) {
      alert("Debes añadir al menos una pregunta");
      return;
    }

    try {
      setCreando(true);
      await api.crearFormulario({ titulo: nuevoTitulo, configuracion });
      alert(user.rol === "admin" ? "Formulario creado y publicado exitosamente" : "Formulario creado y enviado para revisión");
      setVista("lista");
      setNuevoTitulo("");
      setConfiguracion([]);
      cargarFormularios();
    } catch (err) {
      alert("Error al crear: " + err.message);
    } finally {
      setCreando(false);
    }
  };

  const handleAprobar = async (id) => {
    if (!window.confirm("¿Estás seguro de aprobar este formulario y generar el enlace público?")) return;
    try {
      await api.aprobarFormulario(id);
      cargarFormularios();
    } catch (err) {
      alert("Error al aprobar: " + err.message);
    }
  };

  const copiarEnlace = (token) => {
    const url = `${window.location.origin}/?formulario=${token}`;
    navigator.clipboard.writeText(url);
    alert("Enlace copiado al portapapeles:\n" + url);
  };

  if (vista === "crear") {
    return (
      <div className="modulo-panel" style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto" }}>
        <button onClick={() => setVista("lista")} className="btn-secondary" style={{ marginBottom: "1rem" }}>← Volver a la Lista</button>
        <h2>Crear Nuevo Formulario</h2>
        <p style={{ color: "#666", marginBottom: "2rem" }}>
          {user.rol === "admin" 
            ? "Al crear este formulario, se aprobará automáticamente y estará listo para compartir." 
            : "Una vez creado, un administrador deberá aprobar tu formulario para obtener el enlace público."}
        </p>
        
        <div className="form-group" style={{ marginBottom: "2.5rem" }}>
          <label style={{ fontWeight: "bold", fontSize: "1.1rem" }}>Título del Formulario</label>
          <input 
            type="text" 
            className="form-input" 
            value={nuevoTitulo} 
            onChange={e => setNuevoTitulo(e.target.value)} 
            placeholder="Ej. Encuesta de Necesidades de Insumos Médicos" 
            style={{ fontSize: "1.1rem", padding: "0.8rem" }}
          />
        </div>

        <h3 style={{ borderBottom: "2px solid #e5e7eb", paddingBottom: "0.8rem", marginBottom: "1.5rem" }}>Configuración de Preguntas</h3>
        <FormBuilder value={configuracion} onChange={setConfiguracion} />

        <div style={{ marginTop: "3rem", display: "flex", justifyContent: "flex-end", gap: "1rem" }}>
          <button onClick={() => setVista("lista")} className="btn-secondary" style={{ padding: "0.8rem 2rem", fontSize: "1.1rem" }}>
            Cancelar
          </button>
          <button onClick={handleCrear} disabled={creando} className="btn-primary" style={{ padding: "0.8rem 2rem", fontSize: "1.1rem" }}>
            {creando ? "Guardando..." : (user.rol === "admin" ? "Crear y Publicar" : "Crear y Solicitar Aprobación")}
          </button>
        </div>
      </div>
    );
  }

  if (vista === "respuestas") {
    return <DashboardRespuestas formId={formActivo} onBack={() => setVista("lista")} />;
  }

  return (
    <div className="modulo-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ margin: 0 }}>Gestión de Formularios</h2>
          <p style={{ margin: "0.5rem 0 0 0", color: "#666" }}>
            Crea, administra y comparte formularios externos para recolectar información.
          </p>
        </div>
        <button onClick={() => setVista("crear")} className="btn-primary" style={{ padding: "0.8rem 1.5rem", fontSize: "1rem" }}>
          + Nuevo Formulario
        </button>
      </div>

      {error && <div style={{ color: "#b91c1c", background: "#fef2f2", padding: "1rem", borderRadius: "6px", marginBottom: "1.5rem" }}>{error}</div>}
      
      {loading ? <p style={{ color: "#666" }}>Cargando formularios...</p> : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Título</th>
                <th>Autor</th>
                <th>Fecha de Creación</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {formularios.map(f => (
                <tr key={f.id}>
                  <td>#{f.id}</td>
                  <td><strong>{f.titulo}</strong></td>
                  <td>{f.creador_nombre} <small style={{ color: "#888" }}>({f.creado_por_rol})</small></td>
                  <td>{new Date(f.fecha_creacion).toLocaleDateString()}</td>
                  <td>
                    <span style={{ 
                      display: "inline-block",
                      padding: "0.3rem 0.8rem", 
                      borderRadius: "20px", 
                      fontSize: "0.85rem", 
                      background: f.estado === "Aprobado" ? "#dcfce7" : "#fef3c7",
                      color: f.estado === "Aprobado" ? "#166534" : "#92400e",
                      fontWeight: 600,
                      border: f.estado === "Aprobado" ? "1px solid #bbf7d0" : "1px solid #fde68a"
                    }}>
                      {f.estado}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      {f.estado === "Pendiente" && user.rol === "admin" && (
                        <button onClick={() => handleAprobar(f.id)} className="btn-primary" style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}>
                          ✓ Aprobar
                        </button>
                      )}
                      {f.estado === "Aprobado" && f.token_publico && (
                        <button onClick={() => copiarEnlace(f.token_publico)} className="btn-secondary" style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}>
                          🔗 Enlace
                        </button>
                      )}
                      <button onClick={() => { setFormActivo(f.id); setVista("respuestas"); }} className="btn-secondary" style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}>
                        📊 Resultados
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {formularios.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
                    No se encontraron formularios registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

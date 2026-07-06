import React, { useState, useEffect, lazy, Suspense } from 'react';
import { api } from '../api/client';
import TelefonoInput from './TelefonoInput';
const MapaPicker = lazy(() => import('./MapaPicker'));

export default function FormPublicView({ token }) {
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);
  
  // Respuestas: key es pregunta_id, value es respuesta
  const [respuestas, setRespuestas] = useState({});
  const [latLng, setLatLng] = useState(null);

  useEffect(() => {
    api.getPublicFormulario(token)
      .then(res => {
        setForm(res);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || "Error al cargar formulario");
        setLoading(false);
      });
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    // Validar obligatorios
    for (const q of form.configuracion) {
      if (q.required && !respuestas[q.id]) {
        if (q.type === "address" && !latLng) {
          setError(`La ubicación en el mapa es obligatoria para: "${q.label}".`);
          return;
        } else if (q.type !== "address") {
          setError(`La pregunta "${q.label}" es obligatoria.`);
          return;
        }
      }
    }
    
    setEnviando(true);
    try {
      await api.submitPublicFormulario(token, {
        respuestas,
        lat: latLng?.lat,
        lng: latLng?.lng
      });
      setExito(true);
    } catch (err) {
      setError(err.message || "Error al enviar formulario");
    } finally {
      setEnviando(false);
    }
  };

  if (loading) return <div style={{ padding: "3rem", textAlign: "center", fontSize: "1.2rem", color: "#666" }}>Cargando formulario...</div>;
  if (error && !form) return <div style={{ padding: "3rem", color: "red", textAlign: "center", fontSize: "1.2rem" }}>{error}</div>;
  if (exito) return (
    <div style={{ maxWidth: "600px", margin: "4rem auto", padding: "3rem", textAlign: "center", background: "#f0fdf4", border: "2px solid #bbf7d0", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
      <h2 style={{ color: "#166534", fontSize: "2rem", marginBottom: "1rem" }}>¡Enviado con éxito!</h2>
      <p style={{ fontSize: "1.2rem", color: "#15803d" }}>Tus respuestas han sido registradas de forma segura. Muchas gracias por tu colaboración.</p>
    </div>
  );

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem 1rem" }}>
      <div style={{ marginBottom: "2rem", padding: "2rem", background: "#fff", borderRadius: "12px", borderTop: "8px solid #3b82f6", boxShadow: "0 4px 6px rgba(0,0,0,0.05)" }}>
        <h1 style={{ margin: "0 0 1rem 0", fontSize: "1.8rem", color: "#1f2937" }}>
          Encuesta de la Facultad de Medicina UCV
        </h1>
        <h2 style={{ margin: 0, fontSize: "1.2rem", color: "#4b5563", fontWeight: 400 }}>
          Para <strong>{form.titulo}</strong> de {form.creado_por_rol === 'admin' ? "Administración" : form.creador_nombre}
        </h2>
      </div>

      <form onSubmit={handleSubmit} style={{ background: "#fff", padding: "2.5rem", borderRadius: "12px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)" }}>
        {error && <div style={{ marginBottom: "1.5rem", color: "#b91c1c", background: "#fef2f2", padding: "1rem", borderRadius: "6px", borderLeft: "4px solid #b91c1c", fontWeight: 500 }}>{error}</div>}
        
        {form.configuracion.map(q => (
          <div key={q.id} style={{ marginBottom: "2rem" }}>
            <label style={{ display: "block", marginBottom: "0.8rem", fontWeight: 600, fontSize: "1.1rem", color: "#374151" }}>
              {q.label} {q.required && <span style={{ color: "#e11d48", marginLeft: "4px" }}>*</span>}
            </label>
            
            {q.type === 'text_short' && (
              <input type="text" className="form-input" maxLength={50} required={q.required}
                value={respuestas[q.id] || ""} onChange={e => setRespuestas({...respuestas, [q.id]: e.target.value})}
                style={{ width: "100%", padding: "0.75rem", fontSize: "1rem", borderRadius: "6px", border: "1px solid #d1d5db" }} />
            )}
            
            {q.type === 'text_long' && (
              <textarea className="form-input" maxLength={1000} required={q.required} rows={5}
                value={respuestas[q.id] || ""} onChange={e => setRespuestas({...respuestas, [q.id]: e.target.value})}
                style={{ width: "100%", padding: "0.75rem", fontSize: "1rem", borderRadius: "6px", border: "1px solid #d1d5db", resize: "vertical" }} />
            )}

            {q.type === 'email' && (
              <input type="email" className="form-input" required={q.required}
                value={respuestas[q.id] || ""} onChange={e => setRespuestas({...respuestas, [q.id]: e.target.value})}
                style={{ width: "100%", padding: "0.75rem", fontSize: "1rem", borderRadius: "6px", border: "1px solid #d1d5db" }} />
            )}

            {q.type === 'phone' && (
              <div style={{ maxWidth: "400px" }}>
                <TelefonoInput required={q.required} value={respuestas[q.id] || ""}
                  onChange={val => setRespuestas({...respuestas, [q.id]: val})} />
              </div>
            )}

            {q.type === 'scale' && (
              <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", background: "#f9fafb", padding: "1rem", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                <span style={{fontWeight: 500, color: "#6b7280"}}>0</span>
                <input type="range" min="0" max="10" required={q.required}
                  value={respuestas[q.id] || (respuestas[q.id] === 0 ? 0 : 5)} 
                  onChange={e => setRespuestas({...respuestas, [q.id]: parseInt(e.target.value, 10)})}
                  style={{ flex: 1, cursor: "pointer" }} />
                <span style={{fontWeight: 500, color: "#6b7280"}}>10</span>
                <div style={{ background: "#3b82f6", color: "white", padding: "0.4rem 1rem", borderRadius: "20px", fontWeight: "bold", minWidth: "3rem", textAlign: "center" }}>
                  {respuestas[q.id] !== undefined ? respuestas[q.id] : 5}
                </div>
              </div>
            )}

            {q.type === 'select' && (
              <select className="form-input" required={q.required}
                value={respuestas[q.id] || ""} onChange={e => setRespuestas({...respuestas, [q.id]: e.target.value})}
                style={{ width: "100%", padding: "0.75rem", fontSize: "1rem", borderRadius: "6px", border: "1px solid #d1d5db", cursor: "pointer", background: "#fff" }}>
                <option value="">-- Selecciona una opción --</option>
                {q.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            )}

            {q.type === 'address' && (
              <div style={{ border: "1px solid #d1d5db", borderRadius: "6px", overflow: "hidden" }}>
                <Suspense fallback={<div style={{padding: "2rem", textAlign: "center"}}>Cargando mapa interactivo...</div>}>
                  <MapaPicker value={latLng} onChange={(coords) => {
                     setLatLng(coords);
                     setRespuestas({...respuestas, [q.id]: "Ubicación registrada en el mapa"});
                  }} />
                </Suspense>
                {latLng && <div style={{ padding: "0.5rem 1rem", background: "#ecfdf5", color: "#065f46", fontSize: "0.9rem", borderTop: "1px solid #d1d5db" }}>✓ Ubicación capturada correctamente.</div>}
              </div>
            )}
          </div>
        ))}
        
        <div style={{ marginTop: "3rem", borderTop: "1px solid #e5e7eb", paddingTop: "2rem" }}>
          <button type="submit" className="btn-primary" disabled={enviando} style={{ width: "100%", padding: "1rem", fontSize: "1.1rem", borderRadius: "8px" }}>
            {enviando ? "Enviando respuestas..." : "Enviar Respuestas"}
          </button>
        </div>
      </form>
    </div>
  );
}

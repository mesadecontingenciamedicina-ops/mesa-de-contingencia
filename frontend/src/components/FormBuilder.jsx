import React from "react";

export default function FormBuilder({ value, onChange }) {
  const preguntas = value || [];

  const handleAddPregunta = (tipo) => {
    const nuevaPregunta = {
      id: `q_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      type: tipo,
      label: "",
      required: false
    };
    if (tipo === "select") {
      nuevaPregunta.options = ["Opción 1"];
    }
    onChange([...preguntas, nuevaPregunta]);
  };

  const updatePregunta = (id, updates) => {
    onChange(preguntas.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const removePregunta = (id) => {
    onChange(preguntas.filter(p => p.id !== id));
  };

  const movePregunta = (index, dir) => {
    const nuevas = [...preguntas];
    const target = index + dir;
    if (target < 0 || target >= nuevas.length) return;
    const temp = nuevas[index];
    nuevas[index] = nuevas[target];
    nuevas[target] = temp;
    onChange(nuevas);
  };

  return (
    <div className="form-builder" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {preguntas.map((q, index) => (
        <div key={q.id} style={{ border: "1px solid #ddd", padding: "1.5rem", borderRadius: "8px", background: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div style={{ fontWeight: 600, fontSize: "1.1rem" }}>Pregunta {index + 1} <span style={{fontSize: "0.85rem", color: "#666", fontWeight: "normal"}}>({formatTipo(q.type)})</span></div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={() => movePregunta(index, -1)} disabled={index===0} className="btn-secondary" style={{ padding: "0.2rem 0.5rem" }}>↑</button>
              <button type="button" onClick={() => movePregunta(index, 1)} disabled={index===preguntas.length-1} className="btn-secondary" style={{ padding: "0.2rem 0.5rem" }}>↓</button>
              <button type="button" onClick={() => removePregunta(q.id)} className="btn-danger" style={{ padding: "0.2rem 0.5rem" }}>✕</button>
            </div>
          </div>
          
          <div className="form-group" style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.3rem", fontWeight: 500 }}>Enunciado de la pregunta</label>
            <input 
              type="text" 
              className="form-input" 
              value={q.label} 
              onChange={e => updatePregunta(q.id, { label: e.target.value })} 
              placeholder="Ej. Nombre completo, Describe la emergencia..." 
              maxLength={150}
              style={{ width: "100%", padding: "0.5rem", border: "1px solid #ccc", borderRadius: "4px" }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input 
              type="checkbox" 
              id={`req_${q.id}`} 
              checked={q.required} 
              onChange={e => updatePregunta(q.id, { required: e.target.checked })}
              style={{ transform: "scale(1.2)" }}
            />
            <label htmlFor={`req_${q.id}`} style={{ margin: 0, cursor: "pointer" }}>Esta pregunta es obligatoria</label>
          </div>

          {q.type === "select" && (
            <div className="form-group" style={{ marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input 
                type="checkbox" 
                id={`mult_${q.id}`} 
                checked={!!q.multiple} 
                onChange={e => updatePregunta(q.id, { multiple: e.target.checked })}
                style={{ transform: "scale(1.2)" }}
              />
              <label htmlFor={`mult_${q.id}`} style={{ margin: 0, cursor: "pointer", color: "#3b82f6" }}>Permitir selección múltiple (no excluyente)</label>
            </div>
          )}

          {q.type === "select" && (
            <div style={{ marginTop: "1.5rem", padding: "1rem", background: "#f8f9fa", borderLeft: "4px solid #3b82f6", borderRadius: "4px" }}>
              <label style={{ fontWeight: 600, fontSize: "0.95rem", display: "block", marginBottom: "0.8rem" }}>Opciones de respuesta (Máximo 20)</label>
              {q.options.map((opt, oIndex) => (
                <div key={oIndex} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={opt} 
                    onChange={e => {
                      const newOpts = [...q.options];
                      newOpts[oIndex] = e.target.value;
                      updatePregunta(q.id, { options: newOpts });
                    }}
                    placeholder={`Opción ${oIndex + 1}`}
                    style={{ flex: 1, padding: "0.4rem", border: "1px solid #ccc", borderRadius: "4px" }}
                  />
                  {q.options.length > 1 && (
                    <button type="button" onClick={() => {
                      const newOpts = q.options.filter((_, i) => i !== oIndex);
                      updatePregunta(q.id, { options: newOpts });
                    }} className="btn-danger" style={{ padding: "0.4rem 0.8rem" }}>-</button>
                  )}
                </div>
              ))}
              {q.options.length < 20 && (
                <button type="button" onClick={() => {
                  updatePregunta(q.id, { options: [...q.options, `Opción ${q.options.length + 1}`] });
                }} className="btn-secondary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem", marginTop: "0.5rem" }}>
                  + Añadir Opción
                </button>
              )}
            </div>
          )}
        </div>
      ))}
      
      {preguntas.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280", background: "#f9fafb", borderRadius: "8px", border: "2px dashed #d1d5db" }}>
          <strong>No has añadido ninguna pregunta a tu formulario.</strong>
          <p style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>Utiliza los botones de abajo para empezar a armar tu encuesta.</p>
        </div>
      )}

      <div style={{ marginTop: "1.5rem" }}>
        <p style={{ fontWeight: 600, marginBottom: "0.5rem", color: "#374151" }}>Añadir nueva pregunta:</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <button type="button" onClick={() => handleAddPregunta("text_short")} className="btn-secondary">+ Texto Corto</button>
          <button type="button" onClick={() => handleAddPregunta("text_long")} className="btn-secondary">+ Texto Largo</button>
          <button type="button" onClick={() => handleAddPregunta("phone")} className="btn-secondary">+ Teléfono</button>
          <button type="button" onClick={() => handleAddPregunta("email")} className="btn-secondary">+ Correo</button>
          <button type="button" onClick={() => handleAddPregunta("select")} className="btn-secondary">+ Selección (Múltiple/Única)</button>
          <button type="button" onClick={() => handleAddPregunta("address")} className="btn-secondary">+ Ubicación (Mapa)</button>
          <button type="button" onClick={() => handleAddPregunta("scale")} className="btn-secondary">+ Escala (0-10)</button>
        </div>
      </div>
    </div>
  );
}

function formatTipo(tipo) {
  const map = {
    "text_short": "Texto Corto",
    "text_long": "Texto Largo (Párrafo)",
    "phone": "Número Telefónico",
    "email": "Correo Electrónico",
    "select": "Selección Múltiple/Única",
    "address": "Ubicación (Mapa)",
    "scale": "Escala Numérica (0-10)"
  };
  return map[tipo] || tipo;
}

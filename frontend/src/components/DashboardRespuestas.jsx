import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { 
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Configurar los íconos por defecto de leaflet en React
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function DashboardRespuestas({ formId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [vistaCruda, setVistaCruda] = useState(false);

  useEffect(() => {
    api.getFormularioRespuestas(formId)
      .then(res => {
        setData(res);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [formId]);

  if (loading) return <div style={{ padding: "3rem", color: "#666" }}>Cargando analíticas del formulario...</div>;
  if (error) return <div style={{ padding: "3rem", color: "red" }}>Error: {error}</div>;

  const total = data.respuestas.length;

  return (
    <div className="modulo-panel" style={{ background: "#f9fafb", padding: "2rem", borderRadius: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <button onClick={onBack} className="btn-secondary" style={{ marginBottom: "1rem", padding: "0.4rem 0.8rem" }}>← Volver</button>
          <h2 style={{ margin: 0, color: "#1f2937" }}>Dashboard Analítico</h2>
          <p style={{ margin: "0.5rem 0 0 0", color: "#4b5563", fontSize: "1.1rem" }}>
            Total de respuestas registradas: <strong style={{ color: "#3b82f6", fontSize: "1.2rem" }}>{total}</strong>
          </p>
        </div>
        <div>
          <button onClick={() => setVistaCruda(!vistaCruda)} className="btn-primary" style={{ padding: "0.6rem 1rem" }}>
            {vistaCruda ? "Ver Gráficos" : "Ver Tabla Cruda"}
          </button>
        </div>
      </div>

      {total === 0 ? (
        <div style={{ padding: "4rem", textAlign: "center", color: "#6b7280", background: "#fff", borderRadius: "12px", border: "2px dashed #d1d5db" }}>
          <h3 style={{ marginBottom: "0.5rem" }}>Aún no hay datos</h3>
          <p>Comparte el enlace público del formulario para comenzar a recibir respuestas.</p>
        </div>
      ) : vistaCruda ? (
        <TablaCruda configuracion={data.configuracion} respuestas={data.respuestas} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "2rem" }}>
          {data.configuracion.map(q => (
            <RespuestaCard key={q.id} pregunta={q} respuestas={data.respuestas} />
          ))}
        </div>
      )}
    </div>
  );
}

function TablaCruda({ configuracion, respuestas }) {
  return (
    <div style={{ background: "#fff", padding: "1rem", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", overflowX: "auto" }}>
      <table className="table" style={{ width: "100%", whiteSpace: "nowrap" }}>
        <thead>
          <tr>
            <th>Fecha</th>
            {configuracion.map(q => <th key={q.id}>{q.label}</th>)}
            <th>Ubicación (Mapa)</th>
          </tr>
        </thead>
        <tbody>
          {respuestas.map(r => (
            <tr key={r.id}>
              <td>{new Date(r.fecha_creacion).toLocaleString()}</td>
              {configuracion.map(q => {
                const val = r.respuestas[q.id];
                const displayVal = Array.isArray(val) ? val.join(", ") : val;
                return <td key={q.id}>{displayVal || "-"}</td>;
              })}
              <td>
                {r.lat && r.lng ? (
                  <a href={`https://www.google.com/maps?q=${r.lat},${r.lng}`} target="_blank" rel="noreferrer" style={{ color: "#3b82f6" }}>
                    Ver en mapa
                  </a>
                ) : "No registrada"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RespuestaCard({ pregunta, respuestas }) {
  const [showAll, setShowAll] = useState(false);
  const type = pregunta.type;

  // Filtrar las respuestas que tengan esta pregunta (pueden ser nulas si no era obligatoria)
  const respuestasValidas = respuestas.filter(r => r.respuestas && r.respuestas[pregunta.id] !== undefined && r.respuestas[pregunta.id] !== "");

  const renderContenido = () => {
    if (respuestasValidas.length === 0) return <div style={{ color: "#9ca3af", fontStyle: "italic", marginTop: "1rem" }}>Pregunta sin responder.</div>;

    if (type === 'select') {
      const counts = {};
      respuestasValidas.forEach(r => {
        const val = r.respuestas[pregunta.id];
        if (Array.isArray(val)) {
          val.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
        } else {
          counts[val] = (counts[val] || 0) + 1;
        }
      });
      const chartData = Object.keys(counts).map(k => ({ name: k, count: counts[k] }));

      return (
        <div style={{ height: 250, width: "100%", marginTop: "1rem" }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={chartData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={85} label>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (type === 'scale') {
      const counts = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0, 10:0 };
      let sum = 0;
      respuestasValidas.forEach(r => {
        const val = parseInt(r.respuestas[pregunta.id], 10);
        if (!isNaN(val)) {
          counts[val] = (counts[val] || 0) + 1;
          sum += val;
        }
      });
      const chartData = Object.keys(counts).map(k => ({ score: k, count: counts[k] }));
      const avg = (sum / respuestasValidas.length).toFixed(1);

      return (
        <div style={{ marginTop: "1rem" }}>
          <div style={{ marginBottom: "1rem", fontWeight: 600, color: "#1f2937", background: "#f3f4f6", display: "inline-block", padding: "0.4rem 1rem", borderRadius: "20px" }}>
            Promedio: <span style={{ color: "#3b82f6" }}>{avg}</span> / 10
          </div>
          <div style={{ height: 200, width: "100%" }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="score" />
                <Tooltip cursor={{ fill: '#f3f4f6' }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    if (type === 'address') {
      // Para mapas usamos lat, lng de las respuestas
      const markers = respuestasValidas.filter(r => r.lat && r.lng);
      if (markers.length === 0) return <div style={{ marginTop: "1rem", color: "#6b7280" }}>Sin coordenadas registradas.</div>;
      
      const centerLat = markers.reduce((sum, m) => sum + m.lat, 0) / markers.length;
      const centerLng = markers.reduce((sum, m) => sum + m.lng, 0) / markers.length;

      return (
        <div style={{ height: 280, width: "100%", borderRadius: "8px", overflow: "hidden", marginTop: "1rem", border: "1px solid #e5e7eb" }}>
          <MapContainer center={[centerLat, centerLng]} zoom={12} style={{ height: "100%", width: "100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {markers.map(m => (
              <Marker key={m.id} position={[m.lat, m.lng]}>
                <Popup>
                  Respuesta del {new Date(m.fecha_creacion).toLocaleDateString()}
                  <br/>
                  Ubicación reportada.
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      );
    }

    // Por defecto (text, email, phone): mostrar los últimos 5 y permitir expandir
    const mostrados = showAll ? respuestasValidas : respuestasValidas.slice(0, 5);
    return (
      <div style={{ marginTop: "1rem" }}>
        <ul style={{ 
          margin: 0, padding: 0, listStyle: "none", color: "#4b5563", fontSize: "0.95rem",
          maxHeight: showAll ? "300px" : "auto", overflowY: showAll ? "auto" : "visible" 
        }}>
          {mostrados.map((r, i) => (
             <li key={i} style={{ marginBottom: "0.6rem", background: "#f9fafb", padding: "0.8rem", borderRadius: "6px", border: "1px solid #f3f4f6" }}>
               <div style={{ color: "#1f2937", marginBottom: "0.2rem", wordBreak: "break-word" }}>{r.respuestas[pregunta.id]}</div>
               <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                 Hace {Math.floor((new Date() - new Date(r.fecha_creacion)) / 86400000)} días · {new Date(r.fecha_creacion).toLocaleDateString()}
               </div>
             </li>
          ))}
        </ul>
        {respuestasValidas.length > 5 && (
          <button 
            onClick={() => setShowAll(!showAll)} 
            style={{ marginTop: "0.8rem", fontSize: "0.9rem", color: "#3b82f6", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            {showAll ? "↑ Ocultar respuestas" : `↓ Ver las ${respuestasValidas.length} respuestas completas`}
          </button>
        )}
      </div>
    );
  };

  return (
    <div style={{ background: "#fff", padding: "2rem", borderRadius: "12px", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
      <div style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700 }}>
        {pregunta.type.replace('_', ' ')}
      </div>
      <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.15rem", color: "#1f2937", lineHeight: "1.4" }}>
        {pregunta.label}
      </h3>
      {renderContenido()}
    </div>
  );
}

import { useState, useEffect, lazy, Suspense } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

const MapaPicker = lazy(() => import("./MapaPicker"));

const PRIORIDADES = ["Baja", "Normal", "Alta"];
const PRIORIDAD_COLOR = { Alta: "#dc2626", Normal: "#d97706", Baja: "#6b7280" };
const PRIORIDAD_BG    = { Alta: "#fee2e2", Normal: "#fef3c7", Baja: "#f3f4f6" };
const ESTADO_COLOR    = { "Por ejecutar": "#e74c3c", "En ejecución": "#f39c12", "Ejecutado": "#27ae60" };
const ESTADO_BG       = { "Por ejecutar": "#fee2e2", "En ejecución": "#fef3c7", "Ejecutado": "#dcfce7" };

function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const FORM_VACIO = () => ({
  descripcion: "", prioridad: "Normal",
  ubicacion: "", lat: null, lng: null, fecha_hora: nowLocal(),
});

export default function VistaCentro() {
  const { user } = useAuth();
  const [solicitudes, setSolicitudes] = useState([]);
  const [showForm, setShowForm]       = useState(false);
  const [form, setForm]               = useState(FORM_VACIO());
  const [msg, setMsg]                 = useState(null);
  const [detalle, setDetalle]         = useState(null);

  const reload = async () => {
    setSolicitudes(await api.getSolicitudesCentro());
  };
  useEffect(() => { reload(); }, []);

  const flash = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000); };
  const f = (campo, valor) => setForm(p => ({ ...p, [campo]: valor }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.descripcion.trim()) return flash("La descripción es obligatoria.", false);
    try {
      await api.crearSolicitud(form);
      setShowForm(false);
      setForm(FORM_VACIO());
      await reload();
      flash("Solicitud enviada correctamente.");
    } catch (err) { flash(err.message, false); }
  };

  const gestionada = (s) => s.actividad_estado && s.actividad_estado !== "Por ejecutar";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Header */}
      <div style={{
        background: "var(--navy)", color: "#fff",
        padding: "1rem 1.5rem",
        borderBottom: "3px solid var(--gold)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <img src="/logo-facmed.png" alt="Logo" style={{ width: 42, height: 42, borderRadius: "50%", background: "#fff", padding: 2, boxShadow: "0 0 0 2px var(--gold)" }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>Mesa de Contingencia</div>
              <div style={{ fontSize: "0.75rem", color: "var(--gold-light)", opacity: 0.85 }}>
                Centro: {user.centro_nombre}
              </div>
            </div>
          </div>
          <button className="btn-logout" onClick={() => { api.logout().catch(()=>{}); window.location.reload(); }}>
            Salir
          </button>
        </div>
      </div>

      <div style={{ padding: "1.5rem", maxWidth: 760, margin: "0 auto" }}>
        {msg && <div className={`alert ${msg.ok ? "alert-ok" : "alert-err"}`} style={{ marginBottom: "1rem" }}>{msg.text}</div>}

        {/* Botón nueva solicitud */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <h2 style={{ color: "var(--navy)", fontSize: "1.1rem", fontWeight: 700 }}>
            📥 Mis Solicitudes ({solicitudes.length})
          </h2>
          <button className="btn-primary" onClick={() => { setForm(FORM_VACIO()); setShowForm(v => !v); }}>
            {showForm ? "✕ Cancelar" : "+ Nueva Solicitud"}
          </button>
        </div>

        {/* Formulario */}
        {showForm && (
          <div className="modulo" style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ marginBottom: "1rem", color: "var(--navy)" }}>Nueva Solicitud</h3>
            <form onSubmit={submit} className="form" style={{ maxWidth: "100%" }}>
              <label>Descripción / Situación *
                <textarea required rows={4} value={form.descripcion}
                  onChange={e => f("descripcion", e.target.value)}
                  placeholder="Describe detalladamente la necesidad o situación..." />
              </label>

              <label>Prioridad
                <div className="prioridad-group">
                  {PRIORIDADES.map(p => (
                    <button key={p} type="button"
                      className={`prioridad-btn ${form.prioridad === p ? "prioridad-active" : ""}`}
                      style={form.prioridad === p
                        ? { background: PRIORIDAD_BG[p], color: PRIORIDAD_COLOR[p], borderColor: PRIORIDAD_COLOR[p] }
                        : {}}
                      onClick={() => f("prioridad", p)}>{p}</button>
                  ))}
                </div>
              </label>

              <label>Fecha y hora del evento
                <input type="datetime-local" value={form.fecha_hora}
                  onChange={e => f("fecha_hora", e.target.value)} />
              </label>

              <label>Ubicación — haz clic en el mapa o busca una dirección
                <Suspense fallback={<div className="mapa-loading">Cargando mapa...</div>}>
                  <MapaPicker
                    value={{ lat: form.lat, lng: form.lng, address: form.ubicacion }}
                    onChange={({ lat, lng, address }) => setForm(p => ({ ...p, lat, lng, ubicacion: address }))}
                  />
                </Suspense>
              </label>

              <button type="submit" className="btn-primary">Enviar Solicitud</button>
            </form>
          </div>
        )}

        {/* Lista de solicitudes */}
        {solicitudes.length === 0 && !showForm
          ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📋</div>
              <p>Aún no has enviado solicitudes.</p>
              <p style={{ fontSize: "0.85rem" }}>Usa el botón "Nueva Solicitud" para comenzar.</p>
            </div>
          )
          : (
            <div className="card-list">
              {solicitudes.map(s => (
                <div key={s.id} className="card sol-card"
                  style={{ cursor: "pointer", borderLeft: `4px solid ${s.actividad_estado ? ESTADO_COLOR[s.actividad_estado] || "#9ca3af" : "#e5e7eb"}` }}
                  onClick={() => setDetalle(s)}>
                  <div className="card-body">
                    <div className="sol-card-top">
                      <span className="prioridad-tag"
                        style={{ background: PRIORIDAD_BG[s.prioridad], color: PRIORIDAD_COLOR[s.prioridad] }}>
                        {s.prioridad}
                      </span>
                      {s.actividad_estado
                        ? <span style={{
                            padding: "2px 10px", borderRadius: 12, fontSize: "0.75rem", fontWeight: 700,
                            background: ESTADO_BG[s.actividad_estado], color: ESTADO_COLOR[s.actividad_estado]
                          }}>
                            {s.actividad_estado === "En ejecución" ? "✅ En gestión" : s.actividad_estado === "Ejecutado" ? "✔ Atendida" : "⏳ Pendiente"}
                          </span>
                        : <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: "0.75rem", fontWeight: 700, background: "#f3f4f6", color: "#6b7280" }}>
                            ⏳ Pendiente
                          </span>
                      }
                    </div>
                    <p className="card-desc" style={{ marginTop: "0.35rem" }}>{s.descripcion}</p>
                    <div className="sol-meta">
                      {s.ubicacion && <span>📍 {s.ubicacion.slice(0, 60)}{s.ubicacion.length > 60 ? "…" : ""}</span>}
                      {s.fecha_hora && <span>🕐 {new Date(s.fecha_hora).toLocaleString("es-VE")}</span>}
                      <span className="date">{new Date(s.fecha_creacion).toLocaleDateString("es-VE")}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        {/* Modal detalle */}
        {detalle && (
          <div className="overlay" onClick={() => setDetalle(null)}>
            <div className="modal modal-detalle" onClick={e => e.stopPropagation()}>
              <div className="detalle-header">
                <span className="prioridad-tag"
                  style={{ background: PRIORIDAD_BG[detalle.prioridad], color: PRIORIDAD_COLOR[detalle.prioridad] }}>
                  {detalle.prioridad}
                </span>
                <button className="btn-ghost" onClick={() => setDetalle(null)}>✕</button>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#9ca3af", letterSpacing: 1, marginBottom: "0.4rem" }}>ESTADO</div>
                {detalle.actividad_estado
                  ? <span style={{
                      padding: "4px 14px", borderRadius: 12, fontSize: "0.85rem", fontWeight: 700,
                      background: ESTADO_BG[detalle.actividad_estado], color: ESTADO_COLOR[detalle.actividad_estado]
                    }}>
                      {detalle.actividad_estado === "En ejecución" ? "✅ En gestión por la Facultad"
                        : detalle.actividad_estado === "Ejecutado" ? "✔ Solicitud atendida"
                        : "⏳ Pendiente de atención"}
                    </span>
                  : <span style={{ padding: "4px 14px", borderRadius: 12, fontSize: "0.85rem", fontWeight: 700, background: "#f3f4f6", color: "#6b7280" }}>
                      ⏳ Pendiente de atención
                    </span>
                }
              </div>
              <DetalleRow label="Descripción"  value={detalle.descripcion} />
              <DetalleRow label="Ubicación"    value={detalle.ubicacion} />
              <DetalleRow label="Fecha / Hora" value={detalle.fecha_hora ? new Date(detalle.fecha_hora).toLocaleString("es-VE") : null} />
              <DetalleRow label="Registrada"   value={new Date(detalle.fecha_creacion).toLocaleString("es-VE")} />
              {detalle.lat && (
                <div style={{ marginTop: "0.75rem" }}>
                  <iframe
                    title="mapa"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${detalle.lng-0.005},${detalle.lat-0.005},${detalle.lng+0.005},${detalle.lat+0.005}&layer=mapnik&marker=${detalle.lat},${detalle.lng}`}
                    width="100%" height="180"
                    style={{ border: "1px solid #e5e7eb", borderRadius: 8, display: "block" }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetalleRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="detalle-row">
      <span className="detalle-label">{label}</span>
      <span className="detalle-value">{value}</span>
    </div>
  );
}

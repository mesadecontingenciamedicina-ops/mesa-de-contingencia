import { useState, useEffect, useRef } from "react";
import { api } from "../api/client";

export default function PanelNotificaciones({ onNotifClick }) {
  const [notifs, setNotifs]   = useState([]);
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  const reload = async () => {
    try { setNotifs(await api.getNotificaciones()); } catch {}
  };

  useEffect(() => {
    reload();
    const t = setInterval(reload, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [abierto]);

  const noLeidas = notifs.filter(n => !n.leida).length;

  const marcar = async (n) => {
    if (!n.leida) { await api.marcarLeida(n.id); reload(); }
    setAbierto(false);
    if (onNotifClick) onNotifClick(n);
  };

  const leerTodas = async () => { await api.leerTodas(); reload(); };

  return (
    <div className="notif-wrap" ref={ref}>
      <button className="notif-bell" onClick={() => setAbierto(v => !v)}>
        🔔
        {noLeidas > 0 && <span className="notif-badge">{noLeidas > 9 ? "9+" : noLeidas}</span>}
      </button>

      {abierto && (
        <div className="notif-panel">
          <div className="notif-header">
            <span>Notificaciones</span>
            {noLeidas > 0 && (
              <button className="btn-ghost" style={{ fontSize: "0.75rem" }} onClick={leerTodas}>
                Marcar todas leídas
              </button>
            )}
          </div>
          {notifs.length === 0
            ? <p className="notif-empty">Sin notificaciones</p>
            : notifs.slice(0, 30).map(n => (
              <div key={n.id}
                className={`notif-item ${n.leida ? "notif-leida" : "notif-nueva"}`}
                onClick={() => marcar(n)}>
                <p className="notif-texto">{n.texto}</p>
                <span className="notif-fecha">
                  {new Date(n.fecha).toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}

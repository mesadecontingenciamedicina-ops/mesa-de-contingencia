import { useState } from "react";
import { useAuth } from "./context/AuthContext";
import Login from "./components/Login";
import ModuloMiembrosGrupos from "./components/ModuloMiembrosGrupos";
import ModuloSolicitudes from "./components/ModuloSolicitudes";
import ModuloActividades from "./components/ModuloActividades";
import ModuloCentros from "./components/ModuloCentros";
import VistaCentro from "./components/VistaCentro";
import PanelNotificaciones from "./components/PanelNotificaciones";
import { api } from "./api/client";
import "./App.css";

const TABS_ADMIN = [
  { id: "miembros",   label: "👥 Miembros y Grupos" },
  { id: "centros",    label: "🏥 Centros" },
  { id: "solicitudes",label: "📥 Solicitudes" },
  { id: "actividades",label: "📊 Actividades" },
];
const TABS_GRUPO = [
  { id: "miembros",   label: "👤 Mi Grupo" },
  { id: "solicitudes",label: "📥 Mis Solicitudes" },
  { id: "actividades",label: "📊 Mis Actividades" },
];

export default function App() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState("solicitudes");
  const [actRefresh, setActRefresh] = useState(0);
  // actividad a abrir directamente desde notificación
  const [abrirActividadId, setAbrirActividadId] = useState(null);

  if (!user) return <Login />;
  if (user.rol === "centro") return <VistaCentro />;

  const notifyChange = () => setActRefresh(v => v + 1);
  const isAdmin = user.rol === "admin";
  const isPrivileged = isAdmin || user.es_coordinador;
  const tabs = isPrivileged
    ? (isAdmin ? TABS_ADMIN : TABS_ADMIN.filter(t => t.id !== "centros"))
    : TABS_GRUPO;

  const handleLogout = async () => {
    try { await api.logout(); } catch {}
    logout();
  };

  const irAActividad = (actividadId) => {
    setTab("actividades");
    setAbrirActividadId(actividadId);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="header-brand">
            <img src="/logo-facmed.png" alt="Logo Facultad de Medicina UCV" className="header-logo" />
            <div>
              <h1>Mesa de Contingencia</h1>
              <p className="subtitle">Facultad de Medicina · UCV</p>
            </div>
          </div>
          <div className="header-user">
            <PanelNotificaciones onAbrirActividad={irAActividad} />
            <span className={`role-badge ${isAdmin ? "role-admin" : user.es_coordinador ? "role-admin" : "role-grupo"}`}>
              {isAdmin ? "🔑 Admin" : user.es_coordinador ? "📡 Coordinador" : "🏷️ " + user.grupo_nombre}
            </span>
            <span className="username-label">{user.username}</span>
            <button className="btn-logout" onClick={handleLogout}>Salir</button>
          </div>
        </div>
        <nav className="nav">
          {tabs.map(t => (
            <button key={t.id} className={`nav-btn ${tab === t.id ? "nav-active" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="main">
        {tab === "miembros"    && <ModuloMiembrosGrupos onDataChange={notifyChange} />}
        {tab === "centros"     && <ModuloCentros />}
        {tab === "solicitudes" && <ModuloSolicitudes onDataChange={notifyChange} />}
        {tab === "actividades" && (
          <ModuloActividades
            refresh={actRefresh}
            abrirActividadId={abrirActividadId}
            onActividadAbierta={() => setAbrirActividadId(null)}
          />
        )}
      </main>
    </div>
  );
}

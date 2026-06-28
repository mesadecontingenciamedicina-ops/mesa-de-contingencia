import { useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, sessionMsg } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token, user } = await api.login(form.username, form.password);
      login(token, user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        <img src="/logo-facmed.png" alt="Facultad de Medicina UCV" className="login-logo-img" />
        <h1 className="login-title">Mesa de Contingencia</h1>
        <p className="login-sub">Facultad de Medicina · UCV</p>

        {sessionMsg && (
          <div className="login-session-msg">⚠️ {sessionMsg}</div>
        )}

        <form onSubmit={submit} className="login-form">
          <label>
            Usuario
            <input
              autoFocus
              value={form.username}
              onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
              placeholder="Ej. admin"
              disabled={loading}
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder="••••••••"
              disabled={loading}
            />
          </label>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="btn-primary login-btn" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}

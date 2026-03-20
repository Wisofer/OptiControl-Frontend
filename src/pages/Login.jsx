import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { User, Eye, EyeOff, ArrowRight, Lock } from "lucide-react";
import { Button } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { SessionLoader } from "../components/SessionLoader";
import { APP_NAME, APP_LOGO_PATH } from "../config/brand.js";

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, sessionLoading, login } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  useEffect(() => {
    if (!loading && user) navigate(location.state?.from?.pathname || "/", { replace: true });
  }, [user, loading, navigate, location.state?.from?.pathname]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await login(form.username.trim(), form.password);
      navigate(location.state?.from?.pathname || "/", { replace: true });
    } catch (e) {
      const msg = e?.message || "";
      if (msg.includes("fetch") || msg.includes("Failed") || msg.includes("Connection") || msg.includes("Network")) {
        setError("No se pudo conectar con el servidor. Verifica que el backend esté en ejecución.");
      } else {
        setError(msg || "Usuario o contraseña incorrectos.");
      }
    }
  };

  if (sessionLoading) return <SessionLoader message="Iniciando sesión..." />;
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary-200 border-t-primary-600 animate-spin" />
          <p className="text-sm text-slate-600">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50">
      {/* Lado izquierdo: mismo azul que el botón Entrar (primary-600) */}
      <div className="hidden lg:flex lg:w-[48%] flex-col justify-between bg-primary-600 p-12">
        <div>
          <img
            src={APP_LOGO_PATH}
            alt={APP_NAME}
            className="h-14 w-auto max-w-[220px] object-contain object-left"
          />
          <p className="mt-2 text-primary-100 text-sm">Panel de administración para ópticas</p>
        </div>
        <div className="space-y-4 max-w-sm">
          <p className="text-xl lg:text-2xl font-semibold text-white leading-snug">
            Administra ventas, inventario, clientes y reportes de tu óptica desde un solo lugar.
          </p>
          <p className="text-primary-100 text-sm">
            Inicia sesión para acceder al panel de control.
          </p>
        </div>
        <div>
          <p className="text-white/60 text-xs">© {new Date().getFullYear()} {APP_NAME}</p>
        </div>
      </div>

      {/* Lado derecho: formulario (mismo fondo que el panel principal del app) */}
      <div className="flex-1 flex items-center justify-center min-h-screen lg:min-h-0 p-6 bg-slate-50 relative">
        <div className="w-full max-w-[400px] relative">
          {/* Logo solo en móvil (mismo estilo que sidebar) */}
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
              <Lock className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold text-primary-600">{APP_NAME}</span>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 lg:p-10">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-800">Iniciar sesión</h1>
              <p className="text-slate-500 text-sm mt-1">Ingresa a tu cuenta para continuar</p>
            </div>

            {error && (
              <div className="mb-5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 px-4 py-3">
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                  Usuario
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <User className="w-5 h-5" />
                  </span>
                  <input
                    type="text"
                    placeholder="Tu usuario"
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    required
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50 pl-11 pr-4 py-3 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-shadow"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock className="w-5 h-5" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    required
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50 pl-11 pr-12 py-3 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-shadow"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2"
                size="lg"
              >
                Entrar
                <ArrowRight className="w-5 h-5" />
              </Button>
            </form>

            <p className="mt-6 text-center text-slate-500 text-xs">
              ¿Problemas para entrar? Contacta al administrador.
            </p>
            <p className="mt-2 text-center text-slate-500 text-xs">
              Desarrollado por{" "}
              <a
                href="https://www.cowib.es"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary-600 hover:text-primary-700 hover:underline"
              >
                COWIB
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

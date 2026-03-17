import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { authApi } from "../api/auth.js";
import { setOnUnauthorized } from "../api/client.js";
import { getToken, setToken, clearToken } from "../api/token.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);

  const checkAuth = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const data = await authApi.me();
      setUser(data);
      return data;
    } catch {
      clearToken();
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => {
      clearToken();
      setUser(null);
    });
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (nombreUsuario, contrasena) => {
    setSessionLoading(true);
    try {
      const data = await authApi.login(nombreUsuario, contrasena);
      if (data?.token) setToken(data.token);
      if (data?.user) setUser(data.user);
      else if (data?.id) setUser(data);
      return data;
    } catch (e) {
      throw e;
    } finally {
      setSessionLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setSessionLoading(true);
    try {
      await authApi.logout();
    } catch (_) {}
    clearToken();
    setUser(null);
    setSessionLoading(false);
  }, []);

  const value = { user, loading, sessionLoading, login, logout, checkAuth };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

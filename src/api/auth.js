import { api } from "./client.js";

export const authApi = {
  login: (nombreUsuario, contrasena) =>
    api.post("/api/auth/login", { nombreUsuario, contrasena }),

  logout: () => api.post("/api/auth/logout"),

  me: () => api.get("/api/auth/me"),
};

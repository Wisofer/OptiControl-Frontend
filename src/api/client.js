import { getApiUrl } from "./config.js";
import { getToken, clearToken } from "./token.js";

let onUnauthorized = () => {};

export function setOnUnauthorized(fn) {
  onUnauthorized = fn;
}

function isLoginRequest(path) {
  return path.includes("/api/auth/login");
}

async function request(path, options = {}) {
  const url = `${getApiUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  const token = getToken();
  if (!isLoginRequest(path) && token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const config = {
    ...options,
    headers,
  };
  if (options.body !== undefined && options.body !== null && !(options.body instanceof FormData)) {
    config.body = JSON.stringify(options.body);
  }
  const res = await fetch(url, config);
  if (res.status === 401) {
    clearToken();
    onUnauthorized();
    throw new Error("No autorizado");
  }
  if (!res.ok) {
    const text = await res.text();
    let errMsg = text;
    try {
      const data = JSON.parse(text);
      errMsg = data.error || data.message || text;
    } catch (_) {}
    throw new Error(errMsg);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (path) => request(path, { method: "GET" }),
  post: (path, body) => request(path, { method: "POST", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
  delete: (path) => request(path, { method: "DELETE" }),
};

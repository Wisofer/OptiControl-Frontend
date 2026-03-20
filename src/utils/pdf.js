import { getToken } from "../api/token.js";

function normalizePdfUrl(pdfUrl) {
  if (!pdfUrl) return pdfUrl;
  // Backend can still return http links; force https for our API host
  // to avoid CORS preflight redirect blocks in both local and production.
  if (/^http:\/\/opticontrol\.cowib\.es/i.test(pdfUrl)) {
    return pdfUrl.replace(/^http:\/\//i, "https://");
  }
  if (window.location.protocol === "https:" && pdfUrl.startsWith("http://")) {
    return pdfUrl.replace(/^http:\/\//i, "https://");
  }
  return pdfUrl;
}

/**
 * Abre un PDF privado usando Bearer token (fetch + blob).
 * Evita 401 por abrir URL protegida directamente y problemas de mixed content.
 */
export async function openProtectedPdf(pdfUrl) {
  if (!pdfUrl) {
    return { ok: false, reason: "missing_url" };
  }
  const normalizedUrl = normalizePdfUrl(pdfUrl);
  try {
    const token = getToken();
    const res = await fetch(normalizedUrl, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      return { ok: false, reason: "http_error", status: res.status };
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const w = window.open(blobUrl, "_blank", "noopener,noreferrer");
    if (!w) {
      URL.revokeObjectURL(blobUrl);
      return { ok: false, reason: "popup_blocked" };
    }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    return { ok: true };
  } catch {
    return { ok: false, reason: "network_error" };
  }
}

export function getPdfOpenErrorMessage(result, fallback = "No se pudo abrir el PDF.") {
  if (!result || result.ok) return "";
  if (result.reason === "popup_blocked") return "Permite ventanas emergentes para abrir el PDF.";
  if (result.reason === "missing_url") return "No hay PDF disponible.";
  if (result.reason === "http_error" && result.status === 401) return "Sesión expirada o no autorizada para abrir este PDF.";
  if (result.reason === "http_error") return `No se pudo abrir el PDF (HTTP ${result.status}).`;
  if (result.reason === "network_error") return "Error de red al abrir el PDF.";
  return fallback;
}

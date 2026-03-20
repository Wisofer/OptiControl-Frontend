export function getStatusRaw(sale) {
  return String(sale?.status ?? "").trim();
}

export function getStatusCanonical(sale) {
  const normalized = getStatusRaw(sale)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (!normalized) return "pagada";
  if (["pagada", "pagado", "completada", "completado"].includes(normalized)) return "pagada";
  if (["pendiente", "parcial"].includes(normalized)) return "pendiente";
  if (["cotizacion", "quote"].includes(normalized)) return "cotizacion";
  if (["cancelada", "cancelado", "anulada", "anulado"].includes(normalized)) return "cancelada";
  return normalized;
}

export function getSaleCurrency(sale) {
  return String(sale?.currency || "NIO").toUpperCase() === "USD" ? "USD" : "NIO";
}

export function getEffectiveExchangeRate(sale, fallbackRate = 36.8) {
  const n = Number(sale?.exchangeRate ?? fallbackRate);
  return Number.isFinite(n) && n > 0 ? n : 36.8;
}

export function convertAmountBetweenCurrencies(amount, fromCurrency, toCurrency, sale, fallbackRate = 36.8) {
  if (fromCurrency === toCurrency) return amount;
  const rate = getEffectiveExchangeRate(sale, fallbackRate);
  if (fromCurrency === "USD" && toCurrency === "NIO") return amount * rate;
  if (fromCurrency === "NIO" && toCurrency === "USD") return amount / rate;
  return amount;
}

export function getPaymentTypeLabel(payment) {
  const raw = String(
    payment?.type ?? payment?.paymentType ?? payment?.payment_method ?? payment?.paymentMethod ?? payment?.method ?? ""
  )
    .trim()
    .toLowerCase();
  if (!raw) return "—";
  if (["fisico", "físico", "efectivo", "cash"].includes(raw)) return "💵 Físico";
  if (["tarjeta", "card"].includes(raw)) return "💳 Tarjeta";
  if (["transferencia", "transfer", "bank_transfer"].includes(raw)) return "🏦 Transferencia";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function getPaymentsHistory(sale) {
  const list = sale?.paymentHistory || sale?.payments || [];
  return Array.isArray(list) ? list : [];
}

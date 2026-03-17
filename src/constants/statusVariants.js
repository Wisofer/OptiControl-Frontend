/**
 * Variantes de Badge por estado (pago, venta, factura, historial).
 * Uso: <Badge variant={STATUS_VARIANT[status] || "default"}>
 */
export const STATUS_VARIANT = {
  Pagado: "success",
  Completado: "success",
  Pendiente: "warning",
  Parcial: "info",
  Vencida: "danger",
};

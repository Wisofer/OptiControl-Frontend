import { useState } from "react";
import { History, Eye, Printer, Ban, PlusCircle, MessageCircle } from "lucide-react";
import {
  Card,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  Modal,
  EmptyState,
  TableSkeleton,
  Pagination,
  ConfirmModal,
  Button,
  Badge,
} from "../components/ui";
import { useSalesHistory } from "../hooks/useSalesHistory";
import { useSettings } from "../hooks/useSettings";
import { useSnackbar } from "../contexts/SnackbarContext";
import { openProtectedPdf, getPdfOpenErrorMessage } from "../utils/pdf";
import { formatCurrency, formatDate } from "../utils/format";
import { STATUS_VARIANT } from "../constants/statusVariants";
import { cn } from "../utils/cn";

export function Historial() {
  const { sales, loading, error, totalCount, totalPages, page, pageSize, setPage, cancel, addPayment, createOrReuseInvoice, getTicketPdfUrl } = useSalesHistory();
  const { settings } = useSettings();
  const snackbar = useSnackbar();
  const [detailSale, setDetailSale] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);

  const itemsSummary = (s) => {
    const items = s.items || [];
    if (items.length === 0) return "—";
    const name = (i) => i.productName || i.serviceName || "Ítem";
    if (items.length === 1) return `${name(items[0])} (x${items[0].quantity})`;
    return `${items.length} ítems`;
  };

  const handlePrintTicket = async (sale) => {
    if (!sale) return;
    const ticketName = `ticket_${sale.id}.pdf`;
    const direct = await openProtectedPdf(sale.saleTicketPdfUrl, { filename: ticketName });
    if (direct.ok) {
      if (direct.fallback === "download") {
        snackbar.success("Se descargó el PDF. Ábrelo e imprime con Ctrl+P (ventana emergente bloqueada).");
      }
      return;
    }
    try {
      const res = await getTicketPdfUrl(sale.id);
      const byEndpoint = await openProtectedPdf(res?.pdfUrl, { filename: ticketName });
      if (byEndpoint.ok) {
        if (byEndpoint.fallback === "download") {
          snackbar.success("Se descargó el PDF. Ábrelo e imprime con Ctrl+P (ventana emergente bloqueada).");
        }
        return;
      }
      snackbar.error(getPdfOpenErrorMessage(byEndpoint, "No hay ticket PDF disponible para esta venta/cotización."));
      return;
    } catch (_) {
      // Intentamos URL auxiliar y luego mostramos error.
    }
    snackbar.error("No hay ticket PDF disponible para esta venta/cotización.");
  };

  const handlePrintInvoice = async (sale) => {
    if (!sale) return;
    if (isCotizacion(sale) || isCancelada(sale)) {
      handlePrintTicket(sale);
      return;
    }
    const invName = `factura_${sale.invoiceId || sale.id}.pdf`;
    const fromSale = await openProtectedPdf(sale.invoicePdfUrl, { filename: invName });
    if (fromSale.ok) {
      if (fromSale.fallback === "download") {
        snackbar.success("Se descargó la factura. Ábrela e imprime con Ctrl+P (ventana emergente bloqueada).");
      }
      return;
    }
    try {
      const inv = await createOrReuseInvoice(sale.id);
      const fromEndpoint = await openProtectedPdf(inv?.pdfUrl, { filename: invName });
      if (fromEndpoint.ok) {
        if (fromEndpoint.fallback === "download") {
          snackbar.success(
            inv?.reused
              ? "Factura reutilizada. Se descargó el PDF; ábrelo e imprime con Ctrl+P (ventana emergente bloqueada)."
              : "Se descargó la factura. Ábrela e imprime con Ctrl+P (ventana emergente bloqueada)."
          );
        } else if (inv?.reused) {
          snackbar.success("Se reutilizó la factura existente.");
        }
        return;
      }
      snackbar.error(getPdfOpenErrorMessage(fromEndpoint, "No fue posible obtener la factura PDF desde backend."));
      return;
    } catch (_) {
      // Si el backend no puede generar/reusar factura, mostramos error.
    }
    snackbar.error("No fue posible obtener la factura PDF desde backend.");
  };

  const handlePrint = async (sale) => {
    if (!sale) return;
    if (!isCotizacion(sale) && !isCancelada(sale) && (sale.invoicePdfUrl || sale.invoiceId)) {
      await handlePrintInvoice(sale);
      return;
    }
    await handlePrintTicket(sale);
  };

  const handleWhatsAppFactura = (sale) => {
    if (!sale) return;
    const companyName = settings?.companyName?.trim() || "OptiControl";
    const moneda = sale.currency || "NIO";
    const isQuote = (sale.status || "").toLowerCase() === "cotizacion";
    const documentTitle = isQuote ? "Cotización" : "Factura / Recibo";
    const footerText = isQuote ? "Documento de cotización." : "Gracias por su compra.";
    const fecha = sale.date ? new Date(sale.date).toLocaleString("es-NI") : "—";
    const lines = [
      `*${companyName}*`,
      documentTitle,
      "",
      `Cliente: ${sale.clientName || "—"}`,
      `Fecha: ${fecha}`,
      `Forma de pago: ${sale.paymentMethod || "Efectivo"}`,
      "",
      "Productos / Servicios:",
      ...(sale.items || []).map((it) => {
        const name = it.productName || it.serviceName || "—";
        return `• ${name} x${it.quantity} — ${formatCurrency(it.subtotal, moneda)}`;
      }),
      "",
      `*Total: ${formatCurrency(sale.total ?? 0, moneda)}*`,
      "",
      ...(!isQuote && sale.invoicePublicPdfUrl ? [`Ver PDF: ${sale.invoicePublicPdfUrl}`, ""] : []),
      footerText,
    ];
    const text = lines.join("\n");
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    snackbar.success("Se abrió WhatsApp con la factura. Elija el contacto para enviar (simulación).");
  };

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setCancelLoading(true);
    try {
      await cancel(cancelTarget.id);
      setCancelTarget(null);
      snackbar.success("Venta cancelada. El stock se ha restaurado.");
    } catch (err) {
      snackbar.error(err?.message || "Error al cancelar la venta");
    }
    setCancelLoading(false);
  };

  const getStatus = (s) => s.status || "Pagada";
  const isPagada = (s) => getStatus(s) === "Pagada";
  const isPendiente = (s) => getStatus(s) === "pendiente";
  const isCotizacion = (s) => getStatus(s) === "cotizacion";
  const isCancelada = (s) => getStatus(s) === "Cancelada";
  const isRealSale = (s) => isPagada(s) || isPendiente(s);

  const getStatusLabel = (s) => {
    const st = getStatus(s);
    if (st === "cotizacion") return "Cotización";
    if (st === "pendiente") return "Pendiente";
    if (st === "Pagada") return "Pagada";
    return "Cancelada";
  };

  const getPagado = (s) => Number(s.amountPaid) || 0;
  const getPendiente = (s) => Math.max(0, (s.total || 0) - getPagado(s));

  const handleAddPaymentSubmit = async () => {
    if (!paymentTarget) return;
    const amount = parseFloat(String(paymentAmount).replace(",", ".").trim());
    if (!Number.isFinite(amount) || amount <= 0) {
      snackbar.error("Ingresa un monto válido");
      return;
    }
    setPaymentLoading(true);
    try {
      await addPayment(paymentTarget.id, amount);
      setPaymentTarget(null);
      setPaymentAmount("");
      snackbar.success("Abono registrado");
    } catch (err) {
      snackbar.error(err?.message || "Error al registrar el abono");
    }
    setPaymentLoading(false);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400">
            <History className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Historial</h1>
            <p className="text-slate-600 dark:text-slate-300">Ventas realizadas</p>
          </div>
        </div>
      </header>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
      )}

      <Card>
        {loading && !sales.length ? (
          <TableSkeleton columns={8} rows={8} />
        ) : sales.length === 0 ? (
          <EmptyState
            message="No hay ventas registradas"
            description="Las ventas que registres en la sección Ventas aparecerán aquí."
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Fecha</TableHeaderCell>
                    <TableHeaderCell>Cliente</TableHeaderCell>
                    <TableHeaderCell>Ítems</TableHeaderCell>
                    <TableHeaderCell className="text-right">Total</TableHeaderCell>
                    <TableHeaderCell className="text-right">Pagado</TableHeaderCell>
                    <TableHeaderCell className="text-right">Pendiente</TableHeaderCell>
                    <TableHeaderCell>Estado</TableHeaderCell>
                    <TableHeaderCell className="w-40">Acciones</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sales.map((s) => (
                    <TableRow key={s.id} className={isCancelada(s) ? "opacity-75" : ""}>
                      <TableCell className="whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {formatDate((s.date || "").slice(0, 10))}
                      </TableCell>
                      <TableCell className="font-medium text-slate-800 dark:text-slate-100">{s.clientName}</TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-300 max-w-[180px] truncate" title={itemsSummary(s)}>
                        {itemsSummary(s)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(s.total)}</TableCell>
                      <TableCell className="text-right tabular-nums text-slate-600 dark:text-slate-400">{formatCurrency(getPagado(s))}</TableCell>
                      <TableCell className="text-right tabular-nums text-amber-600 dark:text-amber-400">{formatCurrency(getPendiente(s))}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[getStatus(s)] || "default"}>
                          {getStatusLabel(s)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDetailSale(s)}
                            className="rounded-lg p-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
                            title="Ver detalle"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {(isPagada(s) || isPendiente(s) || isCotizacion(s)) && (
                            <>
                              <button
                                type="button"
                                onClick={() => handlePrint(s)}
                                className="rounded-lg p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title={
                                  isCotizacion(s)
                                    ? "Imprimir ticket de cotización"
                                    : (s.invoicePdfUrl || s.invoiceId)
                                      ? "Imprimir factura"
                                      : "Imprimir ticket"
                                }
                              >
                                <Printer className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleWhatsAppFactura(s)}
                                className="rounded-lg p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                                title={isCotizacion(s) ? "Enviar cotización por WhatsApp" : "Enviar factura por WhatsApp"}
                              >
                                <MessageCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {isPendiente(s) && (
                            <button
                              type="button"
                              onClick={() => { setPaymentTarget(s); setPaymentAmount(""); }}
                              className="rounded-lg p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                              title="Agregar pago"
                            >
                              <PlusCircle className="h-4 w-4" />
                            </button>
                          )}
                          {!isCancelada(s) && (
                            <button
                              type="button"
                              onClick={() => setCancelTarget(s)}
                              className="rounded-lg p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                              title="Cancelar venta"
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={pageSize}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </Card>

      <ConfirmModal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelConfirm}
        title="Cancelar venta"
        message={cancelTarget ? `¿Cancelar la venta ${cancelTarget.id} de ${cancelTarget.clientName} (${formatCurrency(cancelTarget.total)})?${isRealSale(cancelTarget) ? " Se restaurará el stock." : ""} El registro permanecerá como "Cancelada".` : ""}
        confirmLabel="Sí, cancelar venta"
        loading={cancelLoading}
      />

      <Modal open={!!paymentTarget} onClose={() => { setPaymentTarget(null); setPaymentAmount(""); }} title="Agregar pago" size="sm">
        {paymentTarget && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Venta {paymentTarget.id} · {paymentTarget.clientName}. Pendiente: {formatCurrency(getPendiente(paymentTarget))}.
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Monto a abonar (C$)</label>
              <input
                type="text"
                inputMode="decimal"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Ej: 500"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-800 dark:text-slate-100 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => { setPaymentTarget(null); setPaymentAmount(""); }}>Cancelar</Button>
              <Button onClick={handleAddPaymentSubmit} disabled={paymentLoading || !paymentAmount.trim()}>
                {paymentLoading ? "Guardando…" : "Registrar abono"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!detailSale} onClose={() => setDetailSale(null)} title="Detalle de venta" size="md">
        {detailSale && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-slate-500">Cliente:</span>
              <span className="font-medium">{detailSale.clientName}</span>
              <span className="text-slate-500">Fecha:</span>
              <span>{detailSale.date ? new Date(detailSale.date).toLocaleString("es-NI") : "—"}</span>
              <span className="text-slate-500">Estado:</span>
              <span>
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  isPagada(detailSale) && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
                  isPendiente(detailSale) && "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
                  isCotizacion(detailSale) && "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
                  isCancelada(detailSale) && "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                )}>
                  {getStatusLabel(detailSale)}
                </span>
              </span>
              {(isPagada(detailSale) || isPendiente(detailSale)) && (
                <>
                  <span className="text-slate-500">Pagado:</span>
                  <span className="tabular-nums">{formatCurrency(getPagado(detailSale))}</span>
                  <span className="text-slate-500">Pendiente:</span>
                  <span className="tabular-nums">{formatCurrency(getPendiente(detailSale))}</span>
                </>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Productos y servicios</p>
              <ul className="space-y-2 border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-800">
                {(detailSale.items || []).map((it, i) => (
                  <li key={i} className="flex justify-between px-3 py-2 text-sm">
                    <span>{(it.productName || it.serviceName || "—")} × {it.quantity}</span>
                    <span className="tabular-nums font-medium">{formatCurrency(it.subtotal)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-lg font-bold border-t border-slate-200 dark:border-slate-700 pt-3">
              Total: {formatCurrency(detailSale.total)}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

import { useState } from "react";
import { History, Eye, Printer, Ban, PlusCircle, MessageCircle, Search } from "lucide-react";
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
  const [search, setSearch] = useState("");
  const { sales, loading, error, totalCount, totalPages, page, pageSize, setPage, cancel, addPayment, createOrReuseInvoice, getTicketPdfUrl } = useSalesHistory(search);
  const { settings } = useSettings();
  const snackbar = useSnackbar();
  const [detailSale, setDetailSale] = useState(null);
  const [detailTab, setDetailTab] = useState("items");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentCurrency, setPaymentCurrency] = useState("NIO");
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

  const getStatusRaw = (s) => String(s?.status ?? "").trim();
  const getStatusCanonical = (s) => {
    const normalized = getStatusRaw(s)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (!normalized) return "pagada";
    if (["pagada", "pagado", "completada", "completado"].includes(normalized)) return "pagada";
    if (["pendiente", "parcial"].includes(normalized)) return "pendiente";
    if (["cotizacion", "quote"].includes(normalized)) return "cotizacion";
    if (["cancelada", "cancelado", "anulada", "anulado"].includes(normalized)) return "cancelada";
    return normalized;
  };
  const isPagada = (s) => getStatusCanonical(s) === "pagada";
  const isPendiente = (s) => getStatusCanonical(s) === "pendiente";
  const isCotizacion = (s) => getStatusCanonical(s) === "cotizacion";
  const isCancelada = (s) => getStatusCanonical(s) === "cancelada";
  const isRealSale = (s) => isPagada(s) || isPendiente(s);

  const getStatusBadgeVariant = (s) => {
    const canonical = getStatusCanonical(s);
    if (canonical === "pagada") return STATUS_VARIANT.Pagada;
    if (canonical === "pendiente") return STATUS_VARIANT.pendiente;
    if (canonical === "cotizacion") return STATUS_VARIANT.cotizacion;
    if (canonical === "cancelada") return STATUS_VARIANT.Cancelada;
    return STATUS_VARIANT[getStatusRaw(s)] || "default";
  };

  const getStatusLabel = (s) => {
    const canonical = getStatusCanonical(s);
    if (canonical === "cotizacion") return "Cotización";
    if (canonical === "pendiente") return "Pendiente";
    if (canonical === "pagada") return "Pagada";
    if (canonical === "cancelada") return "Cancelada";
    const raw = getStatusRaw(s);
    return raw || "Pagada";
  };

  const getPagado = (s) => Number(s.amountPaid) || 0;
  const getPendiente = (s) => Math.max(0, (s.total || 0) - getPagado(s));
  const getSaleCurrency = (s) => (String(s?.currency || "NIO").toUpperCase() === "USD" ? "USD" : "NIO");
  const getEffectiveExchangeRate = (s) => {
    const n = Number(s?.exchangeRate ?? settings?.exchangeRate);
    return Number.isFinite(n) && n > 0 ? n : 36.8;
  };
  const convertAmountBetweenCurrencies = (amount, fromCurrency, toCurrency, sale) => {
    if (fromCurrency === toCurrency) return amount;
    const rate = getEffectiveExchangeRate(sale);
    if (fromCurrency === "USD" && toCurrency === "NIO") return amount * rate;
    if (fromCurrency === "NIO" && toCurrency === "USD") return amount / rate;
    return amount;
  };
  const getPaymentTypeLabel = (p) => {
    const raw = String(
      p?.type ?? p?.paymentType ?? p?.payment_method ?? p?.paymentMethod ?? p?.method ?? ""
    )
      .trim()
      .toLowerCase();
    if (!raw) return "—";
    if (["fisico", "físico", "efectivo", "cash"].includes(raw)) return "💵 Físico";
    if (["tarjeta", "card"].includes(raw)) return "💳 Tarjeta";
    if (["transferencia", "transfer", "bank_transfer"].includes(raw)) return "🏦 Transferencia";
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  };
  const getPaymentsHistory = (s) => {
    const list = s?.paymentHistory || s?.payments || [];
    return Array.isArray(list) ? list : [];
  };
  const getParsedPaymentAmount = () => {
    const n = parseFloat(String(paymentAmount).replace(",", ".").trim());
    return Number.isFinite(n) ? n : 0;
  };
  const getPaymentMaxInSelectedCurrency = () => {
    if (!paymentTarget) return 0;
    return convertAmountBetweenCurrencies(
      getPendiente(paymentTarget),
      getSaleCurrency(paymentTarget),
      paymentCurrency,
      paymentTarget
    );
  };
  const getPaymentChangeInSelectedCurrency = () => {
    if (!paymentTarget) return 0;
    const amount = getParsedPaymentAmount();
    if (!(amount > 0)) return 0;
    return Math.max(0, amount - getPaymentMaxInSelectedCurrency());
  };
  const getPaymentChangeDisplay = () => {
    const changeInSelected = getPaymentChangeInSelectedCurrency();
    if (!(changeInSelected > 0)) return null;
    if (paymentCurrency === "USD") {
      const rate = getEffectiveExchangeRate(paymentTarget);
      return {
        mainAmount: changeInSelected * rate,
        mainCurrency: "NIO",
        secondaryAmount: changeInSelected,
        secondaryCurrency: "USD",
      };
    }
    return {
      mainAmount: changeInSelected,
      mainCurrency: paymentCurrency,
      secondaryAmount: null,
      secondaryCurrency: null,
    };
  };

  const handleAddPaymentSubmit = async () => {
    if (!paymentTarget) return;
    const amount = parseFloat(String(paymentAmount).replace(",", ".").trim());
    if (!Number.isFinite(amount) || amount <= 0) {
      snackbar.error("Ingresa un monto válido");
      return;
    }
    setPaymentLoading(true);
    try {
      const saleCurrency = getSaleCurrency(paymentTarget);
      const pendienteEnMonedaVenta = getPendiente(paymentTarget);
      const amountInSaleCurrency = convertAmountBetweenCurrencies(amount, paymentCurrency, saleCurrency, paymentTarget);
      const amountToApply = Math.min(amountInSaleCurrency, pendienteEnMonedaVenta);
      await addPayment(paymentTarget.id, amountToApply, {
        paymentType: paymentCurrency === "USD" ? "Dolares" : "Cordobas",
      });
      const vuelto = getPaymentChangeDisplay();
      setPaymentTarget(null);
      setPaymentAmount("");
      setPaymentCurrency("NIO");
      snackbar.success(
        vuelto && vuelto.mainAmount > 0
          ? `Pago aplicado por ${formatCurrency(
              convertAmountBetweenCurrencies(amountToApply, saleCurrency, paymentCurrency, paymentTarget),
              paymentCurrency
            )}. Vuelto a devolver: ${formatCurrency(vuelto.mainAmount, vuelto.mainCurrency)}.`
          : "Abono registrado"
      );
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
        <div className="mb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="search"
              placeholder="Buscar por cliente o producto/servicio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              aria-label="Buscar en historial"
            />
          </div>
        </div>
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
                    <TableHeaderCell>Productos/Servicios</TableHeaderCell>
                    <TableHeaderCell className="text-right">Total</TableHeaderCell>
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
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(s)}>
                          {getStatusLabel(s)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setDetailSale(s);
                              setDetailTab("items");
                            }}
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

      <Modal
        open={!!paymentTarget}
        onClose={() => {
          setPaymentTarget(null);
          setPaymentAmount("");
          setPaymentCurrency("NIO");
        }}
        title="Agregar pago"
        size="sm"
      >
        {paymentTarget && (
          <div className="space-y-4">
            <div className="rounded-xl bg-sky-600/90 text-white px-4 py-3">
              <p className="text-sm font-semibold">
                Factura: {paymentTarget.invoiceId || paymentTarget.id || "—"}
              </p>
              <p className="text-sm mt-0.5">
                Saldo pendiente:{" "}
                <span className="font-semibold">
                  {formatCurrency(
                    convertAmountBetweenCurrencies(
                      getPendiente(paymentTarget),
                      getSaleCurrency(paymentTarget),
                      paymentCurrency,
                      paymentTarget
                    ),
                    paymentCurrency
                  )}
                </span>
              </p>
              <p className="text-xs text-sky-100 mt-1.5">
                Puede registrar un abono parcial ingresando un monto menor al saldo pendiente.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                Moneda
              </label>
              <input
                type="hidden"
                value={paymentCurrency}
                readOnly
              />
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={paymentCurrency === "NIO" ? "default" : "secondary"}
                  onClick={() => setPaymentCurrency("NIO")}
                  className={cn(
                    "w-full border-2",
                    paymentCurrency === "NIO"
                      ? "border-primary-600 ring-2 ring-primary-300/60 dark:ring-primary-700/50"
                      : "border-slate-300 dark:border-slate-600"
                  )}
                >
                  C$ Córdobas
                </Button>
                <Button
                  type="button"
                  variant={paymentCurrency === "USD" ? "default" : "secondary"}
                  onClick={() => setPaymentCurrency("USD")}
                  className={cn(
                    "w-full border-2",
                    paymentCurrency === "USD"
                      ? "border-primary-600 ring-2 ring-primary-300/60 dark:ring-primary-700/50"
                      : "border-slate-300 dark:border-slate-600"
                  )}
                >
                  $ Dólares
                </Button>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                TC: C$ {getEffectiveExchangeRate(paymentTarget).toFixed(2)} = $1
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                Monto recibido
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder={paymentCurrency === "USD" ? "0.00" : "0.00"}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-xl font-semibold tabular-nums text-slate-800 dark:text-slate-100 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Pendiente actual:{" "}
                {formatCurrency(
                  getPaymentMaxInSelectedCurrency(),
                  paymentCurrency
                )}
              </p>
              {getPaymentChangeDisplay() && (
                <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                  Vuelto a devolver
                  {paymentCurrency === "USD" ? " (en córdobas)" : ""}:{" "}
                  {formatCurrency(getPaymentChangeDisplay().mainAmount, getPaymentChangeDisplay().mainCurrency)}
                </p>
              )}
              {getPaymentChangeDisplay()?.secondaryAmount != null && (
                <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                  equivale a {formatCurrency(getPaymentChangeDisplay().secondaryAmount, getPaymentChangeDisplay().secondaryCurrency)}
                </p>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setPaymentTarget(null);
                  setPaymentAmount("");
                  setPaymentCurrency("NIO");
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleAddPaymentSubmit} disabled={paymentLoading || !paymentAmount.trim()}>
                {paymentLoading ? "Guardando…" : "Registrar abono"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!detailSale} onClose={() => setDetailSale(null)} title="Detalles de Factura" size="3xl">
        {detailSale && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Información completa de la factura</p>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5">
                <p className="text-xs text-slate-500 dark:text-slate-400">Estado</p>
                <div className="mt-1">
                  <Badge variant={getStatusBadgeVariant(detailSale)}>{getStatusLabel(detailSale)}</Badge>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5">
                <p className="text-xs text-slate-500 dark:text-slate-400">Monto Total</p>
                <p className="mt-1 font-semibold tabular-nums">{formatCurrency(detailSale.total || 0, detailSale.currency || "NIO")}</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5">
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Pagado</p>
                <p className="mt-1 font-semibold tabular-nums">{formatCurrency(getPagado(detailSale), detailSale.currency || "NIO")}</p>
              </div>
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-900/20 px-3 py-2.5">
                <p className="text-xs text-amber-700 dark:text-amber-300">Saldo Pendiente</p>
                <p className="mt-1 font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                  {formatCurrency(getPendiente(detailSale), detailSale.currency || "NIO")}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                <p><span className="text-slate-500 dark:text-slate-400">Cliente:</span> <span className="font-medium">{detailSale.clientName || "Cliente General"}</span></p>
                <p><span className="text-slate-500 dark:text-slate-400">Tipo:</span> <span className="font-medium">{isCotizacion(detailSale) ? "Cotización" : "Venta"}</span></p>
                <p><span className="text-slate-500 dark:text-slate-400">Fecha:</span> <span className="font-medium">{detailSale.date ? new Date(detailSale.date).toLocaleString("es-NI") : "—"}</span></p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="border-b border-slate-200 dark:border-slate-700 p-2">
                <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setDetailTab("items")}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium",
                      detailTab === "items"
                        ? "bg-primary-600 text-white"
                        : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300"
                    )}
                  >
                    Productos/Servicios
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailTab("payments")}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium border-l border-slate-200 dark:border-slate-700",
                      detailTab === "payments"
                        ? "bg-primary-600 text-white"
                        : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300"
                    )}
                  >
                    Historial de Pagos
                  </button>
                </div>
              </div>

              <div className="p-3">
                {detailTab === "items" ? (
                  <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-800">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800/60">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-slate-600 dark:text-slate-300">Descripción</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-600 dark:text-slate-300">Cantidad</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-600 dark:text-slate-300">Precio Unit.</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-600 dark:text-slate-300">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detailSale.items || []).map((it, i) => {
                          const qty = Number(it.quantity) || 0;
                          const subtotal = Number(it.subtotal) || 0;
                          const unit = qty > 0 ? subtotal / qty : Number(it.unitPrice || 0);
                          return (
                            <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                              <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{it.productName || it.serviceName || "—"}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{qty}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(unit, detailSale.currency || "NIO")}</td>
                              <td className="px-3 py-2 text-right tabular-nums font-medium">{formatCurrency(subtotal, detailSale.currency || "NIO")}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <>
                    {getPaymentsHistory(detailSale).length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">No hay pagos registrados en el historial.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-800">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-800/60">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium text-slate-600 dark:text-slate-300">Fecha</th>
                              <th className="text-right px-3 py-2 font-medium text-slate-600 dark:text-slate-300">Monto</th>
                              <th className="text-left px-3 py-2 font-medium text-slate-600 dark:text-slate-300">Tipo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getPaymentsHistory(detailSale).map((p, idx) => (
                              <tr key={idx} className="border-t border-slate-100 dark:border-slate-800">
                                <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                                  {p?.date || p?.createdAt ? new Date(p.date || p.createdAt).toLocaleString("es-NI") : "—"}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums font-medium">
                                  {formatCurrency(Number(p?.amount ?? p?.monto ?? 0), detailSale.currency || "NIO")}
                                </td>
                                <td className="px-3 py-2">{getPaymentTypeLabel(p)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-700 pt-3 -mx-6 px-6 flex flex-col sm:flex-row justify-end gap-2">
              {isPendiente(detailSale) && (
                <Button
                  onClick={() => {
                    setDetailSale(null);
                    setPaymentTarget(detailSale);
                    setPaymentAmount("");
                    setPaymentCurrency(getSaleCurrency(detailSale));
                  }}
                  className="inline-flex items-center justify-center gap-2"
                >
                  <PlusCircle className="h-4 w-4" />
                  Registrar pago
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => handlePrint(detailSale)}
                className="inline-flex items-center justify-center gap-2"
              >
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

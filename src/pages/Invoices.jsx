import { useState, useMemo } from "react";
import {
  Plus,
  Search,
  FileSpreadsheet,
  FileText,
  Pencil,
  Trash2,
  Printer,
  User,
  CalendarDays,
  Banknote,
  Plane,
} from "lucide-react";
import { Card, Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell, Badge, Button, Modal, EmptyState, ConfirmModal, TableSkeleton, Pagination } from "../components/ui";
import { useToggle } from "../hooks/useToggle";
import { useInvoices } from "../hooks/useInvoices";
import { useClients } from "../hooks/useClients";
import { useSnackbar } from "../contexts/SnackbarContext";
import { formatCurrency, formatDate, formatAmountByPaymentMethod } from "../utils/format";
import { buildInvoiceWhatsAppMessage } from "../utils/whatsappMessage";
import { invoicesApi } from "../api/invoices";
import { whatsappTemplatesApi } from "../api/whatsappTemplates";
import { useExport } from "../hooks/useExport";
import { cn } from "../utils/cn";
import { formatPaymentMethod, toPaymentMethodApiValue, normalizePaymentMethodForForm, PAYMENT_METHOD_FILTER_OPTIONS, PAYMENT_METHODS_WITH_ICONS, PAYMENT_METHOD_API } from "../utils/paymentMethod";
import { STATUS_VARIANT } from "../constants/statusVariants";

const invoiceColumns = [
  { key: "id", label: "Factura" },
  { key: "clientName", label: "Cliente" },
  { key: "date", label: "Fecha" },
  { key: "amount", label: "Monto" },
  { key: "status", label: "Estado" },
];

async function sendInvoiceWhatsApp(inv, clients, clientNameFn, snackbar) {
  const client = clients.find((c) => c.id === inv.clientId || c.id === Number(inv.clientId));
  const phone = client?.phone?.replace(/\D/g, "")?.trim();
  if (!phone || phone.length < 8) {
    snackbar.error("El cliente no tiene teléfono registrado. Agregue un número en Clientes.");
    return;
  }
  const num = phone.startsWith("505") ? phone : "505" + phone;
  const name = clientNameFn(inv);

  try {
    const [templateRes, pdfRes] = await Promise.all([
      whatsappTemplatesApi.getDefault(),
      invoicesApi.getPdfUrl(inv.id).catch(() => ({ pdfUrl: "" })),
    ]);
    const template = templateRes?.mensaje ?? "Hola {NombreCliente}, adjuntamos su factura {NumeroFactura}. Monto: C$" + "{Monto}. Descargar: {EnlacePDF}. Gracias.";
    const pdfUrl = pdfRes?.pdfUrl ?? "";
    const message = buildInvoiceWhatsAppMessage(template, {
      invoice: inv,
      clientName: name,
      clientId: inv.clientId ?? client?.id,
      pdfUrl,
    });
    const text = encodeURIComponent(message);
    window.open(`https://wa.me/${num}?text=${text}`, "_blank");
  } catch (err) {
    snackbar.error(err?.message || "Error al preparar el mensaje de WhatsApp");
  }
}

async function printInvoice(inv, snackbar) {
  try {
    const blob = await invoicesApi.getPdf(inv.id);
    const blobUrl = URL.createObjectURL(blob);
    const w = window.open(blobUrl, "_blank");
    if (!w) {
      // Fallback: si el popup está bloqueado, forzamos descarga usando el Blob.
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `Factura_${inv.id || "INV"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      snackbar.success("Descarga iniciada. Si quieres imprimir, abre el PDF y usa Ctrl+P.");
      return;
    }
    const tryPrint = () => {
      try {
        w.print();
        w.onafterprint = () => w.close();
      } catch (_) {}
    };
    w.onload = tryPrint;
    setTimeout(tryPrint, 800);
    snackbar.success("Se abrió la factura. Si no se abre el diálogo de impresión, usa Ctrl+P.");
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } catch (err) {
    snackbar.error(err?.message || "Error al abrir la factura para imprimir");
  }
}

const emptyForm = () => ({
  clientId: "",
  date: new Date().toISOString().slice(0, 10),
  dueDate: "",
  travelDate: "",
  returnDate: "",
  concept: "",
  amount: "",
  status: "Pendiente",
  paymentMethod: "Cordobas",
  sendByWhatsApp: false,
  printOnCreate: true,
});

export function Invoices() {
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const filters = useMemo(
    () => (paymentMethodFilter === "all" ? {} : { paymentMethod: paymentMethodFilter }),
    [paymentMethodFilter]
  );
  const { invoices, loading, error, totalCount, totalPages, page, pageSize, setPage, create, update, remove } = useInvoices(filters);
  const { clients } = useClients("");
  const snackbar = useSnackbar();
  const { exportLoading, handleExportExcel, handleExportPdf } = useExport(
    "/api/invoices",
    () => ({ ...filters }),
    "Facturas.xlsx",
    "Facturas.pdf"
  );
  const [modalOpen, setModalOpen] = useToggle(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (inv) => {
    setEditingId(inv.id);
    setForm({
      clientId: String(inv.clientId ?? inv.client?.id ?? ""),
      date: inv.date ? (inv.date.slice ? inv.date.slice(0, 10) : inv.date) : new Date().toISOString().slice(0, 10),
      dueDate: inv.dueDate ? (inv.dueDate.slice ? inv.dueDate.slice(0, 10) : inv.dueDate) : "",
      travelDate: inv.travelDate ? (inv.travelDate.slice ? inv.travelDate.slice(0, 10) : inv.travelDate) : "",
      returnDate: inv.returnDate ? (inv.returnDate.slice ? inv.returnDate.slice(0, 10) : inv.returnDate) : "",
      concept: inv.concept ?? "",
      amount: inv.amount ?? "",
      status: inv.status ?? "Pendiente",
      paymentMethod: normalizePaymentMethodForForm(inv.paymentMethod) ?? "",
      sendByWhatsApp: false,
      printOnCreate: false,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const body = {
        clientId: Number(form.clientId),
        date: form.date,
        dueDate: form.dueDate || form.date,
        travelDate: form.travelDate || undefined,
        returnDate: form.returnDate || undefined,
        amount: Number(form.amount),
        status: form.status,
        concept: form.concept || "Encomienda",
        paymentMethod: toPaymentMethodApiValue(form.paymentMethod),
      };
      if (editingId) {
        await update(editingId, body);
        setEditingId(null);
        snackbar.success("Factura actualizada");
      } else {
        const newInv = await create(body);
        snackbar.success("Factura creada");
        if (form.sendByWhatsApp) setTimeout(() => sendInvoiceWhatsApp(newInv, clients, clientName, snackbar), 300);
        if (form.printOnCreate) setTimeout(() => printInvoice(newInv, snackbar), 400);
      }
      setForm(emptyForm());
      setModalOpen(false);
    } catch (err) {
      snackbar.error(err?.message || "Error al guardar la factura");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await remove(deleteTarget.id);
      setDeleteTarget(null);
      snackbar.success("Factura eliminada");
    } catch (err) {
      snackbar.error(err?.message || "Error al eliminar");
    }
    setDeleteLoading(false);
  };

  const clientName = (inv) =>
    inv.client?.name ?? inv.clientName ?? clients.find((c) => c.id === inv.clientId || c.id === Number(inv.clientId))?.name ?? "—";

  const [search, setSearch] = useState("");
  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((inv) => {
      const name = (clientName(inv) || "").toLowerCase();
      const concept = (inv.concept || "").toLowerCase();
      return name.includes(q) || concept.includes(q);
    });
  }, [invoices, search, clients]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Facturas</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-300">Gestionar facturas</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exportLoading.excel}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100 disabled:opacity-50"
          >
            <FileSpreadsheet className="h-5 w-5" />
            Descargar Excel
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exportLoading.pdf}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-800 transition-colors hover:bg-red-100 disabled:opacity-50"
          >
            <FileText className="h-5 w-5" />
            Descargar PDF
          </button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Crear factura
          </Button>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="search"
              placeholder="Buscar por cliente o concepto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:focus:ring-primary-400"
              aria-label="Buscar facturas"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Forma de pago:</label>
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-100 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:focus:ring-primary-400"
            >
              {PAYMENT_METHOD_FILTER_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
        {loading ? (
          <div className="py-6">
            <TableSkeleton columns={8} rows={6} />
          </div>
        ) : invoices.length === 0 ? (
          <EmptyState message="No tienes facturas aún" description="Crea tu primera factura para llevar el control de cobros." action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Crear factura</Button>} />
        ) : filteredInvoices.length === 0 ? (
          <EmptyState message="Ninguna factura coincide con la búsqueda" description="Prueba con otro término (cliente o concepto)." />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Factura</TableHeaderCell>
                <TableHeaderCell>Cliente</TableHeaderCell>
                <TableHeaderCell>Fecha</TableHeaderCell>
                <TableHeaderCell>Monto</TableHeaderCell>
                <TableHeaderCell>Estado</TableHeaderCell>
                <TableHeaderCell>Forma de pago</TableHeaderCell>
                <TableHeaderCell>F. envío</TableHeaderCell>
                <TableHeaderCell>F. llegada</TableHeaderCell>
                <TableHeaderCell className="w-12">Enviar</TableHeaderCell>
                <TableHeaderCell className="w-28">Acciones</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredInvoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.id}</TableCell>
                  <TableCell>{clientName(inv)}</TableCell>
                  <TableCell>{formatDate(inv.date)}</TableCell>
                  <TableCell>{formatAmountByPaymentMethod(inv.amount, inv.paymentMethod)}</TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[inv.status] || "default"}>{inv.status}</Badge></TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-300">{formatPaymentMethod(inv.paymentMethod)}</TableCell>
                  <TableCell className="text-slate-500 dark:text-slate-400 text-sm whitespace-nowrap">{inv.travelDate ? formatDate(inv.travelDate) : "—"}</TableCell>
                  <TableCell className="text-slate-500 dark:text-slate-400 text-sm whitespace-nowrap">{inv.returnDate ? formatDate(inv.returnDate) : "—"}</TableCell>
                  <TableCell>
                    <button type="button" onClick={() => sendInvoiceWhatsApp(inv, clients, clientName, snackbar)} className="rounded-lg p-2 text-green-600 hover:bg-green-50 transition-colors" title="Enviar factura por WhatsApp">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => printInvoice(inv, snackbar)} className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-primary-600" title="Imprimir factura">
                        <Printer className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => openEdit(inv)} className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-primary-600" title="Editar"><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => setDeleteTarget({ id: inv.id, label: `Factura #${inv.id}` })} className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-300" title="Eliminar"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!loading && invoices.length > 0 && totalPages > 1 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <Pagination
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Editar factura" : "Crear factura"} size="3xl">
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-x-5 gap-y-4">
          {/* Fila 1: Cliente | Concepto */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                <User className="h-3.5 w-3.5" />
              </span>
              Cliente
            </label>
            <select
              value={form.clientId}
              onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
              required
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-800 dark:text-slate-100 shadow-sm focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-400/20"
            >
              <option value="">Seleccionar cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <FileText className="h-3.5 w-3.5" />
              </span>
              Concepto / Descripción
            </label>
            <input
              type="text"
              value={form.concept}
              onChange={(e) => setForm((f) => ({ ...f, concept: e.target.value }))}
              placeholder="Ej: Encomienda USA, Pedido Shein, Amazon..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-800 dark:text-slate-100 shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-400/20"
            />
          </div>

          {/* Fila 2: Fecha factura | Fecha vencimiento */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <CalendarDays className="h-3.5 w-3.5" />
              </span>
              Fecha de factura
            </label>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-2.5">
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                required
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-100 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-400/20"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 opacity-80">
                <CalendarDays className="h-3.5 w-3.5" />
              </span>
              Fecha de vencimiento
            </label>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-2.5">
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-100 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-400/20"
              />
            </div>
          </div>

          {/* Fila 2b: Fecha de envío | Fecha de llegada (opcionales) */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
                <Plane className="h-3.5 w-3.5" />
              </span>
              Fecha de envío
            </label>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-2.5">
              <input
                type="date"
                value={form.travelDate}
                onChange={(e) => setForm((f) => ({ ...f, travelDate: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-100 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-400/20"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-sky-600 opacity-80">
                <Plane className="h-3.5 w-3.5" />
              </span>
              Fecha de llegada
            </label>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-2.5">
              <input
                type="date"
                value={form.returnDate}
                onChange={(e) => setForm((f) => ({ ...f, returnDate: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-100 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-400/20"
              />
            </div>
          </div>

          {/* Fila 3: Monto (símbolo fuera del input) | Estado */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                <Banknote className="h-3.5 w-3.5" />
              </span>
              Monto
            </label>
            <div className="flex rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm focus-within:border-primary-500 dark:focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-500/20 dark:focus-within:ring-primary-400/20">
              <span className="flex items-center rounded-l-xl border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5 text-base font-medium tabular-nums text-slate-700 dark:text-slate-200">
                {form.paymentMethod === PAYMENT_METHOD_API.DOLARES || form.paymentMethod === PAYMENT_METHOD_API.TRANSFERENCIA_DOLARES ? "$" : "C$"}
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
                required
                className="w-full min-w-0 rounded-r-xl border-0 bg-transparent px-3 py-2.5 text-base font-medium tabular-nums text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-0"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Estado</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-800 dark:text-slate-100 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-400/20"
            >
              <option value="Pendiente">Pendiente</option>
              <option value="Pagado">Pagado</option>
              <option value="Vencida">Vencida</option>
            </select>
          </div>

          {/* Fila 4: ¿Con qué paga? (ancho completo) */}
          <div className="col-span-2 space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Forma de pago</label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS_WITH_ICONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value || "none"}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, paymentMethod: value }))}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-medium transition-all",
                    form.paymentMethod === value
                      ? "border-primary-500 bg-primary-50 text-primary-700 shadow-sm"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Fila 5: Opciones al crear (WhatsApp e imprimir) */}
          <div className="col-span-2 space-y-2">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 px-4 py-3">
              <input
                type="checkbox"
                id="send-whatsapp"
                checked={form.sendByWhatsApp}
                onChange={(e) => setForm((f) => ({ ...f, sendByWhatsApp: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="send-whatsapp" className="text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                Enviar factura por WhatsApp al cliente después de crear
              </label>
            </div>
            {!editingId && (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 px-4 py-3">
                <input
                  type="checkbox"
                  id="print-on-create"
                  checked={form.printOnCreate}
                  onChange={(e) => setForm((f) => ({ ...f, printOnCreate: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="print-on-create" className="text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                  Abrir factura para imprimir al crear
                </label>
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="col-span-2 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="lg">
              {editingId ? "Guardar cambios" : "Crear factura"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteConfirm} title="Eliminar factura" message={deleteTarget ? `¿Eliminar ${deleteTarget.label}? Esta acción no se puede deshacer.` : ""} confirmLabel="Eliminar" loading={deleteLoading} />
    </div>
  );
}

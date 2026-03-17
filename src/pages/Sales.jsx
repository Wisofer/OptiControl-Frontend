import { useState, useMemo } from "react";
import {
  ShoppingBag,
  FileSpreadsheet,
  FileText,
  Plus,
  Pencil,
  Trash2,
  Search,
  Receipt,
  User,
  Calendar,
  CalendarDays,
  DollarSign,
  TrendingUp,
  Clock,
  Package,
  Banknote,
  Landmark,
  ArrowRightLeft,
} from "lucide-react";
import {
  Card,
  Badge,
  Button,
  Modal,
  EmptyState,
  ConfirmModal,
  CardListSkeleton,
  Pagination,
} from "../components/ui";
import { useSales } from "../hooks/useSales";
import { useClients } from "../hooks/useClients";
import { useToggle } from "../hooks/useToggle";
import { useSnackbar } from "../contexts/SnackbarContext";
import { formatCurrency, formatDate, formatAmountByPaymentMethod } from "../utils/format";
import { useExport } from "../hooks/useExport";
import { formatPaymentMethod, toPaymentMethodApiValue, normalizePaymentMethodForForm, PAYMENT_METHOD_FILTER_OPTIONS, PAYMENT_METHODS_WITH_ICONS } from "../utils/paymentMethod";
import { cn } from "../utils/cn";
import { STATUS_VARIANT } from "../constants/statusVariants";

const salesColumns = [
  { key: "date", label: "Fecha" },
  { key: "clientName", label: "Cliente" },
  { key: "product", label: "Producto" },
  { key: "amount", label: "Monto" },
  { key: "status", label: "Estado" },
];

const emptyForm = {
  clientId: "",
  product: "",
  amount: "",
  date: new Date().toISOString().slice(0, 10),
  status: "Pendiente",
  paymentMethod: "Cordobas",
};

export function Sales() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const filters = useMemo(() => {
    const o = {};
    if (statusFilter !== "all") o.status = statusFilter;
    if (paymentMethodFilter !== "all") o.paymentMethod = paymentMethodFilter;
    return o;
  }, [statusFilter, paymentMethodFilter]);
  const { sales, totalsFromApi, loading, error, totalCount, totalPages, page, pageSize, setPage, create, update, remove } = useSales(filters);
  const { clients } = useClients("");
  const snackbar = useSnackbar();
  const { exportLoading, handleExportExcel, handleExportPdf } = useExport(
    "/api/sales",
    () => ({ ...filters }),
    "Ventas.xlsx",
    "Ventas.pdf"
  );
  const [modalOpen, setModalOpen] = useToggle(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const totals = useMemo(
    () =>
      totalsFromApi
        ? {
            count: totalCount,
            sum: totalsFromApi.totalAmountInCordobas ?? 0,
            pendiente: totalsFromApi.totalPendingInCordobas ?? 0,
          }
        : {
            count: totalCount,
            sum: sales.reduce((acc, s) => acc + s.amount, 0),
            pendiente: sales
              .filter((s) => s.status === "Pendiente")
              .reduce((acc, s) => acc + s.amount, 0),
          },
    [sales, totalsFromApi, totalCount]
  );

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) });
    setModalOpen(true);
  };

  const openEdit = (s) => {
    setEditingId(s.id);
    setForm({
      clientId: String(s.clientId ?? s.client?.id ?? ""),
      product: s.product ?? "",
      amount: s.amount ?? "",
      date: s.date
        ? s.date.slice
          ? s.date.slice(0, 10)
          : s.date
        : new Date().toISOString().slice(0, 10),
      status: s.status ?? "Pendiente",
      paymentMethod: normalizePaymentMethodForForm(s.paymentMethod) ?? "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const body = {
        clientId: Number(form.clientId),
        product: form.product,
        amount: Number(form.amount),
        date: form.date,
        status: form.status,
        paymentMethod: toPaymentMethodApiValue(form.paymentMethod),
      };
      if (editingId) {
        await update(editingId, body);
        setEditingId(null);
        snackbar.success("Venta actualizada");
      } else {
        await create(body);
        snackbar.success("Venta registrada");
      }
      setForm(emptyForm);
      setModalOpen(false);
    } catch (err) {
      snackbar.error(err?.message || "Error al guardar la venta");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await remove(deleteTarget.id);
      setDeleteTarget(null);
      snackbar.success("Venta eliminada");
    } catch (err) {
      snackbar.error(err?.message || "Error al eliminar");
    }
    setDeleteLoading(false);
  };

  const clientName = (s) =>
    s.client?.name ??
    s.clientName ??
    clients.find((c) => c.id === s.clientId || c.id === Number(s.clientId))?.name ??
    "—";

  const [search, setSearch] = useState("");
  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter((s) => {
      const name = (clientName(s) || "").toLowerCase();
      const product = (s.product || "").toLowerCase();
      return name.includes(q) || product.includes(q);
    });
  }, [sales, search, clients]);

  return (
    <div className="space-y-6">
      {/* Header tipo facturación */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Ventas</h1>
            <p className="text-slate-600 dark:text-slate-300">Facturación y transacciones</p>
          </div>
        </div>
        <Button onClick={openCreate} size="lg">
          <Plus className="mr-2 h-5 w-5" />
          Nueva venta
        </Button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 dark:bg-red-950/30 px-4 py-2 text-sm text-red-700 dark:text-red-200" role="alert">
          {error}
        </p>
      )}

      {/* Filtros tipo tabs */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "all", label: "Todas", icon: Receipt },
            { key: "Completado", label: "Completadas", icon: TrendingUp },
            { key: "Pendiente", label: "Pendientes", icon: Clock },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-all",
                statusFilter === key
                  ? "border-primary-500 bg-primary-50 text-primary-700"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Forma de pago:</label>
          <select
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value)}
            className="rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-100 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-400/20"
          >
            {PAYMENT_METHOD_FILTER_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPIs tipo resumen de facturación */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total facturado</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
                {formatCurrency(totals.sum)}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-slate-800 text-emerald-600">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Transacciones</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
                {totals.count}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 dark:bg-slate-800 text-primary-600">
              <Receipt className="h-6 w-6" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Pendiente de cobro</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700">
                {formatCurrency(totals.pendiente)}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 dark:bg-slate-800 text-amber-600">
              <Clock className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Contenido: lista tipo carrito / facturación + panel resumen */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-slate-100 dark:border-slate-800 px-5 py-4">
              <div className="relative max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="search"
                  placeholder="Buscar por cliente o producto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:focus:ring-primary-400"
                  aria-label="Buscar ventas"
                />
              </div>
            </div>
            {loading ? (
              <CardListSkeleton items={5} />
            ) : sales.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  message="No hay ventas en este filtro"
                  description="Registra una venta para que aparezca aquí y en el resumen de facturación."
                  action={
                    <Button onClick={openCreate}>
                      <Plus className="mr-2 h-4 w-4" />
                      Nueva venta
                    </Button>
                  }
                />
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  message="Ninguna venta coincide con la búsqueda"
                  description="Prueba con otro término (cliente o producto)."
                />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSales.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50 sm:flex-nowrap"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{s.product}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {clientName(s)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(s.date)}
                        </span>
                        <span className="text-slate-400 dark:text-slate-600">·</span>
                        <span>Forma de pago: {formatPaymentMethod(s.paymentMethod)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-right text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100">
                        {formatAmountByPaymentMethod(s.amount, s.paymentMethod)}
                      </span>
                      <Badge variant={STATUS_VARIANT[s.status] || "default"}>
                        {s.status}
                      </Badge>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-800 hover:text-primary-600"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ id: s.id, label: `Venta: ${s.product}` })}
                          className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-300"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {!loading && sales.length > 0 && totalPages > 1 && (
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
          </Card>
        </div>

        {/* Panel resumen lateral (estilo factura / carrito) */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900 p-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              <Receipt className="h-4 w-4" />
              Resumen
            </h3>
            <dl className="space-y-3">
              <div className="flex justify-between text-sm">
                <dt className="text-slate-500 dark:text-slate-400">Transacciones</dt>
                <dd className="font-semibold text-slate-800 dark:text-slate-100">{totals.count}</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-slate-500 dark:text-slate-400">Total</dt>
                <dd className="font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                  {formatCurrency(totals.sum)}
                </dd>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
                <div className="flex justify-between text-sm">
                  <dt className="text-slate-500 dark:text-slate-400">Pendiente</dt>
                  <dd className="font-semibold text-amber-700 tabular-nums">
                    {formatCurrency(totals.pendiente)}
                  </dd>
                </div>
              </div>
            </dl>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={exportLoading.excel}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100 disabled:opacity-50"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Descargar Excel
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={exportLoading.pdf}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-800 transition-colors hover:bg-red-100 disabled:opacity-50"
              >
                <FileText className="h-4 w-4" />
                Descargar PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Editar venta" : "Nueva venta"}
        size="3xl"
      >
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-x-5 gap-y-4">
          {/* Fila 1: Cliente | Producto */}
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
                <Package className="h-3.5 w-3.5" />
              </span>
              Producto / concepto
            </label>
            <input
              type="text"
              value={form.product}
              onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))}
              placeholder="Ej. Paquete Miami, Tour París..."
              required
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-800 dark:text-slate-100 shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-400/20"
            />
          </div>

          {/* Fila 2: Fecha | Monto */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <CalendarDays className="h-3.5 w-3.5" />
              </span>
              Fecha
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
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                <Banknote className="h-3.5 w-3.5" />
              </span>
              Monto
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0.00"
              required
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-base font-medium tabular-nums text-slate-800 dark:text-slate-100 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-400/20"
            />
          </div>

          {/* Fila 3: Estado | ¿Con qué paga? */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Estado</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-800 dark:text-slate-100 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-400/20"
            >
              <option value="Pendiente">Pendiente</option>
              <option value="Completado">Completado</option>
            </select>
          </div>
          <div className="space-y-1.5">
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

          {/* Acciones */}
          <div className="col-span-2 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="lg">
              {editingId ? "Guardar cambios" : "Nueva venta"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Eliminar venta"
        message={
          deleteTarget
            ? `¿Eliminar ${deleteTarget.label}? Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        loading={deleteLoading}
      />
    </div>
  );
}

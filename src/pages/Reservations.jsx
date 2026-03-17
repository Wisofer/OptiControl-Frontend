import { useState, useMemo } from "react";
import { useToggle } from "../hooks/useToggle";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  User,
  MapPin,
  CalendarDays,
  Banknote,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { Card, Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell, Badge, Button, Modal, EmptyState, ConfirmModal, TableSkeleton, Pagination } from "../components/ui";
import { useReservations } from "../hooks/useReservations";
import { useClients } from "../hooks/useClients";
import { useSnackbar } from "../contexts/SnackbarContext";
import { formatCurrency, formatDate, formatAmountByPaymentMethod } from "../utils/format";
import { cn } from "../utils/cn";
import { useExport } from "../hooks/useExport";
import { formatPaymentMethod, toPaymentMethodApiValue, normalizePaymentMethodForForm, PAYMENT_METHOD_FILTER_OPTIONS, PAYMENT_METHODS_WITH_ICONS } from "../utils/paymentMethod";
import { STATUS_VARIANT } from "../constants/statusVariants";

function getEmptyForm() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    clientId: "",
    destination: "",
    startDate: today,
    endDate: "",
    amount: "",
    paymentMethod: "Cordobas",
    paymentStatus: "Pendiente",
  };
}

export function Reservations() {
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const filters = useMemo(
    () => (paymentMethodFilter === "all" ? {} : { paymentMethod: paymentMethodFilter }),
    [paymentMethodFilter]
  );
  const { reservations, loading, error, totalCount, totalPages, page, pageSize, setPage, create, update, remove } = useReservations(filters);
  const { clients } = useClients("");
  const snackbar = useSnackbar();
  const { exportLoading, handleExportExcel, handleExportPdf } = useExport(
    "/api/reservations",
    () => ({ ...filters }),
    "Pedidos.xlsx",
    "Pedidos.pdf"
  );
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useToggle(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [form, setForm] = useState(getEmptyForm);

  const openCreate = () => {
    setEditingId(null);
    setForm(getEmptyForm());
    setModalOpen(true);
  };

  const openEdit = (r) => {
    setEditingId(r.id);
    setForm({
      clientId: String(r.clientId ?? r.client?.id ?? ""),
      destination: r.destination ?? "",
      startDate: r.startDate ? (r.startDate.slice ? r.startDate.slice(0, 10) : r.startDate) : "",
      endDate: r.endDate ? (r.endDate.slice ? r.endDate.slice(0, 10) : r.endDate) : "",
      amount: r.amount ?? "",
      paymentMethod: normalizePaymentMethodForForm(r.paymentMethod) ?? "",
      paymentStatus: r.paymentStatus ?? "Pendiente",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const body = {
        clientId: Number(form.clientId),
        destination: form.destination,
        startDate: form.startDate,
        endDate: form.endDate,
        amount: Number(form.amount),
        paymentMethod: toPaymentMethodApiValue(form.paymentMethod),
        paymentStatus: form.paymentStatus,
      };
      if (editingId) {
        await update(editingId, body);
        setEditingId(null);
        snackbar.success("Reservación actualizada");
      } else {
        await create(body);
        snackbar.success("Reservación creada");
      }
      setForm(getEmptyForm());
      setModalOpen(false);
    } catch (err) {
      snackbar.error(err?.message || "Error al guardar la reservación");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await remove(deleteTarget.id);
      setDeleteTarget(null);
      snackbar.success("Reservación eliminada");
    } catch (err) {
      snackbar.error(err?.message || "Error al eliminar");
    }
    setDeleteLoading(false);
  };

  const clientName = (r) =>
    r.client?.name ?? r.clientName ?? clients.find((c) => c.id === r.clientId || c.id === Number(r.clientId))?.name ?? "—";

  const filteredReservations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reservations;
    return reservations.filter((r) => {
      const name = (clientName(r) || "").toLowerCase();
      const dest = (r.destination || "").toLowerCase();
      return name.includes(q) || dest.includes(q);
    });
  }, [reservations, search, clients]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Pedidos</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-300">Pedidos internacionales y estado de pago</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exportLoading.excel}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100 disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Descargar Excel
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exportLoading.pdf}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 transition-colors hover:bg-red-100 disabled:opacity-50"
          >
            <FileText className="h-4 w-4" />
            Descargar PDF
          </button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Crear reservación
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
              placeholder="Buscar por cliente o tienda..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:focus:ring-primary-400"
              aria-label="Buscar pedidos"
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
        ) : reservations.length === 0 ? (
          <EmptyState
            message="No tienes pedidos aún"
            description="Registra tu primer pedido para gestionar encomiendas y pagos."
            action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Crear reservación</Button>}
          />
        ) : filteredReservations.length === 0 ? (
          <EmptyState
            message="Ninguna reservación coincide con la búsqueda"
            description="Prueba con otro término (cliente o destino)."
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>ID</TableHeaderCell>
                <TableHeaderCell>Cliente</TableHeaderCell>
                <TableHeaderCell>Tienda / Origen</TableHeaderCell>
                <TableHeaderCell>Fechas de envío</TableHeaderCell>
                <TableHeaderCell>Monto</TableHeaderCell>
                <TableHeaderCell>Pago</TableHeaderCell>
                <TableHeaderCell>Forma de pago</TableHeaderCell>
                <TableHeaderCell className="w-24">Acciones</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredReservations.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.id}</TableCell>
                  <TableCell>{clientName(r)}</TableCell>
                  <TableCell>{r.destination}</TableCell>
                  <TableCell>{formatDate(r.startDate)} – {formatDate(r.endDate)}</TableCell>
                  <TableCell>{formatAmountByPaymentMethod(r.amount, r.paymentMethod)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[r.paymentStatus] || "default"}>{r.paymentStatus}</Badge>
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-300">{formatPaymentMethod(r.paymentMethod)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => openEdit(r)} className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-primary-600" title="Editar"><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => setDeleteTarget({ id: r.id, label: `Pedido #${r.id} (${r.destination})` })} className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-300" title="Eliminar"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!loading && reservations.length > 0 && totalPages > 1 && (
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Editar reservación" : "Crear reservación"} size="3xl">
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-x-5 gap-y-4">
          {/* Fila 1: Cliente | Tienda / Origen */}
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
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <MapPin className="h-3.5 w-3.5" />
              </span>
              Tienda / Origen
            </label>
            <input
              type="text"
              value={form.destination}
              onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
              placeholder="Ej. Amazon, Shein, eBay..."
              required
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-800 dark:text-slate-100 shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-400/20"
            />
          </div>

          {/* Fila 2: Fecha inicio | Fecha fin */}
          <div className="space-y-1.5">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <CalendarDays className="h-3.5 w-3.5" />
              </span>
              Fecha de inicio
            </span>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-2.5">
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
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
              Fecha de fin
            </label>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-2.5">
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-100 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-400/20"
              />
            </div>
          </div>

          {/* Fila 3: Monto | Estado de pago */}
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
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Estado de pago</label>
            <select
              value={form.paymentStatus}
              onChange={(e) => setForm((f) => ({ ...f, paymentStatus: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-800 dark:text-slate-100 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-400/20"
            >
              <option value="Pendiente">Pendiente</option>
              <option value="Pagado">Pagado</option>
              <option value="Parcial">Parcial</option>
            </select>
          </div>

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

          {/* Acciones */}
          <div className="col-span-2 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="lg">
              {editingId ? "Guardar cambios" : "Crear reservación"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Eliminar reservación"
        message={deleteTarget ? `¿Eliminar ${deleteTarget.label}? Esta acción no se puede deshacer.` : ""}
        confirmLabel="Eliminar"
        loading={deleteLoading}
      />
    </div>
  );
}

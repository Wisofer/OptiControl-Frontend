import { useState, useMemo } from "react";
import { useToggle } from "../hooks/useToggle";
import {
  Plus,
  Pencil,
  Trash2,
  CalendarDays,
  Banknote,
  Tag,
  ArrowDownCircle,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { Card, Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell, Button, Modal, EmptyState, ConfirmModal, TableSkeleton, Pagination } from "../components/ui";
import { useExpenses } from "../hooks/useExpenses";
import { useSnackbar } from "../contexts/SnackbarContext";
import { formatCurrency, formatDate } from "../utils/format";
import { useExport } from "../hooks/useExport";

const CATEGORIES = [
  { value: "", label: "Todas" },
  { value: "Operativo", label: "Operativo" },
  { value: "Fijo", label: "Fijo" },
  { value: "Marketing", label: "Marketing" },
];

function getEmptyForm() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    date: today,
    concept: "",
    amount: "",
    category: "Operativo",
  };
}

export function Expenses() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [category, setCategory] = useState("");
  const filters = useMemo(
    () => ({
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(category ? { category } : {}),
    }),
    [dateFrom, dateTo, category]
  );
  const { expenses, loading, error, totalCount, totalPages, page, pageSize, setPage, create, update, remove } = useExpenses(filters);
  const snackbar = useSnackbar();
  const { exportLoading, handleExportExcel, handleExportPdf } = useExport(
    "/api/expenses",
    () => ({ ...filters }),
    "Egresos.xlsx",
    "Egresos.pdf"
  );
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

  const openEdit = (e) => {
    setEditingId(e.id);
    setForm({
      date: e.date ? (e.date.slice ? e.date.slice(0, 10) : e.date) : new Date().toISOString().slice(0, 10),
      concept: e.concept ?? "",
      amount: e.amount ?? "",
      category: e.category ?? "Operativo",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const conceptTrim = (form.concept || "").trim();
    const amountNum = Number(form.amount);
    if (!conceptTrim) {
      snackbar.error("El concepto es obligatorio.");
      return;
    }
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      snackbar.error("El monto debe ser un número mayor que 0.");
      return;
    }
    try {
      const body = {
        date: form.date || undefined,
        concept: conceptTrim,
        amount: amountNum,
        category: form.category || "Operativo",
      };
      if (editingId) {
        await update(editingId, { ...body, id: editingId });
        setEditingId(null);
        snackbar.success("Egreso actualizado");
      } else {
        await create(body);
        snackbar.success("Egreso creado");
      }
      setForm(getEmptyForm());
      setModalOpen(false);
    } catch (err) {
      snackbar.error(err?.message || "Error al guardar el egreso");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await remove(deleteTarget.id);
      setDeleteTarget(null);
      snackbar.success("Egreso eliminado");
    } catch (err) {
      snackbar.error(err?.message || "Error al eliminar");
    }
    setDeleteLoading(false);
  };

  const totalAmount = useMemo(
    () => expenses.reduce((acc, e) => acc + (e.amount || 0), 0),
    [expenses]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Egresos</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-300">Gastos de la agencia: servicios, proveedores, marketing</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            Nuevo egreso
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 dark:bg-red-950/30 px-4 py-2 text-sm text-red-700 dark:text-red-200" role="alert">
          {error}
        </p>
      )}

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:focus:ring-primary-400"
              aria-label="Fecha desde"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:focus:ring-primary-400"
              aria-label="Fecha hasta"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Categoría</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:focus:ring-primary-400"
              aria-label="Categoría"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value || "all"} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Total del período */}
      {!loading && expenses.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total del período</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-red-700">
            {formatCurrency(totalAmount)}
          </p>
        </div>
      )}

      <Card>
        {loading ? (
          <div className="py-6">
            <TableSkeleton columns={5} rows={6} />
          </div>
        ) : expenses.length === 0 ? (
          <EmptyState
            message="No hay egresos en este filtro"
            description="Registra agua, luz, internet, proveedores y otros gastos para llevar el control."
            action={
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo egreso
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Fecha</TableHeaderCell>
                <TableHeaderCell>Concepto</TableHeaderCell>
                <TableHeaderCell>Categoría</TableHeaderCell>
                <TableHeaderCell>Monto</TableHeaderCell>
                <TableHeaderCell className="w-24">Acciones</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-slate-700 dark:text-slate-200">{formatDate(e.date)}</TableCell>
                  <TableCell className="font-medium text-slate-800 dark:text-slate-100">{e.concept}</TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-300">{e.category || "—"}</TableCell>
                  <TableCell className="tabular-nums text-slate-800 dark:text-slate-100">{formatCurrency(e.amount)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(e)}
                        className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-primary-600"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            id: e.id,
                            label: `${e.concept} – ${formatCurrency(e.amount)}`,
                          })
                        }
                        className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-300"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!loading && expenses.length > 0 && totalPages > 1 && (
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Editar egreso" : "Nuevo egreso"}
        size="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200">
                  <CalendarDays className="h-3.5 w-3.5" />
                </span>
                Fecha (opcional)
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-800 dark:text-slate-100 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-400/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                  <Tag className="h-3.5 w-3.5" />
                </span>
                Categoría
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-800 dark:text-slate-100 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-400/20"
              >
                <option value="Operativo">Operativo</option>
                <option value="Fijo">Fijo</option>
                <option value="Marketing">Marketing</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                <ArrowDownCircle className="h-3.5 w-3.5" />
              </span>
              Concepto *
            </label>
            <input
              type="text"
              value={form.concept}
              onChange={(e) => setForm((f) => ({ ...f, concept: e.target.value }))}
              placeholder="Ej: Pago proveedor, Agua, Luz, Internet..."
              required
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-400/20"
            />
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <Banknote className="h-3.5 w-3.5" />
              </span>
              Monto (C$) *
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
          <div className="flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">{editingId ? "Guardar cambios" : "Crear egreso"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Eliminar egreso"
        message={
          deleteTarget
            ? `¿Eliminar "${deleteTarget.label}"? Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        loading={deleteLoading}
      />
    </div>
  );
}

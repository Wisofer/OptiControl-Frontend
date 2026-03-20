import { useState } from "react";
import { Wrench, Plus, Pencil, Trash2, Search, FileSpreadsheet, FileText } from "lucide-react";
import {
  Card,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  Button,
  Modal,
  EmptyState,
  ConfirmModal,
  TableSkeleton,
  Pagination,
  Input,
} from "../components/ui";
import { useServices } from "../hooks/useServices";
import { useToggle } from "../hooks/useToggle";
import { useSnackbar } from "../contexts/SnackbarContext";
import { formatCurrency } from "../utils/format";
import { useExport } from "../hooks/useExport";

const EMPTY_FORM = {
  nombre_servicio: "",
  precio: "",
  descripcion: "",
};

export function Servicios() {
  const [search, setSearch] = useState("");
  const { services, loading, error, totalCount, totalPages, page, pageSize, setPage, create, update, remove } = useServices(search);
  const snackbar = useSnackbar();
  const { exportLoading, handleExportExcel, handleExportPdf } = useExport(
    "/api/services",
    () => ({ search: search || undefined }),
    "Servicios.xlsx",
    "Servicios.pdf"
  );
  const [modalOpen, setModalOpen] = useToggle(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (s) => {
    setEditingId(s.id);
    setForm({
      nombre_servicio: s.nombre_servicio ?? "",
      precio: s.precio ?? "",
      descripcion: s.descripcion ?? "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const body = {
        nombre_servicio: form.nombre_servicio.trim(),
        precio: Number(form.precio) || 0,
        descripcion: (form.descripcion || "").trim(),
      };
      if (editingId) {
        await update(editingId, body);
        setEditingId(null);
        snackbar.success("Servicio actualizado");
      } else {
        body.fecha_creacion = new Date().toISOString().slice(0, 10);
        await create(body);
        snackbar.success("Servicio agregado");
      }
      setForm(EMPTY_FORM);
      setModalOpen(false);
    } catch (err) {
      snackbar.error(err?.message || "Error al guardar el servicio");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await remove(deleteTarget.id);
      setDeleteTarget(null);
      snackbar.success("Servicio eliminado");
    } catch (err) {
      snackbar.error(err?.message || "Error al eliminar");
    }
    setDeleteLoading(false);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400">
            <Wrench className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Servicios</h1>
            <p className="text-slate-600 dark:text-slate-300">Servicios que ofrece la óptica (examen visual, ajuste, etc.)</p>
          </div>
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
            Agregar servicio
          </Button>
        </div>
      </header>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      <Card>
        <div className="mb-4">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="search"
              placeholder="Buscar por nombre o descripción..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              aria-label="Buscar servicios"
            />
          </div>
        </div>

        {loading && !services.length ? (
          <div className="py-6">
            <TableSkeleton columns={4} rows={5} />
          </div>
        ) : services.length === 0 ? (
          <EmptyState
            message="No hay servicios registrados"
            description="Agrega exámenes visuales, ajustes de lentes u otros servicios para venderlos en el punto de venta."
            action={
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar servicio
              </Button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Servicio</TableHeaderCell>
                    <TableHeaderCell className="text-right">Precio</TableHeaderCell>
                    <TableHeaderCell>Descripción</TableHeaderCell>
                    <TableHeaderCell className="w-28">Acciones</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {services.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium text-slate-800 dark:text-slate-100">{s.nombre_servicio}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatCurrency(s.precio)}</TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-300 max-w-xs truncate">{s.descripcion || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(s)}
                            className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-primary-600 transition-colors"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ id: s.id, name: s.nombre_servicio })}
                            className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 transition-colors"
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Editar servicio" : "Agregar servicio"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre del servicio"
            value={form.nombre_servicio}
            onChange={(e) => setForm((f) => ({ ...f, nombre_servicio: e.target.value }))}
            placeholder="Ej: Examen visual"
            required
          />
          <Input
            label="Precio (C$)"
            type="number"
            min="0"
            step="0.01"
            value={form.precio}
            onChange={(e) => setForm((f) => ({ ...f, precio: e.target.value }))}
            required
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Descripción</label>
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              placeholder="Ej: Evaluación de la vista"
              rows={3}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">{editingId ? "Guardar cambios" : "Agregar servicio"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Eliminar servicio"
        message={deleteTarget ? `¿Eliminar "${deleteTarget.name}"? Esta acción no se puede deshacer.` : ""}
        confirmLabel="Eliminar"
        loading={deleteLoading}
      />
    </div>
  );
}

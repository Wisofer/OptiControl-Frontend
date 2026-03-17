import { useState } from "react";
import { Plus, Pencil, Trash2, CheckCircle, XCircle, Star } from "lucide-react";
import {
  Card,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  Button,
  Input,
  Modal,
  EmptyState,
  ConfirmModal,
  TableSkeleton,
  Badge,
} from "../components/ui";
import { useTestimonials } from "../hooks/useTestimonials";
import { useToggle } from "../hooks/useToggle";
import { useSnackbar } from "../contexts/SnackbarContext";

const EMPTY_FORM = {
  quote: "",
  authorName: "",
  location: "",
  rating: 5,
  sortOrder: 1,
  isActive: true,
  isApproved: true,
};

function truncate(str, max = 50) {
  if (!str || typeof str !== "string") return "—";
  return str.length <= max ? str : str.slice(0, max) + "…";
}

function getStatusBadge(t) {
  if (t.isApproved === true) {
    return <Badge variant="success">Aprobado</Badge>;
  }
  if (t.isApproved === false) {
    return <Badge variant="danger">Rechazado</Badge>;
  }
  return <Badge variant="warning">Pendiente</Badge>;
}

function Stars({ rating }) {
  const n = Math.min(5, Math.max(0, Number(rating) || 0));
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500" title={`${n} estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i <= n ? "fill-current" : "text-slate-300 dark:text-slate-600"}`}
        />
      ))}
    </span>
  );
}

export function Testimonials() {
  const { testimonials, loading, error, create, update, approve, remove } = useTestimonials();
  const snackbar = useSnackbar();

  const [modalOpen, setModalOpen] = useToggle(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (t) => {
    setEditingId(t.id);
    setForm({
      quote: t.quote ?? "",
      authorName: t.authorName ?? "",
      location: t.location ?? "",
      rating: typeof t.rating === "number" ? t.rating : 5,
      sortOrder: typeof t.sortOrder === "number" ? t.sortOrder : 1,
      isActive: Boolean(t.isActive),
      isApproved: t.isApproved === true,
    });
    setModalOpen(true);
  };

  const buildFullBody = (id, formData) => ({
    id: Number(id),
    quote: formData.quote.trim(),
    authorName: formData.authorName.trim(),
    location: formData.location.trim() || null,
    rating: Math.min(5, Math.max(1, Number(formData.rating) || 5)),
    sortOrder: Number(formData.sortOrder) || 0,
    isActive: formData.isActive,
    isApproved: formData.isApproved,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        const body = buildFullBody(editingId, form);
        await update(editingId, body);
        setEditingId(null);
        snackbar.success("Testimonio actualizado correctamente.");
      } else {
        await create({
          quote: form.quote.trim(),
          authorName: form.authorName.trim(),
          location: form.location.trim() || null,
          rating: Math.min(5, Math.max(1, Number(form.rating) || 5)),
          sortOrder: Number(form.sortOrder) || 0,
          isActive: form.isActive,
          isApproved: form.isApproved,
        });
        snackbar.success("Testimonio guardado correctamente.");
      }
      setForm(EMPTY_FORM);
      setModalOpen(false);
    } catch (err) {
      snackbar.error(err?.message || "Error al guardar el testimonio");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await remove(deleteTarget.id);
      setDeleteTarget(null);
      snackbar.success("Testimonio eliminado.");
    } catch (err) {
      snackbar.error(err?.message || "Error al eliminar");
    }
    setDeleteLoading(false);
  };

  const handleApprove = async (t, value) => {
    setActionLoadingId(t.id);
    try {
      await approve(t.id, value);
      snackbar.success(value ? "Testimonio aprobado. Ya se muestra en la web." : "Testimonio rechazado. No se mostrará en la web.");
    } catch (err) {
      snackbar.error(err?.message || "Error al actualizar");
    }
    setActionLoadingId(null);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Lo que dicen nuestros clientes
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-300">
            Gestiona los testimonios que se muestran en la web. Los enviados por clientes aparecen
            como pendientes hasta que los apruebes.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo testimonio
        </Button>
      </header>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <Card>
        {loading && !testimonials.length ? (
          <div className="py-6">
            <TableSkeleton columns={7} rows={6} />
          </div>
        ) : testimonials.length === 0 ? (
          <EmptyState
            message="No hay testimonios"
            description="Crea uno o espera que los clientes envíen comentarios desde la web."
            action={
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo testimonio
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Cita</TableHeaderCell>
                <TableHeaderCell>Autor</TableHeaderCell>
                <TableHeaderCell>Ubicación</TableHeaderCell>
                <TableHeaderCell>Estrellas</TableHeaderCell>
                <TableHeaderCell>Orden</TableHeaderCell>
                <TableHeaderCell>Estado</TableHeaderCell>
                <TableHeaderCell className="w-40">Acciones</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {testimonials.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="max-w-[220px] text-slate-700 dark:text-slate-200">
                    {truncate(t.quote, 60)}
                  </TableCell>
                  <TableCell className="font-medium">{t.authorName || "—"}</TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400">
                    {t.location || "—"}
                  </TableCell>
                  <TableCell>
                    <Stars rating={t.rating} />
                  </TableCell>
                  <TableCell className="font-mono text-slate-500">{t.sortOrder ?? "—"}</TableCell>
                  <TableCell>
                    <span className="inline-flex flex-wrap items-center gap-1">
                      {getStatusBadge(t)}
                      {t.isActive ? (
                        <Badge variant="info">Visible</Badge>
                      ) : (
                        <Badge variant="default">Oculto</Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-primary-600 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {t.isApproved !== true && (
                        <button
                          type="button"
                          onClick={() => handleApprove(t, true)}
                          disabled={actionLoadingId === t.id}
                          className="rounded-lg p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                          title="Aprobar"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                      {t.isApproved !== false && (
                        <button
                          type="button"
                          onClick={() => handleApprove(t, false)}
                          disabled={actionLoadingId === t.id}
                          className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Rechazar"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ id: t.id, authorName: t.authorName })}
                        className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
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
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Editar testimonio" : "Nuevo testimonio"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="w-full">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              Cita o comentario <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.quote}
              onChange={(e) => setForm((f) => ({ ...f, quote: e.target.value }))}
              required
              rows={3}
              placeholder="Texto del testimonio entre comillas..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-100 shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <Input
            label="Nombre del autor"
            placeholder="Ej. Maria Rodríguez"
            value={form.authorName}
            onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))}
            required
          />
          <Input
            label="Ubicación"
            placeholder="Ej. Chinandega, Nicaragua"
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          />
          <div className="flex flex-wrap gap-4">
            <div className="w-24">
              <Input
                label="Estrellas (1-5)"
                type="number"
                min={1}
                max={5}
                value={form.rating}
                onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
              />
            </div>
            <div className="w-24">
              <Input
                label="Orden"
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Visible en la web
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isApproved}
              onChange={(e) => setForm((f) => ({ ...f, isApproved: e.target.checked }))}
              className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Aprobado</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">{editingId ? "Guardar" : "Guardar"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Eliminar testimonio"
        message={
          deleteTarget
            ? "¿Eliminar este testimonio? Esta acción no se puede deshacer."
            : ""
        }
        confirmLabel="Eliminar"
        loading={deleteLoading}
      />
    </div>
  );
}

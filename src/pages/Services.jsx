import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
import { useWebsiteServices } from "../hooks/useWebsiteServices";
import { useToggle } from "../hooks/useToggle";
import { useSnackbar } from "../contexts/SnackbarContext";

const EMPTY_FORM = {
  title: "",
  shortDescription: "",
  description: "",
  sortOrder: 1,
  isActive: true,
  icon: "",
};

function truncate(str, max = 50) {
  if (!str || typeof str !== "string") return "—";
  return str.length <= max ? str : str.slice(0, max) + "…";
}

export function Services() {
  const { services, loading, error, create, update, remove } = useWebsiteServices();
  const snackbar = useSnackbar();

  const [modalOpen, setModalOpen] = useToggle(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toggleLoadingId, setToggleLoadingId] = useState(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (s) => {
    setEditingId(s.id);
    setForm({
      title: s.title ?? "",
      shortDescription: s.shortDescription ?? "",
      description: s.description ?? "",
      sortOrder: typeof s.sortOrder === "number" ? s.sortOrder : 1,
      isActive: Boolean(s.isActive),
      icon: s.icon ?? "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const body = {
        title: form.title.trim(),
        shortDescription: form.shortDescription.trim() || null,
        description: form.description.trim(),
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
        icon: form.icon.trim() || null,
      };
      if (editingId) {
        await update(editingId, body);
        setEditingId(null);
        snackbar.success("Servicio actualizado");
      } else {
        await create(body);
        snackbar.success("Servicio creado");
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

  const handleToggleActive = async (s) => {
    setToggleLoadingId(s.id);
    try {
      await update(s.id, {
        title: s.title,
        shortDescription: s.shortDescription ?? null,
        description: s.description,
        sortOrder: s.sortOrder ?? 0,
        isActive: !s.isActive,
        icon: s.icon ?? null,
      });
      snackbar.success(s.isActive ? "Servicio oculto en la web" : "Servicio visible en la web");
    } catch (err) {
      snackbar.error(err?.message || "Error al actualizar");
    }
    setToggleLoadingId(null);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Servicios web</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-300">
            Gestiona los servicios que se muestran en &quot;Nuestros Servicios&quot; de la web pública.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Crear servicio
        </Button>
      </header>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <Card>
        {loading && !services.length ? (
          <div className="py-6">
            <TableSkeleton columns={6} rows={6} />
          </div>
        ) : services.length === 0 ? (
          <EmptyState
            message="No hay servicios"
            description="Crea el primer servicio para mostrarlo en la sección Nuestros Servicios de la web."
            action={
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Crear servicio
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Orden</TableHeaderCell>
                <TableHeaderCell>Título</TableHeaderCell>
                <TableHeaderCell>Subtítulo</TableHeaderCell>
                <TableHeaderCell>Descripción</TableHeaderCell>
                <TableHeaderCell>Activo</TableHeaderCell>
                <TableHeaderCell className="w-28">Acciones</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {services.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-slate-500">{s.sortOrder ?? "—"}</TableCell>
                  <TableCell className="font-medium">{s.title || "—"}</TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400">{truncate(s.shortDescription, 40)}</TableCell>
                  <TableCell className="max-w-[200px] text-slate-600 dark:text-slate-400">{truncate(s.description, 60)}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(s)}
                      disabled={toggleLoadingId === s.id}
                      className="focus:outline-none"
                      title={s.isActive ? "Ocultar en la web" : "Mostrar en la web"}
                    >
                      <Badge variant={s.isActive ? "success" : "default"}>
                        {toggleLoadingId === s.id ? "..." : s.isActive ? "Sí" : "No"}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-primary-600 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ id: s.id, title: s.title })}
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
        title={editingId ? "Editar servicio" : "Crear servicio"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Título"
            placeholder="Ej: Reservación de Vuelos"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
          <Input
            label="Subtítulo (opcional)"
            placeholder="Frase corta o subtítulo"
            value={form.shortDescription}
            onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))}
          />
          <div className="w-full">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              Descripción <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              required
              rows={4}
              placeholder="Texto largo de la tarjeta del servicio..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-100 shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <Input
            label="Orden"
            type="number"
            min={0}
            value={form.sortOrder}
            onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
          />
          <Input
            label="Icono (opcional)"
            placeholder="Nombre de icono o URL"
            value={form.icon}
            onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Visible en la web pública</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">{editingId ? "Guardar cambios" : "Crear servicio"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Eliminar servicio"
        message={
          deleteTarget
            ? `¿Eliminar el servicio "${deleteTarget.title}"? Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        loading={deleteLoading}
      />
    </div>
  );
}

import { useState } from "react";
import { Search, Plus, History, Pencil, Trash2 } from "lucide-react";
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
  Pagination,
} from "../components/ui";
import { useClients } from "../hooks/useClients";
import { useToggle } from "../hooks/useToggle";
import { useSnackbar } from "../contexts/SnackbarContext";
import { ClientHistoryModal } from "../components/ClientHistoryModal";

const EMPTY_FORM = { name: "", phone: "", address: "", graduacion_od: "", graduacion_oi: "", descripcion: "" };

export function Clients() {
  const [search, setSearch] = useState("");
  const { clients, loading, error, totalCount, totalPages, page, pageSize, setPage, create, update, remove } = useClients(search);
  const snackbar = useSnackbar();

  const [modalOpen, setModalOpen] = useToggle(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [historyClientId, setHistoryClientId] = useState(null);
  const [historyOpen, setHistoryOpen] = useToggle(false);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (c) => {
    setEditingId(c.id);
    setForm({
      name: c.name ?? "",
      phone: c.phone ?? "",
      address: c.address ?? "",
      graduacion_od: c.graduacion_od ?? "",
      graduacion_oi: c.graduacion_oi ?? "",
      descripcion: c.descripcion ?? "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const body = {
        name: form.name.trim(),
        phone: form.phone?.trim() ?? "",
        address: form.address?.trim() ?? "",
        graduacion_od: form.graduacion_od?.trim() ?? "",
        graduacion_oi: form.graduacion_oi?.trim() ?? "",
        descripcion: form.descripcion?.trim() ?? "",
      };
      if (editingId) {
        await update(editingId, body);
        setEditingId(null);
        snackbar.success("Cliente actualizado");
      } else {
        body.fecha_registro = new Date().toISOString().slice(0, 10);
        await create(body);
        snackbar.success("Cliente creado");
      }
      setForm(EMPTY_FORM);
      setModalOpen(false);
    } catch (err) {
      snackbar.error(err?.message || "Error al guardar el cliente");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await remove(deleteTarget.id);
      setDeleteTarget(null);
      snackbar.success("Cliente eliminado");
    } catch (err) {
      snackbar.error(err?.message || "Error al eliminar");
    }
    setDeleteLoading(false);
  };

  const openHistory = (id) => {
    setHistoryClientId(id);
    setHistoryOpen(true);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Clientes</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-300">Gestión de clientes / pacientes de la óptica</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar cliente
        </Button>
      </header>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
      )}

      <Card>
        <div className="mb-4">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="search"
              placeholder="Buscar clientes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-800 dark:text-slate-100 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              aria-label="Buscar clientes"
            />
          </div>
        </div>

        {loading && !clients.length ? (
          <div className="py-6">
            <TableSkeleton columns={6} rows={6} />
          </div>
        ) : clients.length === 0 ? (
          <EmptyState
            message="No tienes clientes aún"
            description="Agrega tu primer cliente para gestionar ventas y graduaciones."
            action={
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar cliente
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Nombre</TableHeaderCell>
                <TableHeaderCell>Teléfono</TableHeaderCell>
                <TableHeaderCell>OD</TableHeaderCell>
                <TableHeaderCell>OI</TableHeaderCell>
                <TableHeaderCell>Descripción</TableHeaderCell>
                <TableHeaderCell className="w-28">Acciones</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-slate-800 dark:text-slate-100">{c.name}</TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-300">{c.phone}</TableCell>
                  <TableCell className="tabular-nums text-slate-600 dark:text-slate-300">{c.graduacion_od || "—"}</TableCell>
                  <TableCell className="tabular-nums text-slate-600 dark:text-slate-300">{c.graduacion_oi || "—"}</TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400 max-w-[200px] truncate" title={c.descripcion || ""}>{c.descripcion || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(c)}
                        className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-primary-600 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openHistory(c.id)}
                        className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-primary-600 transition-colors"
                        title="Ver historial"
                      >
                        <History className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ id: c.id, name: c.name })}
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
        )}
        {!loading && clients.length > 0 && totalPages > 1 && (
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Editar cliente" : "Agregar cliente"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre completo"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <Input
            label="Teléfono"
            placeholder="505 8123 4567"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <Input
            label="Dirección"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="Ciudad, dirección"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Graduación OD (ojo derecho)"
              value={form.graduacion_od}
              onChange={(e) => setForm((f) => ({ ...f, graduacion_od: e.target.value }))}
              placeholder="Ej: -1.50"
            />
            <Input
              label="Graduación OI (ojo izquierdo)"
              value={form.graduacion_oi}
              onChange={(e) => setForm((f) => ({ ...f, graduacion_oi: e.target.value }))}
              placeholder="Ej: -1.25"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Descripción</label>
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              placeholder="Notas o descripción del cliente (ej: preferencias, alergias, observaciones)"
              rows={3}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              {editingId ? "Guardar cambios" : "Agregar cliente"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Eliminar cliente"
        message={deleteTarget ? `¿Eliminar al cliente "${deleteTarget.name}"? Esta acción no se puede deshacer.` : ""}
        confirmLabel="Eliminar"
        loading={deleteLoading}
      />

      <ClientHistoryModal clientId={historyClientId} open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}

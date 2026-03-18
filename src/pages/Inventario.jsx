import { useState } from "react";
import { Package, Plus, Pencil, Trash2, Search } from "lucide-react";
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
import { useProducts } from "../hooks/useProducts";
import { useToggle } from "../hooks/useToggle";
import { useSnackbar } from "../contexts/SnackbarContext";
import { formatCurrency } from "../utils/format";
import { TIPOS_PRODUCTO } from "../data/products.js";

const EMPTY_FORM = {
  nombre_producto: "",
  tipo_producto: "montura",
  marca: "",
  precio_compra: "",
  precio: "",
  stock: "",
  stock_minimo: "",
  descripcion: "",
  proveedor: "",
};

export function Inventario() {
  const [search, setSearch] = useState("");
  const { products, loading, error, totalCount, totalPages, page, pageSize, setPage, create, update, remove } = useProducts(search);
  const snackbar = useSnackbar();
  const [modalOpen, setModalOpen] = useToggle(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, tipo_producto: "montura" });
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setEditingId(p.id);
    setForm({
      nombre_producto: p.nombre_producto ?? "",
      tipo_producto: p.tipo_producto ?? "montura",
      marca: p.marca ?? "",
      precio_compra: p.precio_compra ?? "",
      precio: p.precio ?? "",
      stock: p.stock ?? "",
      stock_minimo: p.stock_minimo ?? p.stockMinimo ?? "",
      descripcion: p.descripcion ?? "",
      proveedor: p.proveedor ?? "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const body = {
        nombre_producto: form.nombre_producto.trim(),
        tipo_producto: form.tipo_producto,
        marca: (form.marca || "").trim(),
        precio_compra: Number(form.precio_compra) || 0,
        precio: Number(form.precio) || 0,
        stock: Number(form.stock) || 0,
        stockMinimo: Number(form.stock_minimo) || 0,
        descripcion: (form.descripcion || "").trim(),
        proveedor: (form.proveedor || "").trim(),
      };
      if (editingId) {
        await update(editingId, body);
        setEditingId(null);
        snackbar.success("Producto actualizado");
      } else {
        body.fecha_creacion = new Date().toISOString().slice(0, 10);
        await create(body);
        snackbar.success("Producto agregado");
      }
      setForm(EMPTY_FORM);
      setModalOpen(false);
    } catch (err) {
      snackbar.error(err?.message || "Error al guardar el producto");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await remove(deleteTarget.id);
      setDeleteTarget(null);
      snackbar.success("Producto eliminado");
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
            <Package className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Inventario</h1>
            <p className="text-slate-600 dark:text-slate-300">Gestión de productos de la óptica</p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar producto
        </Button>
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
              placeholder="Buscar producto o marca..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              aria-label="Buscar productos"
            />
          </div>
        </div>

        {loading && !products.length ? (
          <div className="py-6">
            <TableSkeleton columns={8} rows={6} />
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            message="No hay productos en inventario"
            description="Agrega monturas, lentes o accesorios para comenzar a vender."
            action={
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar producto
              </Button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Producto</TableHeaderCell>
                    <TableHeaderCell>Tipo</TableHeaderCell>
                    <TableHeaderCell>Marca</TableHeaderCell>
                    <TableHeaderCell>Proveedor</TableHeaderCell>
                    <TableHeaderCell className="text-right">P. compra</TableHeaderCell>
                    <TableHeaderCell className="text-right">Precio</TableHeaderCell>
                    <TableHeaderCell className="text-right">Stock</TableHeaderCell>
                    <TableHeaderCell className="w-28">Acciones</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-slate-800 dark:text-slate-100" title={p.descripcion || undefined}>
                        {p.nombre_producto}
                      </TableCell>
                      <TableCell className="capitalize text-slate-600 dark:text-slate-300">{p.tipo_producto}</TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-300">{p.marca}</TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-300 max-w-[120px] truncate" title={p.proveedor || undefined}>{p.proveedor || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-slate-600 dark:text-slate-400">{p.precio_compra != null && p.precio_compra !== "" ? formatCurrency(p.precio_compra) : "—"}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatCurrency(p.precio)}</TableCell>
                      <TableCell className="text-right">
                        <span className="tabular-nums">{p.stock}</span>
                        {(Number(p.stock_minimo ?? p.stockMinimo) || 0) > 0 && Number(p.stock) <= Number(p.stock_minimo ?? p.stockMinimo) && (
                          <span className="ml-1.5 inline-flex items-center rounded-md bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200" title="Stock en o por debajo del mínimo">
                            Bajo
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-primary-600 transition-colors"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ id: p.id, name: p.nombre_producto })}
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
        title={editingId ? "Editar producto" : "Agregar producto"}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nombre del producto"
              value={form.nombre_producto}
              onChange={(e) => setForm((f) => ({ ...f, nombre_producto: e.target.value }))}
              placeholder="Ej: Montura clásica negra"
              required
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Tipo</label>
              <select
                value={form.tipo_producto}
                onChange={(e) => setForm((f) => ({ ...f, tipo_producto: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-800 dark:text-slate-100 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                {TIPOS_PRODUCTO.map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <Input
              label="Marca"
              value={form.marca}
              onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))}
              placeholder="Ej: Ray-Ban"
            />
            <Input
              label="Proveedor"
              value={form.proveedor}
              onChange={(e) => setForm((f) => ({ ...f, proveedor: e.target.value }))}
              placeholder="Ej: Distribuidora Óptica"
            />
            <Input
              label="Precio de compra (C$)"
              type="number"
              min="0"
              step="0.01"
              value={form.precio_compra}
              onChange={(e) => setForm((f) => ({ ...f, precio_compra: e.target.value }))}
              placeholder="Costo del producto"
            />
            <Input
              label="Precio de venta (C$)"
              type="number"
              min="0"
              step="0.01"
              value={form.precio}
              onChange={(e) => setForm((f) => ({ ...f, precio: e.target.value }))}
              required
              placeholder="Precio al público"
            />
            <Input
              label="Stock"
              type="number"
              min="0"
              value={form.stock}
              onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
              required
            />
            <Input
              label="Stock mínimo"
              type="number"
              min="0"
              value={form.stock_minimo}
              onChange={(e) => setForm((f) => ({ ...f, stock_minimo: e.target.value }))}
              placeholder="Avisar cuando quede menos de..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
              Descripción
            </label>
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              placeholder="Ej: Montura metálica, material resistente."
              rows={2}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-y min-h-[72px]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">{editingId ? "Guardar cambios" : "Agregar producto"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Eliminar producto"
        message={deleteTarget ? `¿Eliminar "${deleteTarget.name}"? Esta acción no se puede deshacer.` : ""}
        confirmLabel="Eliminar"
        loading={deleteLoading}
      />
    </div>
  );
}

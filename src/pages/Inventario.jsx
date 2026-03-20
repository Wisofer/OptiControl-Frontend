import { useState, useEffect, useCallback } from "react";
import { Package, Plus, Pencil, Trash2, Search, AlertTriangle, PackagePlus, FileSpreadsheet, FileText } from "lucide-react";
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
  Badge,
} from "../components/ui";
import { useProducts } from "../hooks/useProducts";
import { useToggle } from "../hooks/useToggle";
import { useSnackbar } from "../contexts/SnackbarContext";
import { formatCurrency } from "../utils/format";
import { cn } from "../utils/cn";
import { TIPOS_PRODUCTO } from "../constants/productTypes.js";
import { isProductStockBajo } from "../utils/productStock.js";
import { productsApi } from "../api/products.js";
import { useExport } from "../hooks/useExport";

function normalizeLowStockResponse(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray(data.items)) return data.items;
  return [];
}

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
  const { products, loading, error, totalCount, totalPages, page, pageSize, setPage, refetch, create, update, remove, restock } =
    useProducts(search);
  const snackbar = useSnackbar();
  const [modalOpen, setModalOpen] = useToggle(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [lowStockLoading, setLowStockLoading] = useState(false);
  const [restockTarget, setRestockTarget] = useState(null);
  const [restockCantidad, setRestockCantidad] = useState("1");
  const [restockLoading, setRestockLoading] = useState(false);
  const { exportLoading, handleExportExcel, handleExportPdf } = useExport(
    "/api/products",
    () => ({ search: search || undefined }),
    "Inventario.xlsx",
    "Inventario.pdf"
  );

  const loadLowStock = useCallback(async () => {
    setLowStockLoading(true);
    try {
      const data = await productsApi.lowStock();
      setLowStockProducts(normalizeLowStockResponse(data));
    } catch {
      setLowStockProducts([]);
    } finally {
      setLowStockLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLowStock();
  }, [loadLowStock]);

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
      await loadLowStock();
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
      await loadLowStock();
    } catch (err) {
      snackbar.error(err?.message || "Error al eliminar");
    }
    setDeleteLoading(false);
  };

  const openRestock = (p) => {
    setRestockTarget({ id: p.id, name: p.nombre_producto });
    setRestockCantidad("1");
  };

  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    if (!restockTarget) return;
    const n = parseInt(String(restockCantidad).trim(), 10);
    if (!Number.isFinite(n) || n < 1) {
      snackbar.error("Indica una cantidad entera mayor que 0.");
      return;
    }
    setRestockLoading(true);
    try {
      await restock(restockTarget.id, n);
      snackbar.success("Stock actualizado");
      setRestockTarget(null);
      setRestockCantidad("1");
      await loadLowStock();
    } catch (err) {
      snackbar.error(err?.message || "Error al reponer inventario");
    }
    setRestockLoading(false);
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
            Agregar producto
          </Button>
        </div>
      </header>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {(lowStockLoading || lowStockProducts.length > 0) && (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2",
            lowStockProducts.length > 0
              ? "border-amber-200 bg-amber-50/90 dark:border-amber-800 dark:bg-amber-950/35"
              : "border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/40"
          )}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              className={cn(
                "h-5 w-5 shrink-0 mt-0.5",
                lowStockProducts.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-400"
              )}
            />
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100">Productos por reponer</p>
              {lowStockLoading ? (
                <p className="text-sm text-slate-600 dark:text-slate-400">Cargando…</p>
              ) : (
                <p className="text-sm text-amber-900/90 dark:text-amber-100/90">
                  {lowStockProducts.length} producto(s) con stock en o por debajo del mínimo.
                </p>
              )}
            </div>
          </div>
          {!lowStockLoading && lowStockProducts.length > 0 && (
            <Button type="button" variant="secondary" className="shrink-0" onClick={() => refetch()}>
              Actualizar tabla
            </Button>
          )}
        </div>
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
                    <TableHeaderCell className="w-36">Acciones</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {products.map((p) => (
                    <TableRow
                      key={p.id}
                      className={cn(isProductStockBajo(p) && "bg-amber-50/80 dark:bg-amber-950/20")}
                    >
                      <TableCell className="font-medium text-slate-800 dark:text-slate-100" title={p.descripcion || undefined}>
                        <span className="inline-flex items-center gap-2">
                          {isProductStockBajo(p) && (
                            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden />
                          )}
                          {p.nombre_producto}
                        </span>
                      </TableCell>
                      <TableCell className="capitalize text-slate-600 dark:text-slate-300">{p.tipo_producto}</TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-300">{p.marca}</TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-300 max-w-[120px] truncate" title={p.proveedor || undefined}>{p.proveedor || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-slate-600 dark:text-slate-400">{p.precio_compra != null && p.precio_compra !== "" ? formatCurrency(p.precio_compra) : "—"}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatCurrency(p.precio)}</TableCell>
                      <TableCell className="text-right">
                        <span className="tabular-nums">{p.stock}</span>
                        {isProductStockBajo(p) && (
                          <Badge variant="warning" className="ml-2">
                            Bajo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-0.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => openRestock(p)}
                            className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                            title="Reponer inventario"
                          >
                            <PackagePlus className="h-4 w-4" />
                          </button>
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

      <Modal
        open={!!restockTarget}
        onClose={() => !restockLoading && setRestockTarget(null)}
        title="Reponer inventario"
        size="sm"
      >
        {restockTarget && (
          <form onSubmit={handleRestockSubmit} className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Sumar unidades al stock de <span className="font-medium text-slate-800 dark:text-slate-100">{restockTarget.name}</span> (no reemplaza el total).
            </p>
            <Input
              label="Cantidad a ingresar"
              type="number"
              min="1"
              step="1"
              required
              value={restockCantidad}
              onChange={(e) => setRestockCantidad(e.target.value)}
              placeholder="Ej: 10"
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <Button type="button" variant="secondary" disabled={restockLoading} onClick={() => setRestockTarget(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={restockLoading}>
                {restockLoading ? "Guardando…" : "Confirmar reposición"}
              </Button>
            </div>
          </form>
        )}
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

import { useState, useMemo } from "react";
import { ShoppingCart, Plus, Minus, Trash2, Package, Search, FileText, Wrench } from "lucide-react";
import { Card, Button, Modal } from "../components/ui";
import { useClients } from "../hooks/useClients";
import { useProducts } from "../hooks/useProducts";
import { useServices } from "../hooks/useServices";
import { useSettings } from "../hooks/useSettings";
import { useSnackbar } from "../contexts/SnackbarContext";
import { formatCurrency } from "../utils/format";
import { salesApi } from "../api/sales.js";
import { cn } from "../utils/cn";

const TAB_PRODUCTOS = "productos";
const TAB_SERVICIOS = "servicios";

export function Ventas() {
  const [productSearch, setProductSearch] = useState("");
  const [ventasTab, setVentasTab] = useState(TAB_PRODUCTOS);
  const { clients } = useClients("", 200);
  const { products, loading: productsLoading } = useProducts(productSearch, 50);
  const { services, loading: servicesLoading } = useServices(productSearch, 50);
  const { settings } = useSettings();
  const snackbar = useSnackbar();

  const exchangeRate = Number(settings?.exchangeRate) || 36.8;

  const [selectedClientId, setSelectedClientId] = useState("");
  const [cart, setCart] = useState([]);
  const [registering, setRegistering] = useState(false);
  const [tipoPago, setTipoPago] = useState("Efectivo");
  const [moneda, setMoneda] = useState("NIO");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [saleForPrintCard, setSaleForPrintCard] = useState(null);

  const selectedClient = useMemo(() => {
    if (!selectedClientId) return { id: "general", name: "Cliente General" };
    return clients.find((c) => String(c.id) === String(selectedClientId)) || null;
  }, [clients, selectedClientId]);

  const subtotal = useMemo(() => cart.reduce((a, it) => a + (it.subtotal || 0), 0), [cart]);
  const total = subtotal;

  /** Total en córdobas (siempre). */
  const totalCordobas = total;

  /** Total en dólares cuando la moneda de pago es USD (conversión con tipo de cambio). */
  const totalDolares = useMemo(
    () => (exchangeRate > 0 ? totalCordobas / exchangeRate : 0),
    [totalCordobas, exchangeRate]
  );

  /** Total a mostrar según moneda seleccionada (valor numérico en esa moneda). */
  const totalAPagar = moneda === "USD" ? totalDolares : totalCordobas;

  const montoNum = useMemo(() => {
    const raw = String(montoRecibido).replace(",", ".").trim();
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  }, [montoRecibido]);

  const vuelto = useMemo(() => {
    if (montoNum <= 0) return null;
    if (moneda === "USD") {
      if (montoNum < totalDolares) return null;
      const vueltoDolares = montoNum - totalDolares;
      const vueltoCordobas = vueltoDolares * exchangeRate;
      return { cordobas: vueltoCordobas, dolares: vueltoDolares };
    }
    if (montoNum < totalCordobas) return null;
    return { cordobas: montoNum - totalCordobas, dolares: null };
  }, [montoNum, moneda, totalCordobas, totalDolares, exchangeRate]);

  const cartItemKey = (it) => (it.type === "service" ? `s-${it.serviceId}` : `p-${it.productId}`);

  const addToCartProduct = (product, qty = 1) => {
    const quantity = Math.max(1, Math.min(qty, Number(product.stock) || 0));
    const unitPrice = Number(product.precio) || 0;
    const subtotalItem = unitPrice * quantity;
    setCart((prev) => {
      const idx = prev.findIndex((it) => it.type === "product" && String(it.productId) === String(product.id));
      if (idx >= 0) {
        const item = prev[idx];
        const newQty = Math.min(item.quantity + quantity, Number(product.stock) || 0);
        const newSub = (Number(product.precio) || 0) * newQty;
        const next = [...prev];
        next[idx] = { ...item, quantity: newQty, subtotal: newSub };
        return next;
      }
      return [...prev, { type: "product", productId: product.id, productName: product.nombre_producto, unitPrice, quantity, subtotal: subtotalItem }];
    });
  };

  const addToCartService = (service, qty = 1) => {
    const quantity = Math.max(1, qty);
    const unitPrice = Number(service.precio) || 0;
    const subtotalItem = unitPrice * quantity;
    setCart((prev) => {
      const idx = prev.findIndex((it) => it.type === "service" && String(it.serviceId) === String(service.id));
      if (idx >= 0) {
        const item = prev[idx];
        const newQty = item.quantity + quantity;
        const next = [...prev];
        next[idx] = { ...item, quantity: newQty, subtotal: item.unitPrice * newQty };
        return next;
      }
      return [...prev, { type: "service", serviceId: service.id, serviceName: service.nombre_servicio, unitPrice, quantity, subtotal: subtotalItem }];
    });
  };

  const updateCartQty = (it, delta) => {
    setCart((prev) => {
      const idx = prev.findIndex((x) => cartItemKey(x) === cartItemKey(it));
      if (idx < 0) return prev;
      const item = prev[idx];
      let newQty = item.quantity + delta;
      if (item.type === "product") {
        const product = products.find((p) => String(p.id) === String(item.productId));
        const maxStock = Number(product?.stock) || 0;
        newQty = Math.max(0, Math.min(newQty, maxStock));
      } else {
        newQty = Math.max(0, newQty);
      }
      if (newQty === 0) return prev.filter((_, i) => i !== idx);
      const next = [...prev];
      next[idx] = { ...item, quantity: newQty, subtotal: item.unitPrice * newQty };
      return next;
    });
  };

  const removeFromCart = (it) => {
    setCart((prev) => prev.filter((x) => cartItemKey(x) !== cartItemKey(it)));
  };

  const getItemDisplayName = (it) => (it.type === "service" ? it.serviceName : it.productName);

  const handleSaveQuote = async () => {
    if (cart.length === 0) {
      snackbar.error("Agrega al menos un producto o servicio al carrito");
      return;
    }
    setRegistering(true);
    try {
      const items = cart.map((it) => {
        const base = { quantity: it.quantity, unitPrice: it.unitPrice, subtotal: it.subtotal };
        if (it.type === "service") {
          return { ...base, serviceId: it.serviceId, serviceName: it.serviceName };
        }
        return { ...base, productId: it.productId, productName: it.productName };
      });
      await salesApi.create({
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        items,
        total,
        paymentMethod: tipoPago,
        currency: moneda,
        status: "cotizacion",
      });
      snackbar.success("Cotización guardada. Aparecerá en Historial.");
      setSelectedClientId("");
      setCart([]);
      setMontoRecibido("");
    } catch (err) {
      snackbar.error(err?.message || "Error al guardar la cotización");
    }
    setRegistering(false);
  };

  const handleRegisterSale = async () => {
    if (cart.length === 0) {
      snackbar.error("Agrega al menos un producto o servicio al carrito");
      return;
    }
    setRegistering(true);
    try {
      const items = cart.map((it) => {
        const base = { quantity: it.quantity, unitPrice: it.unitPrice, subtotal: it.subtotal };
        if (it.type === "service") {
          return { ...base, serviceId: it.serviceId, serviceName: it.serviceName };
        }
        return { ...base, productId: it.productId, productName: it.productName };
      });
      const amountPaidEnMonedaPago = montoNum;
      const amountPaidCordobas = moneda === "USD" ? amountPaidEnMonedaPago * exchangeRate : amountPaidEnMonedaPago;
      const totalPagadoParaRegistro = amountPaidCordobas >= totalCordobas ? totalCordobas : amountPaidCordobas;
      await salesApi.create({
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        items,
        total: totalCordobas,
        amountPaid: totalPagadoParaRegistro,
        paymentMethod: tipoPago,
        currency: moneda,
      });
      const isPartial = amountPaidEnMonedaPago > 0 && amountPaidEnMonedaPago < totalAPagar;
      const pendiente = totalAPagar - amountPaidEnMonedaPago;
      snackbar.success(isPartial ? `Venta registrada. Pendiente: ${formatCurrency(pendiente, moneda)}` : "Venta registrada correctamente");
      setSaleForPrintCard({
        clientName: selectedClient.name,
        items: cart.map((it) => ({ productName: getItemDisplayName(it), quantity: it.quantity, subtotal: it.subtotal })),
        total: totalCordobas,
        totalAPagarEnMoneda: totalAPagar,
        amountPaid: amountPaidEnMonedaPago,
        amountPaidCordobas,
        moneda,
        tipoPago,
        exchangeRate,
      });
      setSelectedClientId("");
      setCart([]);
      setMontoRecibido("");
    } catch (err) {
      snackbar.error(err?.message || "Error al registrar la venta");
    }
    setRegistering(false);
  };

  const handlePrintInvoice = () => {
    if (!saleForPrintCard) return;
    const companyName = settings?.companyName?.trim() || "OptiControl";
    const rate = Number(saleForPrintCard.exchangeRate) || 36.8;
    const itemsRows = saleForPrintCard.items
      .map((it) => {
        const subtotalEnMoneda = saleForPrintCard.moneda === "USD" ? it.subtotal / rate : it.subtotal;
        return `<tr><td>${(it.productName || "").replace(/</g, "&lt;")}</td><td align="right">${it.quantity}</td><td align="right">${formatCurrency(subtotalEnMoneda, saleForPrintCard.moneda)}</td></tr>`;
      })
      .join("");
    const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Factura</title>
<style>body{font-family:system-ui,sans-serif;max-width:400px;margin:2rem auto;padding:1rem;} table{width:100%;border-collapse:collapse;} th,td{border-bottom:1px solid #eee;padding:6px 0;} th{text-align:left;} .total{font-size:1.25rem;font-weight:bold;margin-top:1rem;}</style>
</head><body>
<h2>${companyName}</h2>
<p><strong>Factura / Recibo</strong></p>
<p>Cliente: ${saleForPrintCard.clientName}</p>
<p>Fecha: ${new Date().toLocaleString("es-NI")}</p>
<p>Forma de pago: ${saleForPrintCard.tipoPago}</p>
<table>
<thead><tr><th>Producto</th><th align="right">Cant.</th><th align="right">Subtotal</th></tr></thead>
<tbody>${itemsRows}</tbody>
</table>
<p class="total">Total: ${formatCurrency(saleForPrintCard.totalAPagarEnMoneda ?? saleForPrintCard.total, saleForPrintCard.moneda)}</p>
<p style="margin-top:2rem;font-size:0.875rem;color:#666;">Gracias por su compra.</p>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => {
        w.print();
        w.close();
      }, 300);
    }
    setSaleForPrintCard(null);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] min-h-[480px] overflow-hidden">
      {/* Dos columnas: Productos (grid) | Carrito — fijas, sin scroll de página */}
      <div className="grid gap-4 lg:grid-cols-[1fr_440px] flex-1 min-h-0 overflow-hidden">
        {/* Columna izquierda: Productos en grid de tarjetas */}
        <Card className="flex flex-col min-h-0 overflow-hidden p-0">
          <div className="shrink-0 px-4 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
              <button
                type="button"
                onClick={() => setVentasTab(TAB_PRODUCTOS)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors",
                  ventasTab === TAB_PRODUCTOS
                    ? "bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                <Package className="h-4 w-4" />
                Productos
              </button>
              <button
                type="button"
                onClick={() => setVentasTab(TAB_SERVICIOS)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors",
                  ventasTab === TAB_SERVICIOS
                    ? "bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                <Wrench className="h-4 w-4" />
                Servicios
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="search"
                placeholder="Buscar producto o servicio..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4">
            {ventasTab === TAB_PRODUCTOS && (
              <>
                {productsLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="h-32 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    ))}
                  </div>
                ) : products.length === 0 ? (
                  <p className="text-sm text-slate-500 py-8 text-center">No hay productos. Agrega productos en Inventario.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {products.map((p) => {
                      const hasStock = (p.stock ?? 0) > 0;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => hasStock && addToCartProduct(p)}
                          disabled={!hasStock}
                          className={cn(
                            "rounded-xl border-2 bg-white dark:bg-slate-900 transition-all text-left w-full",
                            hasStock
                              ? "border-slate-200 dark:border-slate-700 hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-md cursor-pointer active:scale-[0.98]"
                              : "border-slate-100 dark:border-slate-800 opacity-75 cursor-not-allowed"
                          )}
                        >
                          <div className="p-3 flex flex-col h-full">
                            <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm line-clamp-2 min-h-[2.5rem]">
                              {p.nombre_producto}
                            </p>
                            <p className="text-lg font-bold text-primary-600 dark:text-primary-400 mt-1 tabular-nums">
                              {formatCurrency(p.precio)}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              Stock: {p.stock}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            {ventasTab === TAB_SERVICIOS && (
              <>
                {servicesLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="h-32 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    ))}
                  </div>
                ) : services.length === 0 ? (
                  <p className="text-sm text-slate-500 py-8 text-center">No hay servicios. Agrega servicios en Servicios.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {services.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => addToCartService(s)}
                        className="rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-md cursor-pointer active:scale-[0.98] transition-all text-left w-full"
                      >
                        <div className="p-3 flex flex-col h-full">
                          <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm line-clamp-2 min-h-[2.5rem]">
                            {s.nombre_servicio}
                          </p>
                          <p className="text-lg font-bold text-primary-600 dark:text-primary-400 mt-1 tabular-nums">
                            {formatCurrency(s.precio)}
                          </p>
                          {s.descripcion ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                              {s.descripcion}
                            </p>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </Card>

        {/* Columna derecha: Cliente + Carrito fijo, scroll solo en la lista de ítems */}
        <Card className="flex flex-col min-h-0 min-w-0 border-2 border-primary-200 dark:border-primary-800 p-0 overflow-hidden">
          {/* Cliente */}
          <div className="shrink-0 px-4 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
              Cliente
            </p>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className={cn(
                "w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 pr-9 text-sm font-medium text-slate-800 dark:text-slate-100",
                "focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20",
                "appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2364748b%22 stroke-width=%222%22%3E%3Cpath d=%22m6 9 6 6 6-6%22/%3E%3C/svg%3E')] bg-[length:1rem] bg-[right_0.5rem_center] bg-no-repeat"
              )}
            >
              <option value="">Cliente General (Venta Rápida)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `· ${c.phone}` : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Selecciona un cliente o usa &quot;Cliente General&quot; para ventas rápidas.
            </p>
          </div>

          {/* Carrito: lista con scroll interno; bloque de pago siempre fijo abajo */}
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {cart.length === 0 ? (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-4 py-6">
                <ShoppingCart className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Carrito vacío</p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">Agrega productos o servicios del listado.</p>
              </div>
            ) : (
              <>
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-2 overscroll-contain">
                  <div className="space-y-1.5">
                    {cart.map((it) => (
                      <div
                        key={cartItemKey(it)}
                        className="flex items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-2 py-1.5"
                      >
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400">
                          {it.type === "service" ? <Wrench className="h-3 w-3" /> : <Package className="h-3 w-3" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate leading-tight">
                            {getItemDisplayName(it)}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="inline-flex items-center rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900">
                              <button
                                type="button"
                                onClick={() => updateCartQty(it, -1)}
                                className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-l"
                              >
                                <Minus className="h-3 w-3 text-slate-600 dark:text-slate-400" />
                              </button>
                              <span className="min-w-[1.75rem] text-center text-xs font-medium tabular-nums">
                                {it.quantity}x
                              </span>
                              <button
                                type="button"
                                onClick={() => updateCartQty(it, 1)}
                                className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-r"
                              >
                                <Plus className="h-3 w-3 text-slate-600 dark:text-slate-400" />
                              </button>
                            </span>
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                              {formatCurrency(it.subtotal)}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(it)}
                          className="shrink-0 p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded"
                          title="Quitar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bloque de pago abajo: tipo de pago, moneda, total, monto, vuelto, Procesar */}
                <div className="shrink-0 mt-auto border-t border-slate-200 dark:border-slate-700 px-4 py-3 bg-slate-50/50 dark:bg-slate-800/30 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Tipo de pago</label>
                      <select
                        value={tipoPago}
                        onChange={(e) => setTipoPago(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      >
                        <option value="Efectivo">Efectivo</option>
                        <option value="Tarjeta">Tarjeta</option>
                        <option value="Transferencia">Transferencia</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Moneda</label>
                      <select
                        value={moneda}
                        onChange={(e) => setMoneda(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      >
                        <option value="NIO">C$ Córdobas</option>
                        <option value="USD">$ Dólares</option>
                      </select>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tipo de cambio: C$ {exchangeRate.toFixed(2)} = $1 USD
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Total a pagar</span>
                    <span className="text-xl font-bold tabular-nums text-primary-600 dark:text-primary-400">
                      {formatCurrency(totalAPagar, moneda)}
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Monto recibido
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {moneda === "NIO" ? "C$" : "$"}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder={moneda === "NIO" ? "Ej: 500.00" : "Ej: 15.00"}
                        value={montoRecibido}
                        onChange={(e) => setMontoRecibido(e.target.value)}
                        className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm font-medium tabular-nums text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                  {vuelto !== null && (
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-2">
                      <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">
                        {moneda === "USD"
                          ? "Vuelto a devolver (en córdobas)"
                          : "Vuelto a devolver"}
                      </p>
                      <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                        {formatCurrency(vuelto.cordobas, "NIO")}
                      </p>
                      {moneda === "USD" && vuelto.dolares != null && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                          equivale a {formatCurrency(vuelto.dolares, "USD")}
                        </p>
                      )}
                    </div>
                  )}
                  {montoRecibido.trim() !== "" && montoNum > 0 && montoNum < totalAPagar && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Quedará pendiente: {formatCurrency(totalAPagar - montoNum, moneda)}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="flex-1 py-2.5"
                      onClick={handleSaveQuote}
                      disabled={registering || cart.length === 0}
                    >
                      Guardar Cotización
                    </Button>
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white border-0 py-2.5"
                      size="lg"
                      onClick={handleRegisterSale}
                      disabled={registering || cart.length === 0}
                    >
                      {registering ? "Procesando…" : "✔ Procesar Venta"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Card: ¿Quieres imprimir la factura? (tras cada venta) */}
      <Modal
        open={!!saleForPrintCard}
        onClose={() => setSaleForPrintCard(null)}
        title="Venta registrada"
        size="md"
      >
        {saleForPrintCard && (
          <div className="space-y-4">
            <p className="text-slate-600 dark:text-slate-300">
              ¿Quieres imprimir la factura?
            </p>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 p-4 space-y-2">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                Cliente: {saleForPrintCard.clientName}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Total: {formatCurrency(saleForPrintCard.totalAPagarEnMoneda ?? saleForPrintCard.total, saleForPrintCard.moneda)} · {saleForPrintCard.tipoPago}
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handlePrintInvoice}
                className="flex-1 inline-flex items-center justify-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Imprimir factura
              </Button>
              <Button variant="secondary" onClick={() => setSaleForPrintCard(null)}>
                No, gracias
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

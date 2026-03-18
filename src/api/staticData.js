/**
 * Datos estáticos para modo demo (VITE_STATIC_DEMO=true).
 * OptiControl: óptica - productos, clientes, historial de ventas.
 */

import { mockClients } from "../data/clients.js";
import { mockActivity } from "../data/activity.js";
import { mockMonthlyIncome } from "../data/monthlyIncome.js";
import { mockUsers } from "../data/users.js";
import { mockWhatsappTemplates } from "../data/whatsappTemplates.js";
import { mockProducts } from "../data/products.js";
import { mockSalesHistory } from "../data/salesHistory.js";
import { mockEgresos } from "../data/egresos.js";
import { mockServices } from "../data/services.js";
import { DEFAULT_COMPANY_NAME, DEFAULT_CURRENCY, DEFAULT_EXCHANGE_RATE } from "../config/brand.js";

// Stores mutables en memoria para la demo (persisten durante la sesión)
let memoryClients = JSON.parse(JSON.stringify(mockClients));
let memoryProducts = JSON.parse(JSON.stringify(mockProducts));
let memoryServices = JSON.parse(JSON.stringify(mockServices));
let memorySalesHistory = JSON.parse(JSON.stringify(mockSalesHistory));
let memoryEgresos = JSON.parse(JSON.stringify(mockEgresos));
let memoryActivity = [...mockActivity];

const staticUser = {
  id: 1,
  usuario: "admin",
  nombreCompleto: "Administrador Demo",
  rol: "Administrador",
  estado: "Activo",
};

const staticSettings = {
  companyName: DEFAULT_COMPANY_NAME,
  email: "contacto@agencia.com",
  phone: "505 8123 4567",
  address: "Managua, Nicaragua",
  currency: DEFAULT_CURRENCY,
  language: "es",
  exchangeRate: DEFAULT_EXCHANGE_RATE,
  theme: "light",
  soundVolume: 30,
  alertsFacturasVencidas: true,
  alertsRecordatorios: false,
  updatedAt: new Date().toISOString(),
};

function paginate(items, page = 1, pageSize = 20) {
  const p = Math.max(1, Number(page) || 1);
  const ps = Math.max(1, Number(pageSize) || 20);
  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / ps));
  const start = (p - 1) * ps;
  const list = items.slice(start, start + ps);
  return { items: list, totalCount, totalPages, page: p, pageSize: ps };
}

function getToday() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function getMonthStart() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function notCancelled(s) {
  return (s.status || "Pagada") !== "Cancelada";
}

/** Ingreso real: Pagada = total, pendiente = amountPaid, cotización/Cancelada = 0 */
function revenueFromSale(s) {
  const status = s.status || "Pagada";
  if (status === "Cancelada" || status === "cotizacion") return 0;
  if (status === "Pagada") return s.total || 0;
  if (status === "pendiente") return Number(s.amountPaid) || 0;
  return s.total || 0;
}

function isRealSale(s) {
  const status = s.status || "Pagada";
  return status === "Pagada" || status === "pendiente";
}

function dashboardSummary() {
  const salesForRevenue = memorySalesHistory.filter((s) => (s.status || "Pagada") !== "Cancelada" && (s.status || "Pagada") !== "cotizacion");
  const totalRevenue = salesForRevenue.reduce((a, v) => a + revenueFromSale(v), 0);
  const today = getToday();
  const monthStart = getMonthStart();
  const salesToday = salesForRevenue
    .filter((v) => (v.date || "").slice(0, 10) === today)
    .reduce((a, v) => a + revenueFromSale(v), 0);
  const salesMonth = salesForRevenue
    .filter((v) => (v.date || "").slice(0, 10) >= monthStart)
    .reduce((a, v) => a + revenueFromSale(v), 0);
  const productsCount = memoryProducts.reduce((a, p) => a + (Number(p.stock) || 0), 0);
  return {
    totalRevenue,
    salesToday,
    salesMonth,
    productsCount,
    clientsCount: memoryClients.length,
    productsTotal: memoryProducts.length,
  };
}

function monthlyIncomeFromSales() {
  const byMonth = {};
  memorySalesHistory.forEach((v) => {
    const status = v.status || "Pagada";
    if (status === "Cancelada" || status === "cotizacion") return;
    const date = (v.date || "").slice(0, 7);
    if (!date) return;
    byMonth[date] = (byMonth[date] || 0) + revenueFromSale(v);
  });
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const now = new Date();
  return [2, 1, 0].map((i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { month: months[d.getMonth()], monthName: months[d.getMonth()], amount: byMonth[key] || 0 };
  }).reverse();
}

function topProductsSold() {
  const count = {};
  memorySalesHistory.filter(isRealSale).forEach((s) => {
    (s.items || []).forEach((it) => {
      const name = it.productName || it.serviceName || "Producto";
      count[name] = (count[name] || 0) + (it.quantity || 0);
    });
  });
  return Object.entries(count)
    .map(([name, qty]) => ({ name, quantity: qty }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);
}

function activityWithIds() {
  const list = memoryActivity.length ? memoryActivity : mockActivity;
  return list.map((a, i) => ({
    ...a,
    id: a.id || `A${i + 1}`,
  }));
}

function monthlyWithMonthName() {
  return mockMonthlyIncome.map((m) => ({
    ...m,
    monthName: m.monthName || m.month || m.month,
  }));
}

export function getStaticResponse(pathname, method = "GET", body) {
  const path = pathname.replace(/\?.*$/, "").toLowerCase();

  // Auth
  if (path.includes("/api/auth/login")) {
    return Promise.resolve({ token: "demo-token-estatico", user: staticUser });
  }
  if (path.includes("/api/auth/logout")) {
    return Promise.resolve(null);
  }
  if (path.includes("/api/auth/me")) {
    return Promise.resolve(staticUser);
  }

  // Dashboard
  if (path.includes("/api/dashboard/summary")) {
    return Promise.resolve(dashboardSummary());
  }
  if (path.includes("/api/dashboard/recent-activity")) {
    return Promise.resolve(activityWithIds());
  }
  if (path.includes("/api/dashboard/monthly-income")) {
    return Promise.resolve(monthlyIncomeFromSales());
  }
  if (path.includes("/api/dashboard/top-products")) {
    return Promise.resolve(topProductsSold());
  }
  if (path.includes("/api/dashboard/alerts")) {
    return Promise.resolve(null);
  }

  // Settings
  if (path.includes("/api/settings")) {
    if (method === "PUT") return Promise.resolve(body || staticSettings);
    return Promise.resolve(staticSettings);
  }

  // Agency
  if (path.includes("/api/agency")) {
    if (method === "PUT") return Promise.resolve(body || {});
    return Promise.resolve({
      name: staticSettings.companyName,
      email: staticSettings.email,
      phone: staticSettings.phone,
      address: staticSettings.address,
    });
  }

  // Exchange rate
  if (path.includes("/api/exchange-rate")) {
    if (method === "PUT") return Promise.resolve(body || { exchangeRate: DEFAULT_EXCHANGE_RATE });
    return Promise.resolve({ exchangeRate: DEFAULT_EXCHANGE_RATE });
  }

  // Clients
  if (path.includes("/api/clients")) {
    const match = path.match(/\/api\/clients\/(\d+)/);
    const historyMatch = path.match(/\/api\/clients\/(\d+)\/history/);
    if (historyMatch) {
      const clientId = historyMatch[1];
      const client = memoryClients.find((c) => String(c.id) === clientId) || memoryClients[0];
      const clientSales = memorySalesHistory.filter((s) => String(s.clientId) === String(clientId));
      const activity = clientSales
        .map((s) => ({
          id: `h-${s.id}`,
          time: (s.date || "").slice(0, 16).replace("T", " "),
          description: `Venta ${s.id} · C$${s.total ?? 0}`,
        }))
        .sort((a, b) => (b.time > a.time ? 1 : -1))
        .slice(0, 15);
      return Promise.resolve({
        client: { ...client },
        reservations: { items: [], totalCount: 0, totalPages: 1, page: 1, pageSize: 10 },
        sales: { items: clientSales, totalCount: clientSales.length, totalPages: 1, page: 1, pageSize: 10 },
        invoices: { items: [], totalCount: 0, totalPages: 1, page: 1, pageSize: 10 },
        activity,
      });
    }
    if (method === "DELETE" && match) {
      memoryClients = memoryClients.filter((c) => String(c.id) !== match[1]);
      return Promise.resolve(null);
    }
    if (method === "PUT" && match) {
      const idx = memoryClients.findIndex((c) => String(c.id) === match[1]);
      const updated = body ? { ...memoryClients[idx], ...body, id: match[1] } : memoryClients[idx];
      if (idx >= 0) memoryClients[idx] = updated;
      return Promise.resolve(updated);
    }
    if (method === "POST" && !match) {
      const newId = String(memoryClients.length + 1);
      const created = { ...body, id: newId };
      memoryClients.push(created);
      memoryActivity.unshift({ id: `A-${Date.now()}`, type: "client", description: `Cliente agregado: ${body?.name || "Nuevo"}`, time: new Date().toISOString().slice(0, 16).replace("T", " ") });
      return Promise.resolve(created);
    }
    if (match) {
      const one = memoryClients.find((c) => String(c.id) === match[1]);
      if (one) return Promise.resolve(one);
      return Promise.resolve(memoryClients[0]);
    }
    const page = new URLSearchParams(pathname.split("?")[1] || "").get("page") || 1;
    const pageSize = new URLSearchParams(pathname.split("?")[1] || "").get("pageSize") || 20;
    const search = new URLSearchParams(pathname.split("?")[1] || "").get("search") || "";
    let list = memoryClients;
    if (search) {
      const q = search.toLowerCase().trim();
      list = list.filter((c) => (c.name || "").toLowerCase().includes(q) || (c.phone || "").includes(q));
    }
    return Promise.resolve(paginate(list, page, pageSize));
  }

  // Products (inventario)
  if (path.includes("/api/products")) {
    if (method === "GET" && path.endsWith("/low-stock")) {
      const low = memoryProducts
        .filter((p) => {
          const min = Number(p.stock_minimo ?? p.stockMinimo ?? 0);
          return min > 0 && (Number(p.stock) || 0) < min;
        })
        .sort((a, b) => (Number(a.stock) || 0) - (Number(b.stock) || 0));
      return Promise.resolve(Array.isArray(low) ? low : []);
    }
    const match = path.match(/\/api\/products\/(\d+)/);
    if (method === "DELETE" && match) {
      memoryProducts = memoryProducts.filter((p) => String(p.id) !== match[1]);
      return Promise.resolve(null);
    }
    if (method === "PUT" && match) {
      const idx = memoryProducts.findIndex((p) => String(p.id) === match[1]);
      const updated = body ? { ...memoryProducts[idx], ...body, id: Number(match[1]) } : memoryProducts[idx];
      if (idx >= 0) memoryProducts[idx] = updated;
      memoryActivity.unshift({ id: `A-${Date.now()}`, type: "inventory", description: `Inventario actualizado: ${updated?.nombre_producto || ""}`, time: new Date().toISOString().slice(0, 16).replace("T", " ") });
      return Promise.resolve(updated);
    }
    if (method === "POST" && !match) {
      const newId = Math.max(0, ...memoryProducts.map((p) => Number(p.id))) + 1;
      const created = { ...body, id: newId, fecha_creacion: body?.fecha_creacion || new Date().toISOString().slice(0, 10) };
      memoryProducts.push(created);
      memoryActivity.unshift({ id: `A-${Date.now()}`, type: "product", description: `Producto agregado: ${body?.nombre_producto || ""}`, time: new Date().toISOString().slice(0, 16).replace("T", " ") });
      return Promise.resolve(created);
    }
    if (match) {
      const one = memoryProducts.find((p) => String(p.id) === match[1]);
      return Promise.resolve(one || memoryProducts[0]);
    }
    const page = new URLSearchParams(pathname.split("?")[1] || "").get("page") || 1;
    const pageSize = new URLSearchParams(pathname.split("?")[1] || "").get("pageSize") || 20;
    const search = new URLSearchParams(pathname.split("?")[1] || "").get("search") || "";
    let list = memoryProducts;
    if (search) {
      const q = search.toLowerCase().trim();
      list = list.filter((p) => (p.nombre_producto || "").toLowerCase().includes(q) || (p.marca || "").toLowerCase().includes(q));
    }
    return Promise.resolve(paginate(list, page, pageSize));
  }

  // Services (servicios de óptica)
  if (path.includes("/api/services")) {
    const match = path.match(/\/api\/services\/(\d+)/);
    if (method === "DELETE" && match) {
      memoryServices = memoryServices.filter((s) => String(s.id) !== match[1]);
      return Promise.resolve(null);
    }
    if (method === "PUT" && match) {
      const idx = memoryServices.findIndex((s) => String(s.id) === match[1]);
      const updated = body ? { ...memoryServices[idx], ...body, id: Number(match[1]) } : memoryServices[idx];
      if (idx >= 0) memoryServices[idx] = updated;
      memoryActivity.unshift({ id: `A-${Date.now()}`, type: "service", description: `Servicio actualizado: ${updated?.nombre_servicio || ""}`, time: new Date().toISOString().slice(0, 16).replace("T", " ") });
      return Promise.resolve(updated);
    }
    if (method === "POST" && !match) {
      const newId = Math.max(0, ...memoryServices.map((s) => Number(s.id))) + 1;
      const created = { ...body, id: newId, fecha_creacion: body?.fecha_creacion || new Date().toISOString().slice(0, 10) };
      memoryServices.push(created);
      memoryActivity.unshift({ id: `A-${Date.now()}`, type: "service", description: `Servicio agregado: ${body?.nombre_servicio || ""}`, time: new Date().toISOString().slice(0, 16).replace("T", " ") });
      return Promise.resolve(created);
    }
    if (match) {
      const one = memoryServices.find((s) => String(s.id) === match[1]);
      return Promise.resolve(one || memoryServices[0]);
    }
    const page = new URLSearchParams(pathname.split("?")[1] || "").get("page") || 1;
    const pageSize = new URLSearchParams(pathname.split("?")[1] || "").get("pageSize") || 20;
    const search = new URLSearchParams(pathname.split("?")[1] || "").get("search") || "";
    let list = memoryServices;
    if (search) {
      const q = search.toLowerCase().trim();
      list = list.filter((s) => (s.nombre_servicio || "").toLowerCase().includes(q) || (s.descripcion || "").toLowerCase().includes(q));
    }
    return Promise.resolve(paginate(list, page, pageSize));
  }

  // Sales (registrar venta o cotización - carrito)
  if (path.includes("/api/sales") && !path.includes("/api/sales-history")) {
    if (method === "POST") {
      const isQuote = body?.status === "cotizacion";
      const total = body?.total ?? 0;
      const amountPaid = body?.amountPaid != null ? Number(body.amountPaid) : total;

      if (!isQuote) {
        (body?.items || []).forEach((it) => {
          if (it.productId != null) {
            const p = memoryProducts.find((x) => String(x.id) === String(it.productId));
            if (p && (p.stock != null)) p.stock = Math.max(0, (Number(p.stock) || 0) - (it.quantity || 0));
          }
        });
      }

      const newId = "V" + (memorySalesHistory.length + 1);
      let status = "Pagada";
      if (isQuote) status = "cotizacion";
      else if (amountPaid < total) status = "pendiente";

      const created = {
        id: newId,
        date: new Date().toISOString(),
        clientId: body?.clientId,
        clientName: body?.clientName,
        items: body?.items || [],
        total,
        amountPaid: isQuote ? 0 : amountPaid,
        paymentMethod: body?.paymentMethod ?? "Efectivo",
        currency: body?.currency ?? "NIO",
        status,
      };
      memorySalesHistory.unshift(created);
      if (isQuote) {
        memoryActivity.unshift({ id: `A-${Date.now()}`, type: "sale", description: `Cotización guardada - ${body?.clientName || "Cliente"} · C$${total}`, time: new Date().toISOString().slice(0, 16).replace("T", " ") });
      } else {
        memoryActivity.unshift({ id: `A-${Date.now()}`, type: "sale", description: status === "pendiente" ? `Venta (pendiente) - ${body?.clientName || "Cliente"} · C$${amountPaid}/${total}` : `Venta registrada - ${body?.clientName || "Cliente"} · C$${total}`, time: new Date().toISOString().slice(0, 16).replace("T", " ") });
      }
      return Promise.resolve(created);
    }
  }

  // Sales history (historial de ventas)
  if (path.includes("/api/sales-history")) {
    const match = path.match(/\/api\/sales-history\/([^/]+)/);
    if (method === "PUT" && match) {
      const sale = memorySalesHistory.find((s) => String(s.id) === match[1]);
      if (!sale) return Promise.reject(new Error("Venta no encontrada"));
      if ((sale.status || "Pagada") === "Cancelada") return Promise.reject(new Error("La venta ya está cancelada"));
      if (body?.status === "Cancelada") {
        if (isRealSale(sale)) {
          (sale.items || []).forEach((it) => {
            if (it.productId != null) {
              const p = memoryProducts.find((x) => String(x.id) === String(it.productId));
              if (p && p.stock != null) p.stock = (Number(p.stock) || 0) + (it.quantity || 0);
            }
          });
        }
        sale.status = "Cancelada";
        memoryActivity.unshift({ id: `A-${Date.now()}`, type: "sale", description: `Venta cancelada - ${sale.clientName || ""} · C$${sale.total ?? 0}`, time: new Date().toISOString().slice(0, 16).replace("T", " ") });
        return Promise.resolve(sale);
      }
      if (body?.addPayment != null) {
        const add = Number(body.addPayment) || 0;
        if (add <= 0) return Promise.reject(new Error("El monto a abonar debe ser mayor a 0"));
        const current = Number(sale.amountPaid) || 0;
        if ((sale.status || "Pagada") !== "pendiente") return Promise.reject(new Error("Solo se puede abonar en ventas con estado Pendiente"));
        sale.amountPaid = current + add;
        if (sale.amountPaid >= (sale.total || 0)) sale.status = "Pagada";
        memoryActivity.unshift({ id: `A-${Date.now()}`, type: "sale", description: `Abono registrado - ${sale.clientName || ""} · +C$${add}`, time: new Date().toISOString().slice(0, 16).replace("T", " ") });
        return Promise.resolve(sale);
      }
      return Promise.resolve(sale);
    }
    if (match) {
      const one = memorySalesHistory.find((s) => String(s.id) === match[1]);
      return Promise.resolve(one || memorySalesHistory[0]);
    }
    const page = new URLSearchParams(pathname.split("?")[1] || "").get("page") || 1;
    const pageSize = new URLSearchParams(pathname.split("?")[1] || "").get("pageSize") || 20;
    return Promise.resolve(paginate(memorySalesHistory, page, pageSize));
  }

  // Expenses (egresos)
  if (path.includes("/api/expenses")) {
    const match = path.match(/\/api\/expenses\/([^/]+)/);
    if (method === "DELETE" && match) {
      memoryEgresos = memoryEgresos.filter((e) => String(e.id) !== match[1]);
      return Promise.resolve(null);
    }
    if (method === "PUT" && match) {
      const idx = memoryEgresos.findIndex((e) => String(e.id) === match[1]);
      const updated = body ? { ...memoryEgresos[idx], ...body, id: match[1] } : memoryEgresos[idx];
      if (idx >= 0) memoryEgresos[idx] = updated;
      return Promise.resolve(updated);
    }
    if (method === "POST" && !match) {
      const newId = "E" + (memoryEgresos.length + 1);
      const created = { ...body, id: newId };
      memoryEgresos.unshift(created);
      return Promise.resolve(created);
    }
    if (match) {
      const one = memoryEgresos.find((e) => String(e.id) === match[1]);
      return Promise.resolve(one || memoryEgresos[0]);
    }
    const page = new URLSearchParams(pathname.split("?")[1] || "").get("page") || 1;
    const pageSize = new URLSearchParams(pathname.split("?")[1] || "").get("pageSize") || 20;
    const dateFrom = new URLSearchParams(pathname.split("?")[1] || "").get("dateFrom");
    const dateTo = new URLSearchParams(pathname.split("?")[1] || "").get("dateTo");
    const category = new URLSearchParams(pathname.split("?")[1] || "").get("category");
    let list = memoryEgresos;
    if (dateFrom) list = list.filter((e) => (e.date || "").slice(0, 10) >= dateFrom);
    if (dateTo) list = list.filter((e) => (e.date || "").slice(0, 10) <= dateTo);
    if (category) list = list.filter((e) => (e.category || "") === category);
    return Promise.resolve(paginate(list, page, pageSize));
  }

  // Activity
  if (path.includes("/api/activity")) {
    return Promise.resolve(activityWithIds());
  }

  // Users (usuarios del sistema)
  if (path.includes("/api/users")) {
    const match = path.match(/\/api\/users\/(\d+)/);
    if (method === "DELETE" && match) return Promise.resolve(null);
    if (method === "PUT" && match) {
      const out = body ? { ...body, id: match[1] } : mockUsers[0];
      if (out && out.nombreUsuario != null && out.usuario == null) out.usuario = out.nombreUsuario;
      return Promise.resolve(out);
    }
    if (method === "POST" && !match) {
      const out = { ...body, id: mockUsers.length + 1 };
      if (out.nombreUsuario != null && out.usuario == null) out.usuario = out.nombreUsuario;
      return Promise.resolve(out);
    }
    if (match) {
      const one = mockUsers.find((u) => String(u.id) === match[1]);
      if (one) return Promise.resolve(one);
      return Promise.resolve(mockUsers[0]);
    }
    return Promise.resolve(mockUsers);
  }

  // WhatsApp templates (plantillas de mensajes)
  if (path.includes("/api/whatsapp-templates")) {
    if (path.includes("/default")) {
      const def = mockWhatsappTemplates.find((t) => t.predeterminada) || mockWhatsappTemplates[0];
      return Promise.resolve(def ? { mensaje: def.mensaje } : { mensaje: "Hola {NombreCliente}, factura {NumeroFactura}. Monto: C${Monto}. {EnlacePDF}" });
    }
    const match = path.match(/\/api\/whatsapp-templates\/(\d+)/);
    if (method === "DELETE" && match) return Promise.resolve(null);
    if (method === "PUT" && match) return Promise.resolve(body ? { ...body, id: Number(match[1]) } : mockWhatsappTemplates[0]);
    if (method === "POST" && !match) return Promise.resolve({ ...body, id: mockWhatsappTemplates.length + 1 });
    if (match) {
      const one = mockWhatsappTemplates.find((t) => String(t.id) === match[1]);
      if (one) return Promise.resolve(one);
      return Promise.resolve(mockWhatsappTemplates[0]);
    }
    return Promise.resolve(mockWhatsappTemplates);
  }

  // Reports (óptica)
  if (path.includes("/api/reports/")) {
    if (path.includes("income-vs-expenses") || path.includes("ingresos-totales")) {
      const s = dashboardSummary();
      return Promise.resolve({
        totalIncome: s.totalRevenue,
        salesToday: s.salesToday,
        salesMonth: s.salesMonth,
      });
    }
    if (path.includes("ventas-dia")) {
      const dateFrom = new URLSearchParams(pathname.split("?")[1] || "").get("dateFrom");
      const dateTo = new URLSearchParams(pathname.split("?")[1] || "").get("dateTo");
      let list = memorySalesHistory;
      if (dateFrom) list = list.filter((s) => (s.date || "").slice(0, 10) >= dateFrom);
      if (dateTo) list = list.filter((s) => (s.date || "").slice(0, 10) <= dateTo);
      const page = new URLSearchParams(pathname.split("?")[1] || "").get("page") || 1;
      const pageSize = new URLSearchParams(pathname.split("?")[1] || "").get("pageSize") || 20;
      const p = paginate(list, page, pageSize);
      const totalAmount = list.reduce((a, s) => a + revenueFromSale(s), 0);
      return Promise.resolve({ ...p, totalAmount });
    }
    if (path.includes("ventas-mes")) {
      const list = memorySalesHistory;
      const page = new URLSearchParams(pathname.split("?")[1] || "").get("page") || 1;
      const pageSize = new URLSearchParams(pathname.split("?")[1] || "").get("pageSize") || 20;
      const p = paginate(list, page, pageSize);
      const totalAmount = list.reduce((a, s) => a + revenueFromSale(s), 0);
      return Promise.resolve({ ...p, totalAmount });
    }
    if (path.includes("productos-mas-vendidos")) {
      return Promise.resolve(topProductsSold());
    }
    if (path.includes("sales")) {
      const p = paginate(memorySalesHistory, 1, 20);
      const totalAmountInCordobas = memorySalesHistory.reduce((a, s) => a + revenueFromSale(s), 0);
      return Promise.resolve({ ...p, totalAmountInCordobas });
    }
  }

  return Promise.reject(new Error("Ruta estática no definida: " + pathname));
}

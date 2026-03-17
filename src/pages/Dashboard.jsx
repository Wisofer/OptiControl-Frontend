import { useState } from "react";
import {
  Card,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  VerticalBarChart,
  TableSkeleton,
} from "../components/ui";
import { useDashboard } from "../hooks/useDashboard";
import { useSettings } from "../hooks/useSettings";
import { formatCurrency, formatDateTime } from "../utils/format";
import { DollarSign, Users, Package, ShoppingBag, TrendingUp, Eye } from "lucide-react";
import Skeleton from "react-loading-skeleton";
import { SkeletonTheme } from "react-loading-skeleton";
import { cn } from "../utils/cn";

const ACTIVITY_LIMITS = [5, 10, 20];

const skeletonLight = { baseColor: "#e2e8f0", highlightColor: "#f1f5f9" };
const skeletonDark = { baseColor: "#334155", highlightColor: "#475569" };

function DashboardSkeleton() {
  const { settings } = useSettings();
  const sk = settings?.theme === "dark" ? skeletonDark : skeletonLight;
  return (
    <SkeletonTheme baseColor={sk.baseColor} highlightColor={sk.highlightColor}>
      <div className="space-y-6">
        <div className="pb-2 border-b border-primary-100 dark:border-slate-800">
          <Skeleton width={120} height={28} />
          <Skeleton width={260} height={20} className="mt-2" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-l-4 border-l-slate-200">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <Skeleton width={100} height={16} />
                  <Skeleton width={80} height={28} className="mt-2" />
                </div>
                <Skeleton circle width={40} height={40} />
              </div>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <Skeleton width={160} height={22} className="mb-4" />
              <div className="pt-2 pb-2">
                <Skeleton width="100%" height={200} />
              </div>
            </Card>
          </div>
          <div>
            <Card>
              <Skeleton width={180} height={22} className="mb-4" />
              <div className="flex flex-col gap-2 pt-2">
                <Skeleton height={24} count={5} />
              </div>
            </Card>
          </div>
        </div>
        <Card>
          <Skeleton width={160} height={22} className="mb-4" />
          <TableSkeleton columns={2} rows={6} />
        </Card>
      </div>
    </SkeletonTheme>
  );
}

export function Dashboard() {
  const { summary, activity, monthlyIncome, topProducts, alerts, loading, error } = useDashboard();
  const [activityLimit, setActivityLimit] = useState(5);

  if (loading) return <DashboardSkeleton />;
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 p-4 text-red-700 dark:text-red-200">
        <p className="font-medium">Error al cargar el panel</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  const salesToday = summary?.salesToday ?? 0;
  const salesMonth = summary?.salesMonth ?? 0;
  const productsCount = summary?.productsCount ?? 0;
  const clientsCount = summary?.clientsCount ?? 0;
  const monthlyChartData = (monthlyIncome || []).map((m) => ({ label: m.monthName || m.month || "", value: m.amount || 0 }));

  const cardBase =
    "rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow";

  const hasAlerts = alerts && (alerts.message || (Array.isArray(alerts.overdueInvoices) && alerts.overdueInvoices.length > 0) || alerts.upcomingTripsMessage);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
          Dashboard
        </h1>
        <p className="text-slate-600 dark:text-slate-400">Panel de administración para ópticas</p>
      </header>

      {hasAlerts && (
        <section className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">Alertas</h2>
          {alerts.message && <p className="text-sm text-amber-800 dark:text-amber-200">{alerts.message}</p>}
          {Array.isArray(alerts.overdueInvoices) && alerts.overdueInvoices.length > 0 && (
            <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">Facturas vencidas: {alerts.overdueInvoices.length}</p>
          )}
          {alerts.upcomingTripsMessage && <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">{alerts.upcomingTripsMessage}</p>}
        </section>
      )}

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
          Resumen
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className={`${cardBase} border-l-4 border-l-emerald-500`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Ventas de hoy</p>
                <p className="mt-1.5 text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">{formatCurrency(salesToday)}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </Card>
          <Card className={`${cardBase} border-l-4 border-l-primary-500`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Ventas del mes</p>
                <p className="mt-1.5 text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">{formatCurrency(salesMonth)}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
            </div>
          </Card>
          <Card className={cardBase}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Productos en inventario</p>
                <p className="mt-1.5 text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">{productsCount}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              </div>
            </div>
          </Card>
          <Card className={cardBase}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Clientes registrados</p>
                <p className="mt-1.5 text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">{clientsCount}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
          Análisis
        </h2>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className={`${cardBase} overflow-hidden`}>
              <div className="px-5 pt-5 pb-2">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Ventas mensuales</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Últimos meses</p>
              </div>
              <div className="px-5 pb-5 pt-2">
                {monthlyChartData.length > 0 ? (
                  <VerticalBarChart
                    data={monthlyChartData}
                    valueFormat={(v) => formatCurrency(v)}
                    barClassName="bg-primary-500 hover:bg-primary-600 dark:bg-primary-500 dark:hover:bg-primary-400"
                  />
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">Sin datos de ventas mensuales</p>
                )}
              </div>
            </Card>
          </div>
          <Card className={`${cardBase} overflow-hidden`}>
            <div className="px-5 pt-5 pb-2">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary-500" />
                Productos más vendidos
              </h3>
            </div>
            <div className="px-5 pb-5 pt-2">
              {(topProducts || []).length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">Sin ventas registradas aún</p>
              ) : (
                <ul className="space-y-2">
                  {(topProducts || []).slice(0, 6).map((p, i) => (
                    <li key={p.name || i} className="flex justify-between items-center text-sm py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate pr-2">{p.name}</span>
                      <span className="text-primary-600 dark:text-primary-400 font-semibold tabular-nums">{p.quantity} ud.</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </section>

      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Actividad reciente
          </h2>
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 mr-2">Mostrar:</span>
            {ACTIVITY_LIMITS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setActivityLimit(n)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  activityLimit === n
                    ? "bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <Card className={`${cardBase} overflow-hidden`}>
          <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Descripción</TableHeaderCell>
                  <TableHeaderCell>Fecha y hora</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(activity || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-slate-500 dark:text-slate-400 text-center py-10">
                      No hay actividad reciente
                    </TableCell>
                  </TableRow>
                ) : (
                  (activity || []).slice(0, activityLimit).map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium text-slate-800 dark:text-slate-200">{a.description}</TableCell>
                      <TableCell className="text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDateTime(a.time)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </section>
    </div>
  );
}

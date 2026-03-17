import { useState, useEffect, useCallback } from "react";
import {
  DollarSign,
  CalendarDays,
  TrendingUp,
  Package,
  FileSpreadsheet,
  ChevronRight,
  Calendar,
  Sparkles,
} from "lucide-react";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell, Modal, Pagination } from "../components/ui";
import Skeleton from "react-loading-skeleton";
import { SkeletonTheme } from "react-loading-skeleton";
import { useSettings } from "../hooks/useSettings";
import { useReports } from "../hooks/useReports";
import { formatCurrency, formatDate } from "../utils/format";
import { downloadExport } from "../api/export";
import { useSnackbar } from "../contexts/SnackbarContext";

function getDateRange(preset) {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const pad = (n) => String(n).padStart(2, "0");
  const to = `${y}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  if (preset === "mes") {
    const from = new Date(y, m, 1);
    return { dateFrom: `${from.getFullYear()}-${pad(from.getMonth() + 1)}-01`, dateTo: to };
  }
  if (preset === "trimestre") {
    const start = new Date(y, m - 2, 1);
    return { dateFrom: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`, dateTo: to };
  }
  if (preset === "año") {
    return { dateFrom: `${y}-01-01`, dateTo: to };
  }
  return { dateFrom: "", dateTo: "" };
}

const REPORTS = [
  { id: "ingresos-totales", icon: DollarSign, title: "Ingresos totales", description: "Resumen de ingresos del negocio", path: "ingresos-totales" },
  { id: "ventas-dia", icon: Calendar, title: "Ventas por día", description: "Ventas en el rango de fechas seleccionado", path: "ventas-dia" },
  { id: "ventas-mes", icon: CalendarDays, title: "Ventas por mes", description: "Todas las ventas registradas", path: "ventas-mes" },
  { id: "productos-mas-vendidos", icon: Package, title: "Productos más vendidos", description: "Ranking de productos por cantidad vendida", path: "productos-mas-vendidos" },
];

const NO_DATA = "No hay datos para el período seleccionado.";

function ReportDetailContent({ reportId, reportData, loading, error, page, totalPages, totalCount, pageSize, onPageChange }) {
  const { settings } = useSettings();
  const sk = settings?.theme === "dark" ? { baseColor: "#334155", highlightColor: "#475569" } : { baseColor: "#e2e8f0", highlightColor: "#f1f5f9" };

  if (loading)
    return (
      <SkeletonTheme baseColor={sk.baseColor} highlightColor={sk.highlightColor}>
        <div className="py-6 space-y-2">
          <Skeleton count={6} height={28} />
        </div>
      </SkeletonTheme>
    );
  if (error) return <p className="text-red-600 dark:text-red-400 py-4 text-sm">{error}</p>;
  if (!reportData) return null;

  if (reportId === "ingresos-totales") {
    const total = reportData.totalIncome ?? 0;
    const today = reportData.salesToday ?? 0;
    const month = reportData.salesMonth ?? 0;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 p-4">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">Ingresos totales</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">{formatCurrency(total)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">Ventas de hoy</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">{formatCurrency(today)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">Ventas del mes</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">{formatCurrency(month)}</p>
          </div>
        </div>
      </div>
    );
  }

  if (reportId === "productos-mas-vendidos") {
    const items = Array.isArray(reportData) ? reportData : [];
    if (items.length === 0) return <p className="text-slate-500 py-6 text-sm">{NO_DATA}</p>;
    return (
      <div className="space-y-2">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((p, i) => (
            <li key={p.name || i} className="flex justify-between items-center py-3">
              <span className="font-medium text-slate-800 dark:text-slate-100">{p.name}</span>
              <span className="font-semibold text-primary-600 dark:text-primary-400 tabular-nums">{p.quantity} unidades</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (reportId === "ventas-dia" || reportId === "ventas-mes") {
    const items = reportData.items || [];
    const totalAmount = reportData.totalAmount ?? items.reduce((a, s) => a + (s.total || 0), 0);
    if (items.length === 0) return <p className="text-slate-500 py-6 text-sm">{NO_DATA}</p>;
    return (
      <div className="space-y-3">
        <div className="overflow-x-auto -mx-1">
          <Table className="text-sm min-w-[500px]">
            <TableHead>
              <TableRow>
                <TableHeaderCell className="py-2">Fecha</TableHeaderCell>
                <TableHeaderCell className="py-2">Cliente</TableHeaderCell>
                <TableHeaderCell className="py-2 text-right">Total</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="py-2">{formatDate((s.date || "").slice(0, 10))}</TableCell>
                  <TableCell className="py-2 font-medium">{s.clientName}</TableCell>
                  <TableCell className="py-2 text-right tabular-nums font-medium">{formatCurrency(s.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 pt-2 border-t border-slate-100 dark:border-slate-800">
          Total: {formatCurrency(totalAmount)}
        </p>
        {totalPages > 1 && (
          <div className="mt-3">
            <Pagination page={page} totalPages={totalPages} totalCount={totalCount} pageSize={pageSize} onPageChange={onPageChange} />
          </div>
        )}
      </div>
    );
  }

  return null;
}

export function Reports() {
  const snackbar = useSnackbar();
  const { fetchReport, loading, error } = useReports();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [reportPage, setReportPage] = useState(1);
  const [chooseReportOpen, setChooseReportOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState({ excel: false, pdf: false });

  const applyPreset = useCallback((preset) => {
    const { dateFrom: from, dateTo: to } = getDateRange(preset);
    setDateFrom(from);
    setDateTo(to);
  }, []);

  useEffect(() => {
    applyPreset("año");
  }, [applyPreset]);

  useEffect(() => {
    if (!selectedReport) {
      setReportData(null);
      return;
    }
    setReportPage(1);
  }, [selectedReport, dateFrom, dateTo]);

  useEffect(() => {
    if (!selectedReport) {
      setReportData(null);
      return;
    }
    setReportData(null);
    let cancelled = false;
    fetchReport(selectedReport, dateFrom || undefined, dateTo || undefined, reportPage).then((data) => {
      if (!cancelled) setReportData(data);
    });
    return () => { cancelled = true; };
  }, [selectedReport, dateFrom, dateTo, reportPage, fetchReport]);

  const openReport = (reportId) => {
    setSelectedReport(reportId);
    setChooseReportOpen(false);
  };

  const reportParams = () => {
    const o = {};
    if (dateFrom) o.dateFrom = dateFrom;
    if (dateTo) o.dateTo = dateTo;
    return o;
  };

  const handleExport = async (report, format) => {
    const key = format;
    setExportLoading((s) => ({ ...s, [key]: true }));
    try {
      const path = `/api/reports/${report.path}`;
      const filename = format === "excel" ? `Reporte-${report.title}.xlsx` : `Reporte-${report.title}.pdf`;
      await downloadExport(path, format, reportParams(), filename);
      snackbar.success("Descarga iniciada");
    } catch (err) {
      snackbar.error(err?.message || "Error al exportar");
    }
    setExportLoading((s) => ({ ...s, [key]: false }));
  };

  const currentReport = selectedReport ? REPORTS.find((r) => r.id === selectedReport) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-900">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Reportes</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400 text-sm sm:text-base">
            Ventas por día, por mes, productos más vendidos e ingresos totales.
          </p>
        </header>

        <section className="mb-8 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <Calendar className="h-5 w-5 text-slate-500 shrink-0" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 shrink-0">Período:</span>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "mes", label: "Último mes" },
                { key: "trimestre", label: "Último trimestre" },
                { key: "año", label: "Este año" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyPreset(key)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-800 dark:hover:text-primary-200"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
              <span className="text-slate-400 text-sm">–</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {REPORTS.map((report) => {
            const Icon = report.icon;
            return (
              <button
                key={report.id}
                type="button"
                onClick={() => openReport(report.id)}
                className="group flex items-start gap-4 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-left shadow-sm hover:shadow-md hover:border-primary-200 dark:hover:border-primary-800 transition-all duration-200"
              >
                <div className="shrink-0 w-11 h-11 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center group-hover:bg-primary-100 dark:group-hover:bg-primary-900/50 transition-colors">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 leading-tight">{report.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{report.description}</p>
                  <span className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-primary-600 dark:text-primary-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    Ver reporte <ChevronRight className="h-4 w-4" />
                  </span>
                </div>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setChooseReportOpen(true)}
            className="flex items-center justify-center gap-3 p-4 sm:p-5 rounded-2xl border-2 border-dashed border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:border-primary-300 dark:hover:border-primary-700 transition-all duration-200"
          >
            <Sparkles className="h-6 w-6 shrink-0" />
            <span className="font-semibold text-left">Generar reporte</span>
          </button>
        </div>
      </div>

      <Modal open={chooseReportOpen} onClose={() => setChooseReportOpen(false)} title="¿Qué reporte necesitas?" size="md">
        <div className="space-y-2">
          {REPORTS.map((report) => {
            const Icon = report.icon;
            return (
              <button
                key={report.id}
                type="button"
                onClick={() => openReport(report.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-primary-200 dark:hover:border-primary-800 text-left transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800 dark:text-slate-100">{report.title}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{report.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
              </button>
            );
          })}
        </div>
      </Modal>

      <Modal open={!!selectedReport} onClose={() => setSelectedReport(null)} title={currentReport?.title ?? "Reporte"} size="xl">
        {currentReport && (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
              <span className="text-sm text-slate-600 dark:text-slate-400">Rango:</span>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100" />
              <span className="text-slate-400">–</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100" />
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExport(currentReport, "excel")}
                  disabled={exportLoading.excel}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 disabled:opacity-50"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Descargar Excel
                </button>
                <button
                  type="button"
                  onClick={() => handleExport(currentReport, "pdf")}
                  disabled={exportLoading.pdf}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm font-medium text-red-800 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50"
                >
                  Descargar PDF
                </button>
              </div>
            </div>
            <ReportDetailContent
              reportId={selectedReport}
              reportData={reportData}
              loading={loading}
              error={error}
              page={reportPage}
              totalPages={reportData?.totalPages ?? 0}
              totalCount={reportData?.totalCount ?? 0}
              pageSize={reportData?.pageSize ?? 20}
              onPageChange={setReportPage}
            />
          </>
        )}
      </Modal>
    </div>
  );
}

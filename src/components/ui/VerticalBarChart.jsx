import { useMemo } from "react";
import { formatCurrency } from "../../utils/format";

/**
 * Vertical bar chart. data = [{ label, value }]. value is numeric.
 */
export function VerticalBarChart({ data, maxValue, valueFormat = (v) => String(v), barClassName = "bg-primary-500" }) {
  const max = useMemo(() => maxValue ?? Math.max(...data.map((d) => d.value), 1), [data, maxValue]);

  return (
    <div className="flex items-end justify-between gap-1 h-40">
      {data.map(({ label, value }, i) => (
        <div key={`${label}-${i}`} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div className="w-full flex flex-col justify-end h-32">
            <div
              className={barClassName + " w-full rounded-t transition-all duration-500 min-h-[4px]"}
              style={{ height: `${Math.max(4, (value / max) * 100)}%` }}
              title={valueFormat(value)}
            />
          </div>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate w-full text-center">{label}</span>
        </div>
      ))}
    </div>
  );
}

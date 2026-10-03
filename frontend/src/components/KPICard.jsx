import { memo } from "react";

const ACCENTS = {
  cyan: "bg-cyan-400/10 text-cyan-400",
  blue: "bg-blue-400/10 text-blue-400",
  indigo: "bg-indigo-400/10 text-indigo-300",
  amber: "bg-amber-400/10 text-amber-400",
  emerald: "bg-emerald-400/10 text-emerald-400",
  red: "bg-red-400/10 text-red-400",
};

// value must already be a display string ("—" when unavailable)
function KPICard({ title, value, unit, subtitle, icon: Icon, accent = "cyan", valueColor }) {
  const unavailable = value === "—";
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 transition hover:-translate-y-0.5 hover:border-slate-700">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{title}</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-1">
            <span className="truncate text-2xl font-bold tracking-tight" style={valueColor && !unavailable ? { color: valueColor } : undefined}>{value}</span>
            {unit && !unavailable && <span className="text-sm text-slate-500">{unit}</span>}
          </div>
          {subtitle && <p className="mt-1.5 text-[11px] text-slate-500">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${ACCENTS[accent]}`} aria-hidden="true"><Icon /></div>
        )}
      </div>
    </div>
  );
}
export default memo(KPICard);

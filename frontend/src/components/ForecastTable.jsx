import { memo, useMemo, useState } from "react";
import { FaArrowUp, FaArrowDown, FaMinus } from "react-icons/fa";
import { EmptyState, LoadingState } from "./common/States";
import { fmt, fmtSigned, fmtPct, regimeColor, imdCategory } from "../api/normalize";

const COLS = [
  ["district_name", "District"], ["raw_rainfall", "Raw NWP"], ["corrected_rainfall", "AI corrected"],
  ["bias_correction", "Bias"], ["regime", "Regime"], ["heavy_rain_probability", "Heavy-rain prob."],
];

function ForecastTable({ data = [], loading = false, selectedId, onSelect, pageSize = 10 }) {
  const [sort, setSort] = useState({ key: "corrected_rainfall", dir: "desc" });
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const out = [...data];
    out.sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      if (x === null && y === null) return 0;
      if (x === null) return 1;            // unavailable always last
      if (y === null) return -1;
      const c = typeof x === "string" ? x.localeCompare(y) : x - y;
      return sort.dir === "asc" ? c : -c;
    });
    return out;
  }, [data, sort]);

  if (loading) return <LoadingState message="Loading district forecasts…" />;
  if (!data.length) return <EmptyState title="No district forecast available" message="District records have not been loaded." />;

  const pages = Math.ceil(rows.length / pageSize);
  const current = Math.min(page, pages - 1);
  const slice = rows.slice(current * pageSize, current * pageSize + pageSize);

  const toggle = (key) => { setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" })); setPage(0); };

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900">
            <tr>
              {COLS.map(([key, label]) => (
                <th key={key} scope="col" aria-sort={sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className="px-4 py-3">
                  <button onClick={() => toggle(key)} className="text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">
                    {label}{sort.key === key ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {slice.map((d) => {
              const Icon = d.bias_correction > 0 ? FaArrowUp : d.bias_correction < 0 ? FaArrowDown : FaMinus;
              const active = d.id === selectedId;
              return (
                <tr key={d.id} onClick={() => onSelect?.(d.id)} className={`cursor-pointer transition hover:bg-slate-900 ${active ? "bg-cyan-500/5" : "bg-slate-950"}`}>
                  <td className="px-4 py-3">
                    <button onClick={(e) => { e.stopPropagation(); onSelect?.(d.id); }} className="text-left font-medium text-slate-100 hover:text-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">{d.district_name}</button>
                    {d.state_name && <p className="text-xs text-slate-600">{d.state_name}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{fmt(d.raw_rainfall, 2, "mm")}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-cyan-400">{fmt(d.corrected_rainfall, 2, "mm")}</span>
                    {(() => { const c = imdCategory(d.corrected_rainfall); return c && c.key !== "light" ? <p className="text-[10px]" style={{ color: c.color }}>{c.label}</p> : null; })()}
                  </td>
                  <td className="px-4 py-3">
                    {d.bias_correction === null ? "—" : (
                      <span className={`inline-flex items-center gap-1 ${d.bias_correction > 0 ? "text-emerald-400" : d.bias_correction < 0 ? "text-red-400" : "text-slate-500"}`}>
                        <Icon aria-hidden="true" /> {fmtSigned(d.bias_correction, 2, "mm")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {d.regime ? <span className="inline-flex items-center gap-2 text-xs"><span className="h-2 w-2 rounded-full" style={{ background: regimeColor(d.regime) }} aria-hidden="true" />{d.regime}</span> : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {d.heavy_rain_probability === null ? "—" : (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-800" aria-hidden="true"><div className="h-full rounded-full bg-amber-400" style={{ width: `${d.heavy_rain_probability * 100}%` }} /></div>
                        <span className="text-xs">{fmtPct(d.heavy_rain_probability)}</span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>Page {current + 1} of {pages} · {rows.length} districts</span>
          <div className="flex gap-2">
            <button disabled={current === 0} onClick={() => setPage(current - 1)} className="rounded-lg border border-slate-700 px-3 py-1.5 disabled:opacity-40 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">Previous</button>
            <button disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="rounded-lg border border-slate-700 px-3 py-1.5 disabled:opacity-40 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
export default memo(ForecastTable);

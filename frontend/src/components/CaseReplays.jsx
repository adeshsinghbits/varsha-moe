import { memo, useCallback, useEffect, useState } from "react";
import { getCaseReplays, apiErrorMessage } from "../api/api";
import { LoadingState, ErrorState, EmptyState } from "./common/States";
import { fmt, imdCategory } from "../api/normalize";

// Extreme held-out events: what was observed vs what the pipeline forecast.
function CaseReplays() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setCases(await getCaseReplays()); } catch (e) { setCases([]); setError(apiErrorMessage(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState message="Loading case replays…" />;
  if (error) return <ErrorState title="Case replays unavailable" message={error} onRetry={load} />;
  if (!cases.length) return <EmptyState title="No case replays" message="Add data/raw/case_replays.json to the backend." />;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {cases.map((c) => (
        <article key={c.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <h3 className="font-semibold">{c.name}</h3>
          {c.description && <p className="mt-1 text-xs text-slate-500">{c.description}</p>}
          {c.rows.length ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-xs">
                <thead className="text-slate-500"><tr>{["Date", "District", "Raw", "AI", "Observed"].map((h) => <th key={h} scope="col" className="py-1 pr-3 font-medium">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-800">
                  {c.rows.map((r) => {
                    const cat = imdCategory(r.observed_rainfall);
                    return (
                      <tr key={r.id}>
                        <td className="py-1.5 pr-3 text-slate-400">{r.date ?? "—"}</td>
                        <td className="py-1.5 pr-3">{r.district_name}</td>
                        <td className="py-1.5 pr-3 text-slate-400">{fmt(r.raw_rainfall, 1)}</td>
                        <td className="py-1.5 pr-3 text-cyan-300">{fmt(r.corrected_rainfall, 1)}</td>
                        <td className="py-1.5 pr-3 text-emerald-300">{fmt(r.observed_rainfall, 1)}{cat && cat.key !== "light" && cat.key !== "moderate" ? <span className="ml-1 text-[10px]" style={{ color: cat.color }}>({cat.label})</span> : null}</td>
                      </tr>);
                  })}
                </tbody>
              </table>
              <p className="mt-2 text-[10px] text-slate-600">mm/day, district mean. Observed = IMD gridded rainfall.</p>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">No stored forecasts for these district-days yet (seed the database after retraining on the real archive).</p>
          )}
        </article>
      ))}
    </div>
  );
}
export default memo(CaseReplays);

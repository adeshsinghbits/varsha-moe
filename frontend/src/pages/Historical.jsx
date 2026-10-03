import { useCallback, useEffect, useMemo, useState } from "react";
import { FiX } from "react-icons/fi";
import RainfallChart from "../components/RainfallChart";
import DistrictDetails from "../components/DistrictDetails";
import { Panel, ErrorState, LoadingState, EmptyState } from "../components/common/States";
import { getDistrictHistory, getDistricts, getHistory, apiErrorMessage } from "../api/api";
import { REGIME_NAMES, regimeColor, fmt, fmtPct, fmtBool } from "../api/normalize";

const PAGE = 25;
const EMPTY = { start: "", end: "", district: "", regime: "", heavy: "", minRain: "", maxRain: "" };
const cls = "rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400";

function Archive() {
  const [draft, setDraft] = useState(EMPTY);
  const [filters, setFilters] = useState(EMPTY);
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ records: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [names, setNames] = useState([]);
  const [detail, setDetail] = useState(null);

  useEffect(() => { getDistricts({ limit: 200 }).then((r) => setNames(r.districts.map((d) => d.district_name).sort())).catch(() => setNames([])); }, []);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      setData(await getDistrictHistory({
        start: filters.start, end: filters.end, district: filters.district, regime: filters.regime,
        heavy_rain: filters.heavy === "" ? "" : filters.heavy === "yes",
        min_rain: filters.minRain, max_rain: filters.maxRain, skip: page * PAGE, limit: PAGE,
      }));
    } catch (e) { setData({ records: [], total: 0 }); setError(apiErrorMessage(e)); } finally { setLoading(false); }
  }, [filters, page]);
  useEffect(() => { load(); }, [load]);

  const apply = (e) => { e.preventDefault(); setPage(0); setFilters(draft); };
  const reset = () => { setDraft(EMPTY); setFilters(EMPTY); setPage(0); };
  const set = (k) => (e) => setDraft((p) => ({ ...p, [k]: e.target.value }));

  const asc = useMemo(() => [...data.records].sort((a, b) => String(a.date).localeCompare(String(b.date))), [data.records]);
  const chart = useMemo(() => asc.map((r) => ({ label: filters.district ? r.date : `${r.district_name} ${r.date}`, raw: r.raw_rainfall, ai: r.corrected_rainfall, observed: r.observed_rainfall })), [asc, filters.district]);
  const pages = Math.max(1, Math.ceil(data.total / PAGE));

  return (
    <div className="space-y-5">
      <Panel title="Filters" subtitle="Applied on the server against the district archive">
        <form onSubmit={apply} className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-400">From<input type="date" value={draft.start} onChange={set("start")} className={`${cls} mt-1 block`} /></label>
          <label className="text-xs text-slate-400">To<input type="date" value={draft.end} onChange={set("end")} className={`${cls} mt-1 block`} /></label>
          <label className="text-xs text-slate-400">District
            <select value={draft.district} onChange={set("district")} className={`${cls} mt-1 block`}><option value="">All</option>{names.map((n) => <option key={n}>{n}</option>)}</select></label>
          <label className="text-xs text-slate-400">Regime
            <select value={draft.regime} onChange={set("regime")} className={`${cls} mt-1 block`}><option value="">All</option>{REGIME_NAMES.map((n) => <option key={n}>{n}</option>)}</select></label>
          <label className="text-xs text-slate-400">Heavy rain
            <select value={draft.heavy} onChange={set("heavy")} className={`${cls} mt-1 block`}><option value="">Any</option><option value="yes">Yes</option><option value="no">No</option></select></label>
          <label className="text-xs text-slate-400">Min mm<input type="number" min="0" value={draft.minRain} onChange={set("minRain")} className={`${cls} mt-1 block w-24`} /></label>
          <label className="text-xs text-slate-400">Max mm<input type="number" min="0" value={draft.maxRain} onChange={set("maxRain")} className={`${cls} mt-1 block w-24`} /></label>
          <button type="submit" className="rounded-lg bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Apply</button>
          <button type="button" onClick={reset} className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">Reset</button>
        </form>
      </Panel>

      {error ? <ErrorState title="Historical records unavailable" message={error} onRetry={load} />
        : loading ? <LoadingState message="Loading historical forecasts…" />
        : !data.records.length ? <EmptyState title="No records match these filters" message="Widen the date range or clear filters. If the archive is empty, run scripts/seed_database.py." /> : (
        <>
          <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
            <Panel title="Raw vs corrected rainfall" subtitle={`Current page (${data.records.length} records)${filters.district ? "" : " — select a district for a clean time series"}`}>
              <RainfallChart data={chart} />
            </Panel>
            <Panel title="Regime timeline" subtitle="Detected regime per record on this page, oldest → newest">
              <div className="flex h-10 overflow-hidden rounded-lg" role="img" aria-label="Regime timeline">
                {asc.map((r) => <div key={r.id} title={`${r.date} · ${r.district_name} · ${r.regime ?? "—"}`} className="h-full flex-1" style={{ background: r.regime ? regimeColor(r.regime) : "#334155" }} />)}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
                {REGIME_NAMES.filter((n) => asc.some((r) => r.regime === n)).map((n) => <span key={n} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: regimeColor(n) }} aria-hidden="true" />{n}</span>)}
              </div>
            </Panel>
          </div>

          <Panel title="Historical forecast table" subtitle={`${data.total.toLocaleString()} matching records`}>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-slate-900 text-xs uppercase tracking-wider text-slate-500"><tr>
                  {["Date", "District", "Regime", "Raw", "Corrected", "Observed", "Heavy", "Prob."].map((h) => <th key={h} scope="col" className="px-4 py-3">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-800">
                  {data.records.map((r) => (
                    <tr key={r.id} className="bg-slate-950 hover:bg-slate-900">
                      <td className="px-4 py-3 text-slate-400">{r.date ?? "—"}</td>
                      <td className="px-4 py-3"><button onClick={() => setDetail(r)} className="text-left font-medium hover:text-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">{r.district_name}</button></td>
                      <td className="px-4 py-3 text-xs">{r.regime ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-400">{fmt(r.raw_rainfall, 1, "mm")}</td>
                      <td className="px-4 py-3 text-cyan-300">{fmt(r.corrected_rainfall, 1, "mm")}</td>
                      <td className="px-4 py-3 text-emerald-300">{fmt(r.observed_rainfall, 1, "mm")}</td>
                      <td className="px-4 py-3">{fmtBool(r.heavy_rain)}</td><td className="px-4 py-3">{fmtPct(r.heavy_rain_probability)}</td>
                    </tr>))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>Page {page + 1} of {pages}</span>
              <div className="flex gap-2">
                <button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-lg border border-slate-700 px-3 py-1.5 disabled:opacity-40 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">Previous</button>
                <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="rounded-lg border border-slate-700 px-3 py-1.5 disabled:opacity-40 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">Next</button>
              </div>
            </div>
          </Panel>
        </>)}

      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Forecast detail">
          <button className="absolute inset-0 bg-black/60" aria-label="Close detail" onClick={() => setDetail(null)} />
          <div className="relative h-full w-full max-w-sm overflow-y-auto border-l border-slate-800 bg-slate-950 p-4">
            <button onClick={() => setDetail(null)} aria-label="Close" className="mb-3 rounded-lg p-2 text-slate-400 hover:bg-slate-800"><FiX /></button>
            <DistrictDetails district={detail} />
          </div>
        </div>)}
    </div>
  );
}

function SavedRuns() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { getHistory(100).then(setRows).catch((e) => setError(apiErrorMessage(e))).finally(() => setLoading(false)); }, []);
  if (loading) return <LoadingState message="Loading saved runs…" />;
  if (error) return <ErrorState title="Saved runs unavailable" message={error} />;
  if (!rows.length) return <EmptyState title="No saved runs yet" message="Forecasts submitted through /api/predict are stored here." />;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-slate-900 text-xs uppercase tracking-wider text-slate-500"><tr>{["Created", "Location", "Regime", "Raw", "Corrected", "Heavy", "Prob."].map((h) => <th key={h} scope="col" className="px-4 py-3">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((r) => (<tr key={r.id} className="bg-slate-950">
            <td className="px-4 py-3 text-slate-400">{r.created_at ? new Date(r.created_at).toLocaleString() : "—"}</td>
            <td className="px-4 py-3 text-xs">{r.latitude !== null ? `${fmt(r.latitude, 2)}°, ${fmt(r.longitude, 2)}°` : "—"}</td>
            <td className="px-4 py-3">{r.regime ?? "—"}</td><td className="px-4 py-3">{fmt(r.raw_rainfall, 2, "mm")}</td>
            <td className="px-4 py-3 text-cyan-300">{fmt(r.corrected_rainfall, 2, "mm")}</td><td className="px-4 py-3">{fmtBool(r.heavy_rain)}</td><td className="px-4 py-3">{fmtPct(r.heavy_rain_probability)}</td></tr>))}
        </tbody>
      </table>
    </div>
  );
}

export default function Historical() {
  const [tab, setTab] = useState("archive");
  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Historical exploration</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Historical forecasts</h1>
        <p className="mt-1 text-sm text-slate-500">Model output for held-out test-split district-days, plus forecasts you ran yourself.</p>
      </div>
      <div role="tablist" aria-label="Historical views" className="flex gap-2">
        {[["archive", "District archive"], ["runs", "Saved runs"]].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`rounded-lg px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 ${tab === k ? "bg-cyan-500/15 text-cyan-300" : "text-slate-400 hover:bg-slate-900"}`}>{l}</button>))}
      </div>
      {tab === "archive" ? <Archive /> : <SavedRuns />}
    </div>
  );
}

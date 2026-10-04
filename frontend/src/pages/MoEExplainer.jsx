import { useCallback, useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { Panel, LoadingState, ErrorState, EmptyState, StatusBadge } from "../components/common/States";
import { getAvailableDates, getDistrictProducts, getDistrictExplain, apiErrorMessage } from "../api/api";
import { fmt, fmtPct, fmtSigned, regimeColor } from "../api/normalize";

const tip = { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, color: "#fff", fontSize: 12 };

export default function MoEExplainer() {
  const [dates, setDates] = useState(null);
  const [date, setDate] = useState("");
  const [districts, setDistricts] = useState([]);
  const [districtId, setDistrictId] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getAvailableDates().then((r) => { setDates(r); setDate(r.latest ?? ""); }).catch((e) => { setError(apiErrorMessage(e)); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!date) return;
    getDistrictProducts({ date }).then((r) => {
      const list = [...(r.districts ?? [])].sort((a, b) => a.district_name.localeCompare(b.district_name));
      setDistricts(list);
      setDistrictId((cur) => (list.some((d) => d.district_id === cur) ? cur : list[0]?.district_id ?? ""));
    }).catch((e) => { setDistricts([]); setError(apiErrorMessage(e)); setLoading(false); });
  }, [date]);

  const load = useCallback(async () => {
    if (!date || !districtId) return;
    setLoading(true); setError("");
    try { setResult(await getDistrictExplain({ districtId, date })); }
    catch (e) { setResult(null); setError(apiErrorMessage(e)); }
    finally { setLoading(false); }
  }, [date, districtId]);
  useEffect(() => { load(); }, [load]);

  const gate = useMemo(() => Object.entries(result?.moe?.regime_probabilities ?? {}).map(([regime, value]) => ({ regime, value })).sort((a, b) => b.value - a.value), [result]);
  const shap = useMemo(() => (result?.shap?.features ?? []).map((f) => ({ name: f.feature, value: f.contribution_log, input: f.value })), [result]);
  const experts = useMemo(() => Object.entries(result?.moe?.experts ?? {}).map(([regime, e]) => ({ regime, ...e })).sort((a, b) => b.gate_weight - a.gate_weight), [result]);
  const moe = result?.moe;
  const inSample = result && result.split !== "test";

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Explainability</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">MoE gate explainer</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          A global model makes the base forecast. A gate estimates which monsoon regime is active, and each regime expert adds a small, shrunk correction weighted by that probability.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-400">Date
          <input type="date" value={date} min={dates?.dates?.[0]?.date} max={dates?.latest} onChange={(e) => setDate(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400" /></label>
        <label className="text-xs text-slate-400">District
          <select value={districtId} onChange={(e) => setDistrictId(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">
            {districts.map((d) => <option key={d.district_id} value={d.district_id}>{d.district_name}</option>)}
          </select></label>
        {result && <StatusBadge tone={inSample ? "amber" : "emerald"}>{inSample ? `${result.split} date (in-sample)` : "Held-out test date"}</StatusBadge>}
      </div>

      {error ? <ErrorState title="Explanation unavailable" message={error} onRetry={load} />
        : loading ? <LoadingState message="Explaining forecast…" />
        : !moe ? <EmptyState title="No explanation" message="Pick a date and district." /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[["Raw NWP", fmt(moe.raw_nwp_rainfall, 1, "mm"), ""], ["Global model", fmt(moe.global_rainfall_mm, 1, "mm"), ""],
              ["MoE corrected", fmt(moe.corrected_rainfall_mm, 1, "mm"), "text-cyan-300"], ["Expert adjustment", fmtSigned(moe.corrected_rainfall_mm - moe.global_rainfall_mm, 2, "mm"), ""],
              ["Observed (IMD)", fmt(result.observed_rainfall_mm, 1, "mm"), "text-emerald-300"]].map(([l, v, c]) => (
              <div key={l} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><p className="text-[11px] uppercase tracking-wider text-slate-500">{l}</p><p className={`mt-1 text-xl font-bold ${c}`}>{v}</p></div>))}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Gate: regime probabilities" subtitle={`Most likely regime: ${moe.dominant_regime} (${fmtPct(moe.regime_probability, 0)})`}>
              <div style={{ height: 300 }} role="img" aria-label="Gate regime probabilities">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gate} layout="vertical" margin={{ left: 10, right: 16 }}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 1]} stroke="#64748b" fontSize={11} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                    <YAxis type="category" dataKey="regime" width={140} stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <Tooltip contentStyle={tip} formatter={(v) => fmtPct(v, 1)} cursor={{ fill: "#1e293b55" }} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} isAnimationActive={false}>{gate.map((d) => <Cell key={d.regime} fill={regimeColor(d.regime)} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Expert contributions" subtitle="Effect of each expert on the final forecast, after gate weight and shrinkage">
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full min-w-[460px] text-left text-sm">
                  <thead className="bg-slate-900 text-xs uppercase tracking-wider text-slate-500"><tr>{["Expert", "Gate", "Shrink", "Effect"].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-800">
                    {experts.map((e) => (
                      <tr key={e.regime} className="bg-slate-950">
                        <td className="px-3 py-2"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: regimeColor(e.regime) }} aria-hidden="true" />{e.regime}</span></td>
                        <td className="px-3 py-2">{fmtPct(e.gate_weight, 0)}</td><td className="px-3 py-2 text-slate-400">{fmt(e.shrinkage, 2)}</td>
                        <td className={`px-3 py-2 font-medium ${e.effect_mm > 0 ? "text-emerald-300" : e.effect_mm < 0 ? "text-red-300" : ""}`}>{fmtSigned(e.effect_mm, 2, "mm")}</td>
                      </tr>))}
                  </tbody>
                </table>
              </div>
              {moe.regimes_without_expert?.length > 0 && (
                <p className="mt-3 text-xs text-amber-300">No expert (too little training data, global model only): {moe.regimes_without_expert.join(", ")}.</p>)}
            </Panel>
          </div>

          <Panel title="Why this forecast? Feature attributions (SHAP)" subtitle="TreeSHAP of the global model, in log1p(rain) space. Positive pushes the forecast up.">
            {shap.length === 0 ? <EmptyState title="Not available" message="TreeSHAP needs the XGBoost model; it was not returned by the backend." className="min-h-[120px]" /> : (
              <>
                <div style={{ height: Math.max(220, shap.length * 34) }} role="img" aria-label="Feature attributions">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={shap} layout="vertical" margin={{ left: 10, right: 16 }}>
                      <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" stroke="#64748b" fontSize={11} />
                      <YAxis type="category" dataKey="name" width={130} stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <Tooltip contentStyle={tip} cursor={{ fill: "#1e293b55" }} formatter={(v, _n, p) => [`${Number(v).toFixed(3)} (input ${fmt(p.payload.input, 2)})`, "Contribution"]} />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]} isAnimationActive={false}>{shap.map((d) => <Cell key={d.name} fill={d.value >= 0 ? "#22d3ee" : "#f87171"} />)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-[11px] text-slate-600">Base value ≈ {fmt(result.shap.base_value_mm, 2, "mm")} (average training forecast). Attributions explain the global model only; expert corrections are shown above.</p>
              </>)}
          </Panel>
        </>)}
    </div>
  );
}

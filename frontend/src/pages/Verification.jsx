import { useCallback, useEffect, useMemo, useState } from "react";
import VerificationChart from "../components/VerificationChart";
import RegimeChart from "../components/RegimeChart";
import { Panel, ErrorState, LoadingState, EmptyState, StatusBadge } from "../components/common/States";
import { getVerification, apiErrorMessage } from "../api/api";
import { fmt } from "../api/normalize";

const METRICS = [
  ["rmse", "RMSE", "mm", true], ["mae", "MAE", "mm", true], ["csi", "CSI", "", false],
  ["pod", "POD", "", false], ["far", "FAR", "", true], ["ets", "ETS", "", false], ["fss", "FSS", "", false],
];

function MetricCard({ label, unit, lowerBetter, raw, ai }) {
  const both = raw !== null && ai !== null && raw !== 0;
  const change = both ? (lowerBetter ? (raw - ai) / Math.abs(raw) : (ai - raw) / Math.abs(raw)) * 100 : null;
  const unavailable = raw === null && ai === null;
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <p className="text-sm font-medium text-slate-300">{label}</p>
      {unavailable ? <p className="mt-4 text-lg font-semibold text-slate-500">Not available</p> : (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div><p className="text-[10px] uppercase text-slate-500">Raw NWP</p><p className="text-xl font-bold text-slate-300">{fmt(raw, 3)}</p></div>
          <div><p className="text-[10px] uppercase text-slate-500">AI corrected</p><p className="text-xl font-bold text-cyan-400">{fmt(ai, 3)}</p></div>
        </div>)}
      {unit && !unavailable && <p className="mt-1 text-[10px] text-slate-600">{unit}</p>}
      {change !== null && (
        <p className={`mt-3 border-t border-slate-800 pt-2 text-xs ${change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {Math.abs(change).toFixed(1)}% {change >= 0 ? "better" : "worse"} than raw NWP
        </p>)}
    </div>
  );
}

export default function Verification() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await getVerification()); } catch (e) { setData(null); setError(apiErrorMessage(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const splitLabel = data?.split === "test" ? "Held-out test set" : data?.split === "validation" ? "Validation set (not final test performance)" : "Split not recorded";
  const splitTone = data?.split === "test" ? "emerald" : "amber";

  const errorBars = useMemo(() => data ? [
    { name: "RMSE", raw: data.metrics.rmse.raw, ai: data.metrics.rmse.ai },
    { name: "MAE", raw: data.metrics.mae.raw, ai: data.metrics.mae.ai }] : [], [data]);
  const skillBars = useMemo(() => data ? ["csi", "pod", "far", "ets"].map((k) => ({ name: k.toUpperCase(), raw: data.metrics[k].raw, ai: data.metrics[k].ai })) : [], [data]);
  const regimeRmse = useMemo(() => data?.byRegime.filter((r) => r.corrected_rmse !== null && r.raw_rmse !== null).map((r) => ({ regime: r.regime, value: r.raw_rmse - r.corrected_rmse })) ?? [], [data]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Model verification</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Raw NWP vs AI corrected</h1>
          <p className="mt-1 text-sm text-slate-500">Metrics are read from the backend verification record; nothing is computed or filled in by the frontend.</p>
        </div>
        {data && <div className="flex flex-wrap gap-2"><StatusBadge tone={splitTone}>{splitLabel}{data.splitYears ? ` · ${data.splitYears.join(", ")}` : ""}</StatusBadge>{data.nSamples !== null && <StatusBadge>{data.nSamples.toLocaleString()} samples</StatusBadge>}</div>}
      </div>

      {loading ? <LoadingState message="Loading verification metrics…" /> : error ? <ErrorState title="Verification unavailable" message={error} onRetry={load} />
        : !data ? <EmptyState title="No verification record" message="Run scripts/seed_database.py after training to store held-out test metrics." /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {METRICS.map(([key, label, unit, lowerBetter]) => <MetricCard key={key} label={label} unit={unit} lowerBetter={lowerBetter} raw={data.metrics[key].raw} ai={data.metrics[key].ai} />)}
          </div>
          <p className="text-xs text-slate-500">CSI, POD, FAR and ETS use the 64.5 mm/day heavy-rain threshold. FSS is shown as “Not available” because the backend does not compute it.</p>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Rainfall error" subtitle="Lower is better"><VerificationChart data={errorBars} unit=" mm" label="RMSE and MAE" /></Panel>
            <Panel title="Heavy-rain categorical skill" subtitle="CSI/POD/ETS higher is better; FAR lower is better"><VerificationChart data={skillBars} label="Categorical skill scores" /></Panel>
          </div>

          {data.byRegime.length > 0 && (
            <Panel title="Error by predicted regime" subtitle="RMSE improvement (raw − corrected, mm); positive means the correction helped">
              <RegimeChart data={regimeRmse} unit=" mm" signed label="RMSE improvement" />
              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-slate-900 text-xs uppercase tracking-wider text-slate-500"><tr>
                    {["Regime", "n", "Raw RMSE", "AI RMSE", "Raw MAE", "AI MAE"].map((h) => <th key={h} scope="col" className="px-4 py-3">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-800">
                    {data.byRegime.map((r) => (
                      <tr key={r.regime} className="bg-slate-950"><td className="px-4 py-3">{r.regime}</td><td className="px-4 py-3">{r.n ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-400">{fmt(r.raw_rmse)}</td><td className="px-4 py-3 text-cyan-300">{fmt(r.corrected_rmse)}</td>
                        <td className="px-4 py-3 text-slate-400">{fmt(r.raw_mae)}</td><td className="px-4 py-3 text-cyan-300">{fmt(r.corrected_mae)}</td></tr>))}
                  </tbody>
                </table>
              </div>
            </Panel>)}

          <Panel title="Heavy-rain classifier" subtitle={`${splitLabel}; threshold 0.5 on predicted probability`}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[["Accuracy", data.heavy.accuracy], ["Precision", data.heavy.precision], ["Recall", data.heavy.recall], ["F1", data.heavy.f1], ["ROC-AUC", data.heavy.roc_auc]].map(([n, v]) => (
                <div key={n} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><p className="text-xs text-slate-500">{n}</p><p className="mt-1 text-xl font-bold text-cyan-300">{fmt(v, 3)}</p></div>))}
            </div>
          </Panel>
        </>)}
    </div>
  );
}

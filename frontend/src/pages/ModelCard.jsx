import { useCallback, useEffect, useState } from "react";
import { Panel, LoadingState, ErrorState, StatusBadge } from "../components/common/States";
import { getModelCard, apiErrorMessage } from "../api/api";
import { fmt } from "../api/normalize";

const Years = ({ y }) => (Array.isArray(y) && y.length ? (y.length > 1 ? `${Math.min(...y)}–${Math.max(...y)}` : String(y[0])) : "—");

export default function ModelCard() {
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setCard(await getModelCard()); } catch (e) { setCard(null); setError(apiErrorMessage(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState message="Loading model card…" />;
  if (error) return <ErrorState title="Model card unavailable" message={error} onRetry={load} />;
  if (!card) return null;

  const ds = card.dataset, moe = card.moe, exc = card.exceedance, ver = card.verification_summary;

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Transparency</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">VARSHA-MoE model card</h1>
        <p className="mt-1 text-sm text-slate-500">{card.intended_use}</p>
      </div>

      <Panel title="Data">
        {ds ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-[10px] uppercase text-slate-500">Type</dt><dd>{ds.type ?? "—"}</dd></div>
            <div><dt className="text-[10px] uppercase text-slate-500">Season</dt><dd>{ds.season ?? "—"} · <Years y={ds.years} /></dd></div>
            <div><dt className="text-[10px] uppercase text-slate-500">Districts / records</dt><dd>{ds.districts ?? "—"} / {ds.records?.toLocaleString() ?? "—"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-[10px] uppercase text-slate-500">Provenance</dt><dd className="text-slate-300">{ds.note ?? "—"}</dd></div>
          </dl>) : <p className="text-sm text-slate-500">Dataset metadata not available.</p>}
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <StatusBadge tone="cyan">Train <Years y={card.splits.train} /></StatusBadge>
          <StatusBadge tone="amber">Validation <Years y={card.splits.validation} /></StatusBadge>
          <StatusBadge tone="emerald">Test <Years y={card.splits.test} /></StatusBadge>
        </div>
      </Panel>

      <Panel title="Architecture" subtitle={moe?.design ?? "MoE metadata not available"}>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300">
          <li>Gate (XGBoost classifier) estimates probabilities for seven monsoon regimes.</li>
          <li>A global model predicts log1p(rainfall) from NWP and atmospheric features.</li>
          <li>Regime experts learn small residuals; each is shrunk by n/(n+K) and weighted by the gate probability.</li>
          <li>Separate classifiers give heavy-rain and IMD exceedance probabilities (isotonic calibrated on the validation season).</li>
        </ol>
        {moe?.train_days_per_regime && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="bg-slate-900 text-xs uppercase tracking-wider text-slate-500"><tr>{["Regime", "Training days", "Rows", "Shrinkage"].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-800">
                {Object.keys(moe.train_days_per_regime).map((r) => (
                  <tr key={r} className="bg-slate-950"><td className="px-3 py-2">{r}</td><td className="px-3 py-2">{moe.train_days_per_regime[r]}</td><td className="px-3 py-2">{moe.train_rows_per_regime?.[r] ?? "—"}</td>
                    <td className="px-3 py-2">{moe.expert_lambdas?.[r] != null ? fmt(moe.expert_lambdas[r], 2) : "no expert"}</td></tr>))}
              </tbody>
            </table>
          </div>)}
      </Panel>

      <Panel title="Held-out performance" subtitle={ver ? `${ver.n_days} test days · ${ver.n_samples?.toLocaleString()} district-days` : "Run python src/evaluation/verify_all.py"}>
        {ver ? (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="bg-slate-900 text-xs uppercase tracking-wider text-slate-500"><tr>{["Model", "RMSE", "MAE", "CSI"].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-800">
                {Object.entries(ver.models).map(([k, m]) => (
                  <tr key={k} className="bg-slate-950"><td className="px-3 py-2 capitalize">{k}</td><td className="px-3 py-2">{fmt(m.rmse, 2)}</td><td className="px-3 py-2">{fmt(m.mae, 2)}</td><td className="px-3 py-2">{fmt(m.csi, 3)}</td></tr>))}
              </tbody>
            </table>
          </div>) : <p className="text-sm text-slate-500">No verification record yet.</p>}
        {exc && <p className="mt-3 text-xs text-slate-500">Exceedance models: {Object.entries(exc).map(([k, v]) => `${v.threshold_mm} mm (${v.train_events} training events${v.experimental ? ", experimental" : ""})`).join(" · ")}</p>}
      </Panel>

      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="Known limitations"><ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-300">{card.limitations.map((l) => <li key={l}>{l}</li>)}</ul></Panel>
        <Panel title="Not intended for"><ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-300">{card.not_for.map((l) => <li key={l}>{l}</li>)}</ul></Panel>
      </div>
    </div>
  );
}

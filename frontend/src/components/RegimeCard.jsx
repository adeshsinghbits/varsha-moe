import { REGIME_INFO, regimeColor, fmtPct } from "../api/normalize";

// Hero strip: RAW -> REGIME-AWARE AI -> CORRECTED story
export default function RegimeCard({ regime, probability, loading, note }) {
  const info = REGIME_INFO[regime];
  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/5 to-indigo-500/5 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Detected monsoon regime</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="h-3 w-3 rounded-full" style={{ background: regimeColor(regime) }} aria-hidden="true" />
        <h2 className="text-2xl font-bold">{loading ? "Classifying…" : regime ?? "—"}</h2>
        {probability != null && !loading && <span className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300">Confidence {fmtPct(probability)}</span>}
      </div>
      {info && !loading && <p className="mt-2 max-w-2xl text-sm text-slate-400">{info.text}</p>}
      {note && <p className="mt-2 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

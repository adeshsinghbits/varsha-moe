import { FiX } from "react-icons/fi";
import { fmt, fmtSigned, fmtPct, fmtBool, regimeColor, imdCategory } from "../api/normalize";

function Row({ label, value, strong }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-800/70 py-2.5 last:border-0">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`text-right text-sm ${strong ? "font-bold text-cyan-300" : "text-slate-200"}`}>{value}</dd>
    </div>
  );
}

export default function DistrictDetails({ district, onClose }) {
  if (!district) return null;
  const warning = imdCategory(district.corrected_rainfall);
  return (
    <aside aria-label={`Details for ${district.district_name}`} className="rounded-xl border border-cyan-500/20 bg-slate-950/90 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold uppercase tracking-wide">{district.district_name}</h3>
          <p className="text-xs text-slate-500">{district.state_name ?? "State unavailable"}{district.date ? ` · ${district.date}` : ""}</p>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Close district details" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">
            <FiX />
          </button>
        )}
      </div>
      {warning && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-semibold" style={{ borderColor: `${warning.color}80`, color: warning.text, background: `${warning.color}26` }}>
          <span className="h-2 w-2 rounded-full" style={{ background: warning.color }} aria-hidden="true" />
          IMD category (AI corrected): {warning.label}
        </p>
      )}
      <dl className="mt-3">
        <Row label="Raw NWP" value={fmt(district.raw_rainfall, 2, "mm")} />
        <Row label="AI corrected" value={fmt(district.corrected_rainfall, 2, "mm")} strong />
        <Row label="Bias correction" value={fmtSigned(district.bias_correction, 2, "mm")} />
        {district.observed_rainfall !== null && <Row label="Observed (dataset)" value={fmt(district.observed_rainfall, 2, "mm")} />}
        <Row
          label="Regime"
          value={district.regime ? (
            <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: regimeColor(district.regime) }} aria-hidden="true" />{district.regime}</span>
          ) : "—"}
        />
        <Row label="Heavy rain" value={fmtBool(district.heavy_rain)} />
        <Row label="Probability" value={fmtPct(district.heavy_rain_probability, 2)} />
      </dl>
    </aside>
  );
}

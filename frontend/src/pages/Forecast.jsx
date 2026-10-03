import { useEffect, useRef, useState } from "react";
import { FiPlay, FiLoader, FiArrowDown } from "react-icons/fi";
import RegimeCard from "../components/RegimeCard";
import { Panel, ErrorState, StatusBadge } from "../components/common/States";
import { getForecast, apiErrorMessage } from "../api/api";
import { buildForecastPayload, DEFAULT_FORECAST_INPUT, FORECAST_FIELDS } from "../api/forecastPayload";
import { fmt, fmtSigned, fmtPct, fmtBool } from "../api/normalize";

const STAGES = ["Running regime classification…", "Applying rainfall bias correction…", "Estimating heavy rainfall probability…"];

const inputCls = "w-full rounded-lg border bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400";

function Field({ id, label, unit, value, onChange, error, type = "number", ...rest }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-slate-400">{label}{unit ? <span className="text-slate-600"> ({unit})</span> : null}</label>
      <input id={id} type={type} step="any" value={value} onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-err` : undefined}
        className={`${inputCls} ${error ? "border-red-500/60" : "border-slate-700"}`} {...rest} />
      {error && <p id={`${id}-err`} className="mt-1 text-[11px] text-red-300">{error}</p>}
    </div>
  );
}

function Stat({ label, value, tone = "text-slate-100" }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

export default function Forecast() {
  const [input, setInput] = useState(DEFAULT_FORECAST_INPUT);
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [ranWith, setRanWith] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [apiError, setApiError] = useState("");
  const timer = useRef(null);

  useEffect(() => () => clearInterval(timer.current), []);

  const set = (key) => (value) => setInput((p) => ({ ...p, [key]: value }));

  const run = async (event) => {
    event.preventDefault();
    const { payload, errors: e } = buildForecastPayload(input);
    setErrors(e ?? {});
    if (!payload) return;

    setLoading(true);
    setApiError("");
    setStage(0);
    // The backend runs the three models in one request; the stage text is progress messaging only.
    timer.current = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 700);

    try {
      const res = await getForecast(payload);
      if (!res) throw new Error("The API returned an empty forecast.");
      setResult(res);
      setRanWith(input);
    } catch (err) {
      setResult(null);
      setApiError(apiErrorMessage(err));
    } finally {
      clearInterval(timer.current);
      setLoading(false);
    }
  };

  const reset = () => { setInput(DEFAULT_FORECAST_INPUT); setErrors({}); };

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Forecast workspace</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Run the AI post-processing pipeline</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">Enter a raw NWP rainfall value and atmospheric context. The regime classifier, rainfall corrector and heavy-rain classifier run on the backend.</p>
      </div>

      <form onSubmit={run} noValidate>
        <Panel title="Inputs" subtitle="Defaults are illustrative demo values, not observations. Wind speed and calendar features are derived automatically."
          action={<button type="button" onClick={reset} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">Reset to demo values</button>}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field id="date" type="date" label="Date" value={input.date} onChange={set("date")} error={errors.date} />
            <Field id="latitude" label="Latitude" unit="°N" value={input.latitude} onChange={set("latitude")} error={errors.latitude} />
            <Field id="longitude" label="Longitude" unit="°E" value={input.longitude} onChange={set("longitude")} error={errors.longitude} />
            {FORECAST_FIELDS.map((f) => (
              <Field key={f.key} id={f.key} label={f.label} unit={f.unit} value={input[f.key]} onChange={set(f.key)} error={errors[f.key]} />
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              {loading ? <FiLoader className="animate-spin" aria-hidden="true" /> : <FiPlay aria-hidden="true" />}
              {loading ? "Running…" : "Run AI Forecast"}
            </button>
            <p role="status" aria-live="polite" className="text-sm text-cyan-300">{loading ? STAGES[stage] : ""}</p>
          </div>
        </Panel>
      </form>

      {apiError && <ErrorState title={apiError === "ML API Offline" ? "ML API Offline" : "Forecast could not be generated"} message={apiError === "ML API Offline" ? "Start the FastAPI backend and try again." : apiError} />}

      {result && (
        <div className="space-y-4" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2"><StatusBadge tone="amber">Model output · user-supplied inputs</StatusBadge>
            {ranWith && <span className="text-xs text-slate-500">{ranWith.date} · {Number(ranWith.latitude).toFixed(2)}°N, {Number(ranWith.longitude).toFixed(2)}°E</span>}</div>

          <RegimeCard regime={result.regime} probability={result.regime_probability} />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Raw NWP" value={fmt(result.raw, 2, "mm")} />
            <Stat label="AI corrected" value={fmt(result.corrected, 2, "mm")} tone="text-cyan-300" />
            <Stat label="Bias correction" value={fmtSigned(result.bias, 2, "mm")} tone={result.bias > 0 ? "text-emerald-300" : result.bias < 0 ? "text-red-300" : undefined} />
            <Stat label="Heavy rain" value={fmtBool(result.heavy_rain)} tone={result.heavy_rain ? "text-amber-300" : undefined} />
            <Stat label="Probability" value={fmtPct(result.heavy_rain_probability, 2)} />
          </div>

          <Panel title="What happened">
            <div className="flex flex-col gap-2 text-sm text-slate-300 md:flex-row md:items-center md:gap-4">
              <span className="rounded-lg bg-slate-800 px-3 py-2">Raw {fmt(result.raw, 1, "mm")}</span>
              <FiArrowDown className="mx-auto md:-rotate-90" aria-hidden="true" />
              <span className="rounded-lg bg-indigo-500/15 px-3 py-2 text-indigo-200">Regime: {result.regime ?? "—"}</span>
              <FiArrowDown className="mx-auto md:-rotate-90" aria-hidden="true" />
              <span className="rounded-lg bg-cyan-500/15 px-3 py-2 text-cyan-200">Corrected {fmt(result.corrected, 1, "mm")}</span>
            </div>
            <p className="mt-3 text-sm text-slate-400">Rainfall was adjusted based on the detected atmospheric regime. Heavy-rain probability is a separate classifier output and does not take the corrected value as an input.</p>
          </Panel>
        </div>
      )}
    </div>
  );
}

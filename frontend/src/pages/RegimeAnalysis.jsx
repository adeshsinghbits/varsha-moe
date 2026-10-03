import { useCallback, useEffect, useMemo, useState } from "react";
import RegimeCard from "../components/RegimeCard";
import RegimeChart from "../components/RegimeChart";
import { Panel, ErrorState, LoadingState, StatusBadge } from "../components/common/States";
import { getDistricts, getForecast, apiErrorMessage } from "../api/api";
import { buildForecastPayload, DEFAULT_FORECAST_INPUT } from "../api/forecastPayload";
import { REGIME_INFO, REGIME_NAMES, regimeColor, fmt, fmtSigned } from "../api/normalize";

export default function RegimeAnalysis() {
  const [demo, setDemo] = useState(null);
  const [demoLoading, setDemoLoading] = useState(true);
  const [demoError, setDemoError] = useState("");

  const [districts, setDistricts] = useState([]);
  const [distLoading, setDistLoading] = useState(true);
  const [distError, setDistError] = useState("");
  const [date, setDate] = useState(null);

  // independent requests
  const loadDemo = useCallback(async () => {
    setDemoLoading(true); setDemoError("");
    try {
      const { payload } = buildForecastPayload(DEFAULT_FORECAST_INPUT);
      setDemo(await getForecast(payload));
    } catch (e) { setDemo(null); setDemoError(apiErrorMessage(e)); }
    finally { setDemoLoading(false); }
  }, []);

  const loadDistricts = useCallback(async () => {
    setDistLoading(true); setDistError("");
    try { const r = await getDistricts({ limit: 200 }); setDistricts(r.districts); setDate(r.date); }
    catch (e) { setDistricts([]); setDistError(apiErrorMessage(e)); }
    finally { setDistLoading(false); }
  }, []);

  useEffect(() => { loadDemo(); loadDistricts(); }, [loadDemo, loadDistricts]);

  const stats = useMemo(() => {
    const m = new Map();
    for (const d of districts) {
      if (!d.regime) continue;
      const s = m.get(d.regime) ?? { n: 0, bias: 0, biasN: 0, raw: 0, corr: 0, rcN: 0 };
      s.n += 1;
      if (d.bias_correction !== null) { s.bias += d.bias_correction; s.biasN += 1; }
      if (d.raw_rainfall !== null && d.corrected_rainfall !== null) { s.raw += d.raw_rainfall; s.corr += d.corrected_rainfall; s.rcN += 1; }
      m.set(d.regime, s);
    }
    return REGIME_NAMES.filter((r) => m.has(r)).map((regime) => {
      const s = m.get(regime);
      return { regime, n: s.n, bias: s.biasN ? s.bias / s.biasN : null, raw: s.rcN ? s.raw / s.rcN : null, corr: s.rcN ? s.corr / s.rcN : null };
    });
  }, [districts]);

  const heldOutNote = date ? `District statistics: held-out test split, ${date}` : undefined;

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Atmospheric classification</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Regime analysis</h1>
        <p className="mt-1 text-sm text-slate-500">The regime classifier selects which rainfall-correction behaviour applies to each forecast.</p>
      </div>

      {demoError && <ErrorState title="Regime could not be classified" message={demoError} onRetry={loadDemo} />}
      <RegimeCard regime={demo?.regime} probability={demo?.regime_probability} loading={demoLoading} note="Demo Forecast (default inputs) — not an observation." />

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Regime distribution" subtitle={heldOutNote ?? "Districts per detected regime"}>
          {distLoading ? <LoadingState message="Loading district regimes…" /> : distError ? <ErrorState title="District data unavailable" message={distError} onRetry={loadDistricts} />
            : <RegimeChart data={stats.map((s) => ({ regime: s.regime, value: s.n }))} label="Districts" />}
        </Panel>
        <Panel title="Mean bias correction by regime" subtitle="Average (AI corrected − raw NWP) across districts in each regime">
          {distLoading ? <LoadingState message="Loading…" /> : distError ? <ErrorState title="District data unavailable" message={distError} />
            : <RegimeChart data={stats.filter((s) => s.bias !== null).map((s) => ({ regime: s.regime, value: s.bias }))} unit=" mm" signed label="Mean correction" />}
        </Panel>
      </div>

      <Panel title="Regime comparison" subtitle="Raw vs corrected rainfall averaged per regime (districts present in the current snapshot only)">
        {!stats.length ? <p className="text-sm text-slate-500">No district regime data available.</p> : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-slate-900 text-xs uppercase tracking-wider text-slate-500"><tr>
                <th scope="col" className="px-4 py-3">Regime</th><th scope="col" className="px-4 py-3">Districts</th>
                <th scope="col" className="px-4 py-3">Mean raw</th><th scope="col" className="px-4 py-3">Mean corrected</th><th scope="col" className="px-4 py-3">Mean bias</th></tr></thead>
              <tbody className="divide-y divide-slate-800">
                {stats.map((s) => (
                  <tr key={s.regime} className="bg-slate-950">
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: regimeColor(s.regime) }} aria-hidden="true" />{s.regime}</span></td>
                    <td className="px-4 py-3">{s.n}</td><td className="px-4 py-3 text-slate-400">{fmt(s.raw, 1, "mm")}</td>
                    <td className="px-4 py-3 text-cyan-300">{fmt(s.corr, 1, "mm")}</td><td className="px-4 py-3">{fmtSigned(s.bias, 1, "mm")}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>)}
      </Panel>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {REGIME_NAMES.map((name) => {
          const active = demo?.regime === name;
          return (
            <div key={name} className={`rounded-2xl border p-5 ${active ? "border-cyan-400/40 bg-cyan-400/5" : "border-slate-800 bg-slate-900/50"}`}>
              <div className="flex items-center justify-between"><span className="h-3 w-3 rounded-full" style={{ background: regimeColor(name) }} aria-hidden="true" />{active && <StatusBadge tone="cyan">Demo forecast regime</StatusBadge>}</div>
              <h3 className="mt-3 font-semibold">{name}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">{REGIME_INFO[name].text}</p>
            </div>);
        })}
      </div>
    </div>
  );
}

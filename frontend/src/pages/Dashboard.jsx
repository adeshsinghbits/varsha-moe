import { useCallback, useEffect, useMemo, useState } from "react";
import { FaCloudRain, FaMapMarkedAlt } from "react-icons/fa";
import { FiTarget, FiTrendingUp, FiActivity, FiAlertCircle, FiRefreshCw } from "react-icons/fi";
import KPICard from "../components/KPICard";
import RegimeCard from "../components/RegimeCard";
import RainfallMap from "../components/RainfallMap";
import ForecastTable from "../components/ForecastTable";
import RainfallChart from "../components/RainfallChart";
import RegimeChart from "../components/RegimeChart";
import ProvenanceBadge from "../components/ProvenanceBadge";
import CaseReplays from "../components/CaseReplays";
import { Panel, ErrorState } from "../components/common/States";
import { getDistricts, getForecast, getDistrictHistory, apiErrorMessage } from "../api/api";
import { buildForecastPayload, DEFAULT_FORECAST_INPUT } from "../api/forecastPayload";
import { fmt, fmtSigned, fmtPct, fmtBool, regimeColor } from "../api/normalize";

function Dashboard() {
  // ---- districts and the demo forecast load INDEPENDENTLY ----------------------
  const [districts, setDistricts] = useState([]);
  const [districtDate, setDistrictDate] = useState(null);
  const [districtsLoading, setDistrictsLoading] = useState(true);
  const [districtsError, setDistrictsError] = useState("");

  const [forecast, setForecast] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(true);
  const [forecastError, setForecastError] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [trend, setTrend] = useState([]);

  const loadDistricts = useCallback(async () => {
    setDistrictsLoading(true);
    setDistrictsError("");
    try {
      const result = await getDistricts({ limit: 200 });
      setDistricts(result.districts);
      setDistrictDate(result.date);
    } catch (err) {
      setDistricts([]);
      setDistrictsError(apiErrorMessage(err));
    } finally {
      setDistrictsLoading(false);
    }
  }, []);

  const loadForecast = useCallback(async () => {
    setForecastLoading(true);
    setForecastError("");
    try {
      const { payload, errors } = buildForecastPayload(DEFAULT_FORECAST_INPUT);
      if (!payload) throw new Error(Object.values(errors).join("; "));
      const result = await getForecast(payload);
      if (!result) throw new Error("Forecast response was empty");
      setForecast(result);
    } catch (err) {
      setForecast(null);
      setForecastError(apiErrorMessage(err));
    } finally {
      setForecastLoading(false);
    }
  }, []);

  useEffect(() => { loadDistricts(); loadForecast(); }, [loadDistricts, loadForecast]);

  const selected = useMemo(() => districts.find((d) => d.id === selectedId) ?? null, [districts, selectedId]);

  // trend for the selected district (archive endpoint; optional)
  useEffect(() => {
    let cancelled = false;
    if (!selected) { setTrend([]); return undefined; }
    getDistrictHistory({ district: selected.district_name, limit: 60 })
      .then(({ records }) => {
        if (cancelled) return;
        setTrend([...records].sort((a, b) => String(a.date).localeCompare(String(b.date)))
          .map((r) => ({ label: r.date ?? "", raw: r.raw_rainfall, ai: r.corrected_rainfall, observed: r.observed_rainfall })));
      })
      .catch(() => { if (!cancelled) setTrend([]); });
    return () => { cancelled = true; };
  }, [selected]);

  // KPI source: selected district, otherwise the demo forecast
  const source = selected
    ? { raw: selected.raw_rainfall, ai: selected.corrected_rainfall, bias: selected.bias_correction, regime: selected.regime,
        heavy: selected.heavy_rain, prob: selected.heavy_rain_probability, conf: selected.regime_probability,
        label: `${selected.district_name}${selected.date ? ` · ${selected.date}` : ""}` }
    : forecast
      ? { raw: forecast.raw, ai: forecast.corrected, bias: forecast.bias, regime: forecast.regime, heavy: forecast.heavy_rain,
          prob: forecast.heavy_rain_probability, conf: forecast.regime_probability, label: "Demo Forecast (default inputs)" }
      : null;
  const sourceLoading = !selected && forecastLoading;

  const v = (fn) => (sourceLoading || !source ? "—" : fn(source));

  const regimeCounts = useMemo(() => {
    const m = new Map();
    districts.forEach((d) => d.regime && m.set(d.regime, (m.get(d.regime) ?? 0) + 1));
    return [...m.entries()].map(([regime, value]) => ({ regime, value })).sort((a, b) => b.value - a.value);
  }, [districts]);

  const topChart = useMemo(
    () => [...districts].filter((d) => d.corrected_rainfall !== null).sort((a, b) => b.corrected_rainfall - a.corrected_rainfall).slice(0, 10)
      .map((d) => ({ label: d.district_name, raw: d.raw_rainfall, ai: d.corrected_rainfall, observed: d.observed_rainfall })),
    [districts],
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Monsoon Intelligence Center</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">AI Post-Processed District Forecast</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Raw NWP rainfall → monsoon regime → regime-aware bias correction → heavy-rain probability.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ProvenanceBadge extra={districtDate ?? undefined} />
          <button onClick={() => { loadDistricts(); loadForecast(); }} className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">
            <FiRefreshCw aria-hidden="true" className={districtsLoading || forecastLoading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {forecastError && !selected && <ErrorState title="Forecast could not be generated" message={forecastError} onRetry={loadForecast} />}

      <RegimeCard regime={source?.regime} probability={source?.conf} loading={sourceLoading} note={source ? `Showing: ${source.label}` : undefined} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <KPICard title="Raw NWP" value={v((s) => fmt(s.raw))} unit="mm" subtitle="Input forecast" icon={FaCloudRain} accent="blue" />
        <KPICard title="AI corrected" value={v((s) => fmt(s.ai))} unit="mm" subtitle="Regime-aware" icon={FiTrendingUp} accent="cyan" />
        <KPICard title="Bias correction" value={v((s) => fmtSigned(s.bias))} unit="mm" subtitle="AI − raw" icon={FiActivity} accent="indigo" />
        <KPICard title="Heavy rain" value={v((s) => fmtBool(s.heavy))} subtitle="≥ 64.5 mm/day class" icon={FiAlertCircle} accent="amber" />
        <KPICard title="Heavy-rain prob." value={v((s) => fmtPct(s.prob, 2))} subtitle="Classifier output" icon={FiTarget} accent="amber" />
        <KPICard title="Regime" value={v((s) => s.regime ?? "—")} subtitle="Classifier output" icon={FiActivity} accent="emerald" valueColor={source?.regime ? regimeColor(source.regime) : undefined} />
        <KPICard title="Districts" value={districtsLoading || districtsError ? "—" : String(districts.length)} subtitle="Records available" icon={FaMapMarkedAlt} accent="cyan" />
      </div>

      <Panel title="District rainfall map" subtitle="Click a district for its raw → corrected breakdown. Marker size and colour follow AI-corrected rainfall.">
        <RainfallMap districts={districts} loading={districtsLoading} error={districtsError} onRetry={loadDistricts} selectedId={selectedId} onSelect={setSelectedId} />
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Panel
          title={selected ? `Rainfall trend — ${selected.district_name}` : "Highest-rainfall districts"}
          subtitle={selected ? "Raw NWP vs AI corrected vs observed, from the district archive" : "Raw NWP vs AI corrected for the 10 wettest districts; select a district for its time series"}
        >
          <RainfallChart data={selected ? trend : topChart} emptyMessage={selected ? "No archive records for this district." : "District data unavailable."} />
        </Panel>
        <Panel title="Regime intelligence" subtitle="Districts per detected regime">
          <RegimeChart data={regimeCounts} label="Districts" />
        </Panel>
      </div>

      <Panel title="Extreme-event case replays" subtitle="The heaviest held-out district-days: what the raw model said, what the AI-corrected forecast said, and what IMD observed">
        <CaseReplays />
      </Panel>

      <Panel title="District forecast table" subtitle="Sortable; click a row to select the district">
        <ForecastTable data={districts} loading={districtsLoading} selectedId={selectedId} onSelect={setSelectedId} />
        {districtsError && <p className="mt-2 text-xs text-red-300">District data unavailable: {districtsError}</p>}
      </Panel>
    </div>
  );
}
export default Dashboard;

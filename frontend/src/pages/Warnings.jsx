import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import { FiDownload } from "react-icons/fi";
import "leaflet/dist/leaflet.css";
import { Panel, LoadingState, ErrorState, EmptyState, StatusBadge } from "../components/common/States";
import { getAvailableDates, getDistrictProducts, getGeoDistricts, bulletinUrl, apiErrorMessage } from "../api/api";
import { IMD_CATEGORIES, imdCategory, fmt, fmtPct, regimeColor } from "../api/normalize";

const MODES = [
  { key: "corrected", label: "AI corrected" },
  { key: "raw", label: "Raw NWP" },
  { key: "observed", label: "Observed (IMD)" },
];

const valueFor = (d, mode) =>
  mode === "raw" ? d.raw_rainfall_mm : mode === "observed" ? d.observed_rainfall_mm : d.corrected_rainfall_mm;

function ExceedBar({ label, p, color, experimental }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-400">
        <span>{label}{experimental && <span className="ml-1 text-amber-300">(experimental)</span>}</span>
        <span className="text-slate-200">{p == null ? "—" : fmtPct(p, 0)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800" role="img" aria-label={`${label} probability ${p == null ? "unavailable" : fmtPct(p, 0)}`}>
        <div className="h-full rounded-full" style={{ width: `${(p ?? 0) * 100}%`, background: color }} />
      </div>
    </div>
  );
}

export default function Warnings() {
  const [dates, setDates] = useState(null);
  const [date, setDate] = useState("");
  const [data, setData] = useState(null);
  const [geo, setGeo] = useState(null);
  const [mode, setMode] = useState("corrected");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getAvailableDates().then((r) => { setDates(r); setDate(r.latest ?? ""); }).catch((e) => { setError(apiErrorMessage(e)); setLoading(false); });
    getGeoDistricts().then(setGeo).catch(() => setGeo(null));
  }, []);

  const load = useCallback(async () => {
    if (!date) return;
    setLoading(true); setError("");
    try { setData(await getDistrictProducts({ date })); setSelected(null); }
    catch (e) { setData(null); setError(apiErrorMessage(e)); }
    finally { setLoading(false); }
  }, [date]);
  useEffect(() => { load(); }, [load]);

  const byId = useMemo(() => new Map((data?.districts ?? []).map((d) => [d.district_id, d])), [data]);
  const ranked = useMemo(
    () => [...(data?.districts ?? [])].filter((d) => valueFor(d, mode) != null).sort((a, b) => valueFor(b, mode) - valueFor(a, mode)).slice(0, 10),
    [data, mode],
  );
  const sel = selected ? byId.get(selected) : null;
  const meta = data?.exceedance_meta ?? {};

  const style = useCallback((feature) => {
    const d = byId.get(feature.properties.district_id);
    const cat = d ? imdCategory(valueFor(d, mode)) : null;
    const isSel = feature.properties.district_id === selected;
    return { color: isSel ? "#ffffff" : "#0f172a", weight: isSel ? 3 : 1, fillColor: cat?.color ?? "#334155", fillOpacity: cat ? 0.75 : 0.25 };
  }, [byId, mode, selected]);

  const onEach = useCallback((feature, layer) => {
    const d = byId.get(feature.properties.district_id);
    layer.bindTooltip(`${feature.properties.district_name}${d ? ` — ${fmt(valueFor(d, mode), 1, "mm")}` : ""}`, { sticky: true });
    layer.on("click", () => setSelected(feature.properties.district_id));
  }, [byId, mode]);

  const inSample = data?.in_sample_warning;

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">District decision support</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">District warnings</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">Polygons are coloured by IMD daily rainfall category. Exceedance probabilities estimate the chance that at least one 0.25° cell in the district reaches each IMD threshold.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-400">Date
            <input type="date" value={date} min={dates?.dates?.[0]?.date} max={dates?.latest} onChange={(e) => setDate(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400" />
          </label>
          <a href={bulletinUrl(date)} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
            <FiDownload aria-hidden="true" /> PDF bulletin
          </a>
        </div>
      </div>

      {data && (
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={data.split === "test" ? "emerald" : "amber"}>{data.split === "test" ? "Held-out test date" : `${data.split} date`}</StatusBadge>
          {inSample && <span className="text-xs text-amber-300">This date was used to train or tune the models, so it is in-sample and does not measure forecast skill.</span>}
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Map variable">
        {MODES.map((m) => (
          <button key={m.key} role="tab" aria-selected={mode === m.key} onClick={() => setMode(m.key)}
            className={`rounded-lg px-3 py-1.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 ${mode === m.key ? "bg-cyan-500/15 text-cyan-300" : "text-slate-400 hover:bg-slate-900"}`}>{m.label}</button>))}
      </div>

      {error ? <ErrorState title="District warnings unavailable" message={error} onRetry={load} />
        : loading && !data ? <LoadingState message="Loading district products…" className="h-[420px]" />
        : !data?.districts?.length ? <EmptyState title="No district products for this date" message="Choose a date inside the dataset range." />
        : (
        <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
          <div className="space-y-3">
            <div className="relative h-[460px] overflow-hidden rounded-2xl border border-slate-800 sm:h-[560px]">
              {geo ? (
                <MapContainer center={[22.8, 80.5]} zoom={5} minZoom={4} scrollWheelZoom className="h-full w-full">
                  <TileLayer attribution="© OpenStreetMap contributors © CARTO" url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                  <GeoJSON key={`${date}-${mode}-${selected}`} data={geo} style={style} onEachFeature={onEach} />
                </MapContainer>
              ) : <EmptyState title="District polygons unavailable" message="Add india_districts.geojson to ml/data/raw." className="h-full" />}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-slate-400" aria-label="IMD category legend">
              {[...IMD_CATEGORIES].reverse().map((c) => (
                <span key={c.key} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} aria-hidden="true" />{c.label} (≥ {c.min} mm)</span>))}
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-600" aria-hidden="true" />No value</span>
            </div>
          </div>

          <div className="space-y-4">
            {sel ? (
              <Panel title={sel.district_name} subtitle={sel.state_name}>
                {(() => { const c = imdCategory(sel.corrected_rainfall_mm); return c && (
                  <p className="mb-3 inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-semibold" style={{ borderColor: `${c.color}80`, color: c.text, background: `${c.color}26` }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color }} aria-hidden="true" />{c.label}</p>); })()}
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-[10px] uppercase text-slate-500">Raw NWP</dt><dd>{fmt(sel.raw_rainfall_mm, 1, "mm")}</dd></div>
                  <div><dt className="text-[10px] uppercase text-slate-500">AI corrected</dt><dd className="font-bold text-cyan-300">{fmt(sel.corrected_rainfall_mm, 1, "mm")}</dd></div>
                  <div><dt className="text-[10px] uppercase text-slate-500">Observed (IMD)</dt><dd className="text-emerald-300">{fmt(sel.observed_rainfall_mm, 1, "mm")}</dd></div>
                  <div><dt className="text-[10px] uppercase text-slate-500">Regime</dt><dd className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: regimeColor(sel.regime) }} aria-hidden="true" />{sel.regime ?? "—"}</dd></div>
                </dl>
                <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Exceedance probability</h3>
                <div className="space-y-3">
                  <ExceedBar label="≥ 64.5 mm (heavy)" p={sel.exceedance?.heavy} color="#f59e0b" experimental={meta.heavy?.experimental} />
                  <ExceedBar label="≥ 115.6 mm (very heavy)" p={sel.exceedance?.very_heavy} color="#dc2626" experimental={meta.very_heavy?.experimental} />
                  <ExceedBar label="≥ 204.5 mm (extremely heavy)" p={sel.exceedance?.extremely_heavy} color="#7f1d1d" experimental={meta.extremely_heavy?.experimental} />
                </div>
                <p className="mt-3 text-[11px] text-slate-600">Any cell in the district reaching the threshold. The 204.5 mm model is trained on very few events.</p>
              </Panel>
            ) : <EmptyState title="Select a district" message="Click a polygon or a list row." className="min-h-[140px]" />}

            <Panel title={`Top 10 · ${MODES.find((m) => m.key === mode).label}`}>
              <ol className="divide-y divide-slate-800">
                {ranked.map((d, i) => {
                  const cat = imdCategory(valueFor(d, mode));
                  return (
                    <li key={d.district_id}>
                      <button onClick={() => setSelected(d.district_id)} className="flex w-full items-center gap-3 py-2 text-left text-sm hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">
                        <span className="w-5 text-xs text-slate-600">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate">{d.district_name}<span className="block text-[10px] text-slate-600">{d.state_name}</span></span>
                        <span className="text-right text-xs"><span className="text-slate-200">{fmt(valueFor(d, mode), 1, "mm")}</span>{cat && <span className="block text-[10px]" style={{ color: cat.color }}>{cat.label}</span>}</span>
                      </button>
                    </li>);
                })}
              </ol>
            </Panel>
          </div>
        </div>)}
    </div>
  );
}

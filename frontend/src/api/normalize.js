// Single place where backend responses are normalised for the UI.
// Rule: never invent values. Missing -> null. UI renders null as "—".

export const REGIME_INFO = {
  "Active Monsoon": { color: "#22d3ee", text: "Vigorous monsoon circulation with widespread, enhanced rainfall." },
  "Break Monsoon": { color: "#f59e0b", text: "Monsoon trough shifts north; rainfall weakens over central India." },
  "Monsoon Low/Depression": { color: "#818cf8", text: "Organised low-pressure system bringing heavy, concentrated rain." },
  Orographic: { color: "#34d399", text: "Rainfall enhanced by moist flow lifted over terrain such as the Western Ghats and north-east hills." },
  Coastal: { color: "#38bdf8", text: "Moisture convergence and sea-breeze effects along the coast." },
  "Western Disturbance": { color: "#c084fc", text: "Mid-latitude disturbance driving rainfall over northern India." },
  "Weak/Normal": { color: "#94a3b8", text: "No dominant organised system; weak or near-normal rainfall conditions." },
};

export const REGIME_NAMES = Object.keys(REGIME_INFO);
export const regimeColor = (name) => REGIME_INFO[name]?.color ?? "#64748b";

export const toNum = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export const clamp01 = (value) => {
  const n = toNum(value);
  return n === null ? null : Math.min(1, Math.max(0, n));
};

// IMD daily rainfall warning categories (mm/24 h), as used for district warnings.
export const IMD_CATEGORIES = [
  { min: 204.5, key: "extreme", label: "Extremely heavy", color: "#7f1d1d", text: "#fecaca" },
  { min: 115.6, key: "very", label: "Very heavy", color: "#dc2626", text: "#fecaca" },
  { min: 64.5, key: "heavy", label: "Heavy", color: "#f59e0b", text: "#fde68a" },
  { min: 15.6, key: "moderate", label: "Moderate", color: "#22c55e", text: "#bbf7d0" },
  { min: 0, key: "light", label: "Light / none", color: "#38bdf8", text: "#bae6fd" },
];
export const imdCategory = (mm) => {
  const n = toNum(mm);
  return n === null ? null : IMD_CATEGORIES.find((c) => n >= c.min) ?? IMD_CATEGORIES[IMD_CATEGORIES.length - 1];
};

// ---- formatting (never prints NaN / undefined) ---------------------------
export const fmt = (value, digits = 2, unit = "") => {
  const n = toNum(value);
  return n === null ? "—" : `${n.toFixed(digits)}${unit ? ` ${unit}` : ""}`;
};
export const fmtSigned = (value, digits = 2, unit = "") => {
  const n = toNum(value);
  if (n === null) return "—";
  return `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(digits)}${unit ? ` ${unit}` : ""}`;
};
export const fmtPct = (prob, digits = 1) => {
  const n = clamp01(prob);
  return n === null ? "—" : `${(n * 100).toFixed(digits)}%`;
};
export const fmtBool = (value) => (value === null || value === undefined ? "—" : value ? "Yes" : "No");

// ---- districts -----------------------------------------------------------
export function normalizeDistrict(item, index = 0) {
  if (!item || typeof item !== "object") return null;

  // Backend history/archive response can contain:
  // raw_rainfall
  // raw_nwp_rainfall
  // raw_rainfall_mm
  // raw_nwp_d1_mm
  //
  // D1 is the appropriate raw NWP value for the archive row.
  const raw = toNum(
    item.raw_rainfall ??
      item.raw_nwp_rainfall ??
      item.raw_rainfall_mm ??
      item.raw_nwp_d1_mm
  );

  // IMPORTANT:
  // Do NOT derive corrected rainfall from observed rainfall.
  // Corrected rainfall must come from the ML model/backend.
  const corrected = toNum(
    item.corrected_rainfall ??
      item.corrected_rainfall_mm
  );

  const bias =
    toNum(
      item.bias_correction ??
        item.bias_correction_mm
    ) ??
    (raw !== null && corrected !== null
      ? corrected - raw
      : null);

  const observed = toNum(
    item.observed_rainfall ??
      item.observed_rainfall_mm
  );

  return {
    district_id: item.district_id ?? null,

    id: String(
      item._id ??
        item.id ??
        item.district_id ??
        `${item.district_name ?? "district"}-${item.date ?? ""}-${index}`
    ),

    district_name:
      item.district_name ??
      item.name ??
      "Unknown district",

    state_name:
      item.state_name ??
      item.state ??
      null,

    date: item.date ?? null,

    latitude: toNum(
      item.latitude ??
        item.lat
    ),

    longitude: toNum(
      item.longitude ??
        item.lng ??
        item.lon
    ),

    rainfall:
      corrected ??
      raw ??
      observed,

    raw_rainfall: raw,

    corrected_rainfall: corrected,

    bias_correction: bias,

    observed_rainfall: observed,

    observed_max_rainfall: toNum(
      item.observed_max_rainfall ??
        item.observed_max_rainfall_mm
    ),

    // Preserve D1-D5 values for historical analysis.
    raw_nwp_d1_mm: toNum(item.raw_nwp_d1_mm),
    raw_nwp_d2_mm: toNum(item.raw_nwp_d2_mm),
    raw_nwp_d3_mm: toNum(item.raw_nwp_d3_mm),
    raw_nwp_d4_mm: toNum(item.raw_nwp_d4_mm),
    raw_nwp_d5_mm: toNum(item.raw_nwp_d5_mm),

    regime:
      item.regime ??
      item.predicted_regime ??
      null,

    regime_probability: clamp01(
      item.regime_probability
    ),

    heavy_rain:
      typeof item.heavy_rain === "boolean"
        ? item.heavy_rain
        : null,

    heavy_rain_probability: clamp01(
      item.heavy_rain_probability
    ),

    created_at:
      item.created_at ??
      null,
  };
}

// Accepts: [...], {districts:[...]}, {data:[...]}, {data:{districts:[...]}}, empty
export function normalizeDistrictResponse(response) {
  let list = [];
  if (Array.isArray(response)) list = response;
  else if (Array.isArray(response?.districts)) list = response.districts;
  else if (Array.isArray(response?.data)) list = response.data;
  else if (Array.isArray(response?.data?.districts)) list = response.data.districts;

  const districts = list.map(normalizeDistrict).filter(Boolean);
  return {
    districts,
    date: response?.date ?? districts.find((d) => d.date)?.date ?? null,
    count: districts.length,
  };
}

export const normalizeDistrictHistory = (response) => ({
  records: (Array.isArray(response?.data) ? response.data : []).map(normalizeDistrict).filter(Boolean),
  total: toNum(response?.total) ?? 0,
});

// ---- forecast ------------------------------------------------------------
// /api/forecast -> { forecast: { raw_rainfall_mm, corrected_rainfall_mm, ... } }
// /api/predict  -> { data: { raw_nwp_rainfall, corrected_rainfall, ... } }
export function normalizeForecastResponse(response) {
  const f = response?.forecast ?? response?.data?.forecast ?? response?.data ?? response;
  if (!f || typeof f !== "object") return null;

  const raw = toNum(f.raw_rainfall_mm ?? f.raw_nwp_rainfall);
  const corrected = toNum(f.corrected_rainfall_mm ?? f.corrected_rainfall);
  const result = {
    raw,
    corrected,
    bias: toNum(f.bias_correction_mm ?? f.bias_correction) ?? (raw !== null && corrected !== null ? corrected - raw : null),
    regime: f.regime ?? f.predicted_regime ?? null,
    regime_probability: clamp01(f.regime_probability),
    heavy_rain: typeof f.heavy_rain === "boolean" ? f.heavy_rain : null,
    heavy_rain_probability: clamp01(f.heavy_rain_probability),
    location: response?.location ?? null,
  };
  return result.corrected === null && result.regime === null ? null : result;
}

// ---- provenance (/api/provenance) ---------------------------------------------
export function normalizeProvenance(response) {
  if (!response?.available) return null;
  return {
    label: response.label ?? "Dataset provenance unavailable",
    isReal: Boolean(response.is_real),
    matchesConfig: response.processed_matches_config !== false,
    processedYears: Array.isArray(response.processed_test_years) ? response.processed_test_years : null,
    note: response.note ?? null,
    season: response.season ?? null,
    years: Array.isArray(response.years) ? response.years : null,
    splits: response.splits ?? null,
  };
}

// ---- data status (/api/data-status) --------------------------------------------
export const normalizeDataStatus = (r) =>
  r && typeof r === "object"
    ? { mongodb: Boolean(r.mongodb), modelsLoaded: Boolean(r.models_loaded),
        districts: toNum(r.district_forecasts), verification: toNum(r.verification_records), latestDate: r.latest_date ?? null }
    : null;

// ---- case replays (/api/case-replays) ------------------------------------------
export const normalizeCaseReplays = (response) =>
  (Array.isArray(response?.cases) ? response.cases : []).map((c) => ({
    id: String(c.id),
    name: c.name ?? "Case",
    description: c.description ?? null,
    regime: c.regime ?? null,
    dates: Array.isArray(c.dates) ? c.dates : [],
    observedMax: toNum(c.observed_max_mm),
    rows: (Array.isArray(c.rows) ? c.rows : []).map(normalizeDistrict).filter(Boolean),
  }));

// ---- saved runs (/api/history) ---------------------------------------------
export const normalizeHistoryResponse = (response) =>
  (Array.isArray(response?.data) ? response.data : Array.isArray(response?.history) ? response.history : [])
    .map(normalizeDistrict)
    .filter(Boolean);

// ---- verification ----------------------------------------------------------
// Backend stores { split, split_years, metrics: {raw_gfs_rmse, corrected_rmse, ...}, by_regime }
export function normalizeVerification(response) {
  const doc = response?.data ?? null;
  if (!doc || typeof doc !== "object") return null;
  const m = doc.metrics ?? doc;
  const pair = (key) => ({ raw: toNum(m[`raw_gfs_${key}`] ?? m[`raw_${key}`] ?? m[`${key}_raw`]), ai: toNum(m[`corrected_${key}`] ?? m[`${key}_corrected`] ?? m[key]) });

  const metrics = {
    rmse: pair("rmse"), mae: pair("mae"), csi: pair("csi"),
    pod: pair("pod"), far: pair("far"), ets: pair("ets"),
    fss: { raw: toNum(m.raw_gfs_fss ?? m.raw_fss), ai: toNum(m.corrected_fss ?? m.fss) },
  };
  const heavy = {
    accuracy: toNum(m.heavy_accuracy), precision: toNum(m.heavy_precision),
    recall: toNum(m.heavy_recall), f1: toNum(m.heavy_f1), roc_auc: toNum(m.heavy_roc_auc),
  };
  const byRegime = Object.entries(doc.by_regime ?? {}).map(([regime, v]) => ({
    regime, n: toNum(v.n),
    raw_rmse: toNum(v.raw_rmse), corrected_rmse: toNum(v.corrected_rmse),
    raw_mae: toNum(v.raw_mae), corrected_mae: toNum(v.corrected_mae),
    mean_bias_correction: toNum(v.mean_bias_correction),
  }));

  const hasAny = Object.values(metrics).some((p) => p.raw !== null || p.ai !== null);
  if (!hasAny && !byRegime.length) return null;

  return {
    split: doc.split ?? null,            // "test" | "validation" | null
    splitYears: Array.isArray(doc.split_years) ? doc.split_years : null,
    nSamples: toNum(doc.n_samples),
    createdAt: doc.created_at ?? null,
    metrics, heavy, byRegime,
  };
}

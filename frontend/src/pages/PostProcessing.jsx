import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from "recharts";
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowDown,
  FiArrowUp,
  FiCheckCircle,
  FiDownload,
  FiInfo,
  FiRefreshCw,
  FiTrendingUp,
  FiZap,
} from "react-icons/fi";

import {
  Panel,
  LoadingState,
  ErrorState,
  EmptyState,
  StatusBadge,
} from "../components/common/States";

import {
  getAvailableDates,
  getDistrictProducts,
  getMoEForecast,
  apiErrorMessage,
} from "../api/api";

import {
  fmt,
  fmtPct,
  fmtSigned,
  regimeColor,
} from "../api/normalize";

const tip = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 10,
  color: "#fff",
  fontSize: 12,
};

const REGIME_NAMES = [
  "Active Monsoon",
  "Break Monsoon",
  "Coastal",
  "Monsoon Low/Depression",
  "Orographic",
  "Dry/Weak Monsoon",
];

const DEFAULT_INPUT = {
  date: "2023-07-14",
  latitude: 25.3176,
  longitude: 82.9739,
  raw_nwp_rainfall: 42.5,
  u850: 8.2,
  v850: -4.6,
  vorticity_850: 0.00012,
  q500: 0.018,
  cape: 1250,
  olr: 185,
  olr_anomaly: -32,
  mslp_anomaly: -4.5,
  moisture_flux: 145,
  trough_latitude: 24.5,
  elevation: 80,
  slope: 1.8,
  dist_coast: 550,
};

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getDominantProbability(data) {
  if (!data) return 0;

  if (Number.isFinite(Number(data.regime_probability))) {
    return Number(data.regime_probability);
  }

  const probabilities = data.regime_probabilities ?? {};

  if (Array.isArray(probabilities)) {
    const values = probabilities
      .map((item) => Number(item?.probability ?? item?.value))
      .filter(Number.isFinite);

    return values.length ? Math.max(...values) : 0;
  }

  const values = Object.values(probabilities)
    .map(Number)
    .filter(Number.isFinite);

  return values.length ? Math.max(...values) : 0;
}

function normalizeRegimeProbabilities(data) {
  const probabilities = data?.regime_probabilities ?? {};

  if (Array.isArray(probabilities)) {
    return probabilities
      .map((item) => ({
        regime:
          item?.regime ??
          item?.regime_name ??
          item?.name ??
          "Unknown",
        value: toNumber(item?.probability ?? item?.value),
      }))
      .filter((item) => item.regime && Number.isFinite(item.value))
      .sort((a, b) => b.value - a.value);
  }

  return Object.entries(probabilities)
    .map(([regime, value]) => ({
      regime,
      value: toNumber(value),
    }))
    .filter((item) => Number.isFinite(item.value))
    .sort((a, b) => b.value - a.value);
}

function normalizeExperts(data) {
  const experts =
    data?.expert_predictions ??
    data?.experts ??
    data?.moe?.experts ??
    {};

  if (Array.isArray(experts)) {
    return experts
      .map((expert) => ({
        regime:
          expert?.regime ??
          expert?.regime_name ??
          expert?.name ??
          "Unknown",
        prediction: toNumber(
          expert?.prediction ??
            expert?.prediction_mm ??
            expert?.rainfall ??
            expert?.value
        ),
        gate_weight: toNumber(
          expert?.gate_weight ??
            expert?.probability ??
            expert?.weight
        ),
        shrinkage: expert?.shrinkage,
        effect_mm: expert?.effect_mm,
      }))
      .sort((a, b) => b.gate_weight - a.gate_weight);
  }

  const probabilities = data?.regime_probabilities ?? {};

  return Object.entries(experts)
    .map(([regime, value]) => {
      const probability = Array.isArray(probabilities)
        ? probabilities.find(
            (p) =>
              (p?.regime ?? p?.regime_name ?? p?.name) === regime
          )?.probability
        : probabilities?.[regime];

      return {
        regime,
        prediction: toNumber(
          typeof value === "object"
            ? value?.prediction ??
                value?.prediction_mm ??
                value?.rainfall ??
                value?.value
            : value
        ),
        gate_weight: toNumber(
          typeof value === "object"
            ? value?.gate_weight ??
                value?.probability ??
                value?.weight
            : probability
        ),
        shrinkage:
          typeof value === "object" ? value?.shrinkage : undefined,
        effect_mm:
          typeof value === "object" ? value?.effect_mm : undefined,
      };
    })
    .sort((a, b) => b.gate_weight - a.gate_weight);
}

function MetricCard({
  label,
  value,
  subtitle,
  icon,
  accent = "text-slate-200",
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {label}
          </p>

          <p className={`mt-2 text-2xl font-bold ${accent}`}>
            {value}
          </p>

          {subtitle && (
            <p className="mt-1 text-[11px] text-slate-500">
              {subtitle}
            </p>
          )}
        </div>

        {icon && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ eyebrow, title, description }) {
  return (
    <div>
      {eyebrow && (
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400">
          {eyebrow}
        </p>
      )}

      <h2 className="mt-1 text-lg font-bold text-slate-100 sm:text-xl">
        {title}
      </h2>

      {description && (
        <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
          {description}
        </p>
      )}
    </div>
  );
}

function PipelineStep({ number, title, description, active }) {
  return (
    <div
      className={`relative rounded-xl border p-4 transition ${
        active
          ? "border-cyan-500/40 bg-cyan-500/[0.06]"
          : "border-slate-800 bg-slate-950/50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
            active
              ? "bg-cyan-400 text-slate-950"
              : "bg-slate-800 text-slate-400"
          }`}
        >
          {number}
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-200">
            {title}
          </p>

          <p className="mt-1 text-[11px] leading-4 text-slate-500">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PostProcessing() {
  const [dates, setDates] = useState(null);
  const [date, setDate] = useState("");

  const [districts, setDistricts] = useState([]);
  const [districtId, setDistrictId] = useState("");

  const [input, setInput] = useState(DEFAULT_INPUT);

  const [result, setResult] = useState(null);

  const [loadingDates, setLoadingDates] = useState(true);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingForecast, setLoadingForecast] = useState(false);

  const [error, setError] = useState("");

  /*
   * Load available dates.
   */
  useEffect(() => {
    let mounted = true;

    getAvailableDates()
      .then((response) => {
        if (!mounted) return;

        setDates(response);

        const latest =
          response?.latest ??
          response?.dates?.[response?.dates?.length - 1]?.date ??
          "";

        setDate(latest);

        if (latest) {
          setInput((current) => ({
            ...current,
            date: latest,
          }));
        }
      })
      .catch((errorResponse) => {
        if (!mounted) return;

        setError(apiErrorMessage(errorResponse));
      })
      .finally(() => {
        if (mounted) {
          setLoadingDates(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  /*
   * Load districts for selected date.
   */
  useEffect(() => {
    if (!date) return;

    let mounted = true;

    setLoadingDistricts(true);

    getDistrictProducts({ date })
      .then((response) => {
        if (!mounted) return;

        const list = [...(response?.districts ?? [])].sort(
          (a, b) =>
            String(a?.district_name ?? "").localeCompare(
              String(b?.district_name ?? "")
            )
        );

        setDistricts(list);

        setDistrictId((current) => {
          if (
            current &&
            list.some(
              (district) =>
                district?.district_id === current
            )
          ) {
            return current;
          }

          return list[0]?.district_id ?? "";
        });
      })
      .catch((errorResponse) => {
        if (!mounted) return;

        setDistricts([]);
        setError(apiErrorMessage(errorResponse));
      })
      .finally(() => {
        if (mounted) {
          setLoadingDistricts(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [date]);

  /*
   * Keep input date synchronized with date selector.
   */
  useEffect(() => {
    if (date && input.date !== date) {
      setInput((current) => ({
        ...current,
        date,
      }));
    }
  }, [date, input.date]);

  /*
   * Selected district information.
   */
  const selectedDistrict = useMemo(
    () =>
      districts.find(
        (district) =>
          district?.district_id === districtId
      ),
    [districts, districtId]
  );

  /*
   * Update numeric forecast fields.
   */
  const updateField = useCallback((key, value) => {
    setInput((current) => ({
      ...current,
      [key]: value,
    }));
  }, []);

  /*
   * Build API payload.
   */
  const buildPayload = useCallback(() => {
    const u850 = toNumber(input.u850);
    const v850 = toNumber(input.v850);

    return {
      date: input.date || date,

      latitude: toNumber(input.latitude),
      longitude: toNumber(input.longitude),

      raw_nwp_rainfall: toNumber(
        input.raw_nwp_rainfall
      ),

      u850,
      v850,

      wind_speed: Math.hypot(u850, v850),
      wind_speed_850: Math.hypot(u850, v850),

      vorticity_850: toNumber(input.vorticity_850),
      q500: toNumber(input.q500),
      cape: toNumber(input.cape),
      olr: toNumber(input.olr),
      olr_anomaly: toNumber(input.olr_anomaly),
      mslp_anomaly: toNumber(input.mslp_anomaly),
      moisture_flux: toNumber(input.moisture_flux),
      trough_latitude: toNumber(
        input.trough_latitude
      ),

      elevation: toNumber(input.elevation),
      slope: toNumber(input.slope),
      dist_coast: toNumber(input.dist_coast),
    };
  }, [date, input]);

  /*
   * Run VARSHA-MoE.
   */
  const runForecast = useCallback(async () => {
    setLoadingForecast(true);
    setError("");

    try {
      const payload = buildPayload();

      const response = await getMoEForecast(payload);

      const data = response?.data ?? response;

      if (!data || typeof data !== "object") {
        throw new Error(
          "The post-processing API returned an invalid response."
        );
      }

      setResult(data);
    } catch (errorResponse) {
      setResult(null);
      setError(apiErrorMessage(errorResponse));
    } finally {
      setLoadingForecast(false);
    }
  }, [buildPayload]);

  /*
   * Automatically run when district/date changes.
   */
  useEffect(() => {
    if (!date || !districtId) return;

    runForecast();
  }, [date, districtId, runForecast]);

  /*
   * Normalize model result.
   */
  const model = useMemo(() => {
    if (!result) return null;

    const corrected =
      result?.corrected_rainfall_mm ??
      result?.moe?.corrected_rainfall_mm ??
      result?.corrected_rainfall ??
      result?.rainfall_mm;

    const raw =
      result?.raw_nwp_rainfall ??
      result?.moe?.raw_nwp_rainfall ??
      input.raw_nwp_rainfall;

    const global =
      result?.global_rainfall_mm ??
      result?.moe?.global_rainfall_mm ??
      corrected;

    const dominant =
      result?.dominant_regime ??
      result?.moe?.dominant_regime ??
      result?.regime ??
      normalizeRegimeProbabilities(result)[0]?.regime ??
      "Unknown";

    const probabilities =
      normalizeRegimeProbabilities(result);

    const dominantProbability =
      getDominantProbability(result);

    return {
      raw: toNumber(raw),
      global: toNumber(global),
      corrected: toNumber(corrected),
      dominant,
      dominantProbability,
      probabilities,
      experts: normalizeExperts(result),
    };
  }, [result, input.raw_nwp_rainfall]);

  /*
   * Correction metrics.
   */
  const correction = useMemo(() => {
    if (!model) {
      return {
        absolute: 0,
        percentage: 0,
        direction: "neutral",
      };
    }

    const absolute = model.corrected - model.raw;

    const percentage =
      Math.abs(model.raw) > 0
        ? (absolute / model.raw) * 100
        : 0;

    return {
      absolute,
      percentage,
      direction:
        absolute > 0.01
          ? "increase"
          : absolute < -0.01
          ? "decrease"
          : "neutral",
    };
  }, [model]);

  /*
   * Expert chart data.
   */
  const expertChart = useMemo(() => {
    if (!model) return [];

    return model.experts
      .filter((expert) =>
        REGIME_NAMES.includes(expert.regime)
          ? true
          : Boolean(expert.regime)
      )
      .map((expert) => ({
        regime: expert.regime,
        prediction: expert.prediction,
        gate: expert.gate_weight * 100,
      }));
  }, [model]);

  /*
   * Find top 2 regime drivers.
   */
  const topRegimes = useMemo(() => {
    if (!model) return [];

    return model.probabilities.slice(0, 2);
  }, [model]);

  /*
   * Generate human-readable explanation.
   */
  const explanation = useMemo(() => {
    if (!model) return null;

    const direction =
      correction.direction === "increase"
        ? "increased"
        : correction.direction === "decrease"
        ? "reduced"
        : "kept close to";

    const primary = topRegimes[0];

    const secondary = topRegimes[1];

    let text = `VARSHA-MoE ${direction} the rainfall estimate from ${fmt(
      model.raw,
      1,
      "mm"
    )} to ${fmt(model.corrected, 1, "mm")}.`;

    if (primary) {
      text += ` The strongest regime signal was ${primary.regime} (${fmtPct(
        primary.value,
        0
      )})`;
    }

    if (secondary) {
      text += `, followed by ${secondary.regime} (${fmtPct(
        secondary.value,
        0
      )})`;
    }

    text += ".";

    return text;
  }, [model, correction.direction, topRegimes]);

  /*
   * CSV export.
   */
  const exportCSV = useCallback(() => {
    if (!model) return;

    const rows = [
      [
        "date",
        "district_id",
        "district_name",
        "raw_nwp_rainfall_mm",
        "global_model_rainfall_mm",
        "moe_corrected_rainfall_mm",
        "adjustment_mm",
        "adjustment_percent",
        "dominant_regime",
        "dominant_probability",
      ],
      [
        input.date || date,
        districtId,
        selectedDistrict?.district_name ?? "",
        model.raw,
        model.global,
        model.corrected,
        correction.absolute,
        correction.percentage,
        model.dominant,
        model.dominantProbability,
      ],
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => {
            const stringValue = String(value ?? "");
            return `"${stringValue.replaceAll('"', '""')}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;

    const safeDistrict =
      selectedDistrict?.district_name
        ?.replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "") || "district";

    anchor.download = `varsha-moe-${safeDistrict}-${
      input.date || date || "forecast"
    }.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  }, [
    model,
    input.date,
    date,
    districtId,
    selectedDistrict,
    correction,
  ]);

  const dateMin =
    dates?.dates?.[0]?.date ??
    dates?.dates?.[0] ??
    undefined;

  const dateMax =
    dates?.latest ??
    dates?.dates?.[dates?.dates?.length - 1]?.date ??
    undefined;

  /*
   * Loading state.
   */
  if (loadingDates) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <LoadingState message="Loading post-processing data…" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      {/* =========================================================
          HEADER
      ========================================================= */}
      <section>
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
              Post-Processing
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
              VARSHA-MoE rainfall correction
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Transform a raw NWP rainfall forecast into a
              regime-aware corrected estimate using a soft-gated
              mixture of monsoon regime experts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="emerald">
              MoE pipeline
            </StatusBadge>

            <StatusBadge tone="cyan">
              Soft gating
            </StatusBadge>
          </div>
        </div>
      </section>

      {/* =========================================================
          CONTROLS
      ========================================================= */}
      <Panel
        title="Forecast controls"
        subtitle="Choose a dataset date and district, then run the post-processing pipeline."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-xs text-slate-400">
            Date

            <input
              type="date"
              value={date}
              min={dateMin}
              max={dateMax}
              onChange={(event) => {
                const nextDate =
                  event.target.value;

                setDate(nextDate);
                setInput((current) => ({
                  ...current,
                  date: nextDate,
                }));
                setResult(null);
              }}
              className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
            />
          </label>

          <label className="block text-xs text-slate-400">
            District

            <select
              value={districtId}
              disabled={loadingDistricts}
              onChange={(event) => {
                setDistrictId(event.target.value);
                setResult(null);
              }}
              className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {districts.length === 0 ? (
                <option value="">
                  No districts available
                </option>
              ) : (
                districts.map((district) => (
                  <option
                    key={district.district_id}
                    value={district.district_id}
                  >
                    {district.district_name}
                  </option>
                ))
              )}
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={runForecast}
              disabled={
                loadingForecast ||
                !date ||
                !districtId
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiRefreshCw
                className={
                  loadingForecast
                    ? "animate-spin"
                    : ""
                }
              />

              {loadingForecast
                ? "Processing…"
                : "Run post-processing"}
            </button>
          </div>
        </div>

        {selectedDistrict && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-4">
            <span className="text-[11px] text-slate-500">
              Selected district
            </span>

            <StatusBadge tone="slate">
              {selectedDistrict.district_name}
            </StatusBadge>

            {selectedDistrict.state_name && (
              <span className="text-[11px] text-slate-500">
                {selectedDistrict.state_name}
              </span>
            )}
          </div>
        )}
      </Panel>

      {/* =========================================================
          ERROR
      ========================================================= */}
      {error && (
        <ErrorState
          title="Post-processing unavailable"
          message={error}
          onRetry={runForecast}
        />
      )}

      {/* =========================================================
          LOADING
      ========================================================= */}
      {loadingForecast && !result && (
        <LoadingState message="Running regime gate and rainfall experts…" />
      )}

      {/* =========================================================
          EMPTY
      ========================================================= */}
      {!loadingForecast && !result && !error && (
        <EmptyState
          title="No post-processing result"
          message="Select a date and district to generate a VARSHA-MoE rainfall correction."
        />
      )}

      {model && (
        <>
          {/* =====================================================
              HERO RESULT
          ===================================================== */}
          <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.08] via-slate-950/80 to-slate-950 p-5 shadow-lg shadow-cyan-950/10">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone="cyan">
                    Final corrected forecast
                  </StatusBadge>

                  <StatusBadge tone="slate">
                    {model.dominant}
                  </StatusBadge>
                </div>

                <p className="mt-4 text-xs uppercase tracking-[0.16em] text-slate-500">
                  {selectedDistrict?.district_name ??
                    districtId}{" "}
                  · {input.date || date}
                </p>

                <div className="mt-2 flex flex-wrap items-baseline gap-3">
                  <span className="text-4xl font-black tracking-tight text-cyan-300 sm:text-5xl">
                    {fmt(
                      model.corrected,
                      1,
                      "mm"
                    )}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ${
                      correction.direction ===
                      "increase"
                        ? "bg-emerald-400/10 text-emerald-300"
                        : correction.direction ===
                          "decrease"
                        ? "bg-rose-400/10 text-rose-300"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {correction.direction ===
                      "increase" && <FiArrowUp />}

                    {correction.direction ===
                      "decrease" && <FiArrowDown />}

                    {fmtSigned(
                      correction.absolute,
                      1,
                      "mm"
                    )}
                  </span>
                </div>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  {explanation}
                </p>
              </div>

              <div className="min-w-[220px] rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <FiActivity />
                  Dominant regime
                </div>

                <p
                  className="mt-2 text-lg font-bold"
                  style={{
                    color: regimeColor(
                      model.dominant
                    ),
                  }}
                >
                  {model.dominant}
                </p>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          0,
                          model.dominantProbability *
                            100
                        )
                      )}%`,
                      backgroundColor:
                        regimeColor(
                          model.dominant
                        ),
                    }}
                  />
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  Gate weight{" "}
                  <span className="font-semibold text-slate-300">
                    {fmtPct(
                      model.dominantProbability,
                      1
                    )}
                  </span>
                </p>
              </div>
            </div>
          </section>

          {/* =====================================================
              METRIC CARDS
          ===================================================== */}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Raw NWP"
              value={fmt(model.raw, 1, "mm")}
              subtitle="Input forecast"
              icon={<FiActivity />}
            />

            <MetricCard
              label="Global model"
              value={fmt(model.global, 1, "mm")}
              subtitle="Base corrected estimate"
              icon={<FiTrendingUp />}
            />

            <MetricCard
              label="MoE corrected"
              value={fmt(
                model.corrected,
                1,
                "mm"
              )}
              subtitle="Final weighted output"
              accent="text-cyan-300"
              icon={<FiZap />}
            />

            <MetricCard
              label="Adjustment"
              value={fmtSigned(
                correction.absolute,
                1,
                "mm"
              )}
              subtitle={`${correction.percentage >= 0 ? "+" : ""}${correction.percentage.toFixed(
                1
              )}% from raw NWP`}
              accent={
                correction.direction ===
                "increase"
                  ? "text-emerald-300"
                  : correction.direction ===
                    "decrease"
                  ? "text-rose-300"
                  : "text-slate-300"
              }
              icon={
                correction.direction ===
                "increase" ? (
                  <FiArrowUp />
                ) : (
                  <FiArrowDown />
                )
              }
            />
          </section>

          {/* =====================================================
              RAW -> CORRECTED VISUAL
          ===================================================== */}
          <Panel
            title="Forecast transformation"
            subtitle="The post-processing chain moves from the raw NWP forecast to the global model and finally to the soft-gated MoE output."
          >
            <div className="grid gap-3 md:grid-cols-3">
              {[
                {
                  label: "Raw NWP",
                  value: model.raw,
                  description:
                    "Original numerical forecast",
                  icon: <FiActivity />,
                },
                {
                  label: "Global model",
                  value: model.global,
                  description:
                    "Base post-processed forecast",
                  icon: <FiTrendingUp />,
                },
                {
                  label: "VARSHA-MoE",
                  value: model.corrected,
                  description:
                    "Regime-aware final forecast",
                  icon: <FiZap />,
                },
              ].map((item, index) => (
                <div
                  key={item.label}
                  className="relative rounded-2xl border border-slate-800 bg-slate-950/60 p-5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {item.label}
                    </span>

                    <span className="text-slate-500">
                      {item.icon}
                    </span>
                  </div>

                  <p
                    className={`mt-4 text-3xl font-black ${
                      index === 2
                        ? "text-cyan-300"
                        : "text-slate-200"
                    }`}
                  >
                    {fmt(item.value, 1, "mm")}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {item.description}
                  </p>

                  {index < 2 && (
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-cyan-400/70"
                        style={{
                          width: `${Math.min(
                            100,
                            model.corrected > 0
                              ? (item.value /
                                  model.corrected) *
                                  100
                              : 0
                          )}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Panel>

          {/* =====================================================
              REGIME GATE + EXPERTS
          ===================================================== */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel
              title="Soft regime gate"
              subtitle="The gate assigns a probability to each monsoon regime. These probabilities determine how strongly each expert participates."
            >
              {model.probabilities.length ===
              0 ? (
                <EmptyState
                  title="Gate unavailable"
                  message="No regime probabilities were returned by the model."
                  className="min-h-[220px]"
                />
              ) : (
                <div
                  className="h-[340px]"
                  role="img"
                  aria-label="Monsoon regime probability distribution"
                >
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <BarChart
                      data={model.probabilities}
                      layout="vertical"
                      margin={{
                        left: 5,
                        right: 20,
                        top: 10,
                        bottom: 10,
                      }}
                    >
                      <CartesianGrid
                        stroke="#1e293b"
                        strokeDasharray="3 3"
                        horizontal={false}
                      />

                      <XAxis
                        type="number"
                        domain={[0, 1]}
                        stroke="#64748b"
                        fontSize={11}
                        tickFormatter={(value) =>
                          `${Math.round(
                            value * 100
                          )}%`
                        }
                      />

                      <YAxis
                        type="category"
                        dataKey="regime"
                        width={145}
                        stroke="#94a3b8"
                        fontSize={10}
                        tickLine={false}
                      />

                      <Tooltip
                        contentStyle={tip}
                        formatter={(value) =>
                          fmtPct(value, 1)
                        }
                        cursor={{
                          fill: "#1e293b55",
                        }}
                      />

                      <Bar
                        dataKey="value"
                        radius={[
                          0,
                          6,
                          6,
                          0,
                        ]}
                        isAnimationActive={false}
                      >
                        {model.probabilities.map(
                          (item) => (
                            <Cell
                              key={item.regime}
                              fill={regimeColor(
                                item.regime
                              )}
                            />
                          )
                        )}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>

            <Panel
              title="Regime expert predictions"
              subtitle="Each expert produces a rainfall estimate. The gate controls how much each prediction contributes to the final blend."
            >
              {expertChart.length === 0 ? (
                <EmptyState
                  title="Experts unavailable"
                  message="No expert predictions were returned by the MoE service."
                  className="min-h-[220px]"
                />
              ) : (
                <div
                  className="h-[340px]"
                  role="img"
                  aria-label="Expert rainfall predictions"
                >
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <BarChart
                      data={expertChart}
                      layout="vertical"
                      margin={{
                        left: 5,
                        right: 20,
                        top: 10,
                        bottom: 10,
                      }}
                    >
                      <CartesianGrid
                        stroke="#1e293b"
                        strokeDasharray="3 3"
                        horizontal={false}
                      />

                      <XAxis
                        type="number"
                        stroke="#64748b"
                        fontSize={11}
                        tickFormatter={(value) =>
                          `${value.toFixed(0)}`
                        }
                      />

                      <YAxis
                        type="category"
                        dataKey="regime"
                        width={145}
                        stroke="#94a3b8"
                        fontSize={10}
                        tickLine={false}
                      />

                      <Tooltip
                        contentStyle={tip}
                        cursor={{
                          fill: "#1e293b55",
                        }}
                        formatter={(
                          value,
                          name,
                          payload
                        ) => [
                          `${Number(value).toFixed(
                            2
                          )} mm · gate ${Number(
                            payload?.payload
                              ?.gate ?? 0
                          ).toFixed(1)}%`,
                          "Expert forecast",
                        ]}
                      />

                      <ReferenceLine
                        x={model.corrected}
                        stroke="#22d3ee"
                        strokeDasharray="5 5"
                      />

                      <Bar
                        dataKey="prediction"
                        radius={[
                          0,
                          6,
                          6,
                          0,
                        ]}
                        isAnimationActive={false}
                      >
                        {expertChart.map(
                          (item) => (
                            <Cell
                              key={item.regime}
                              fill={regimeColor(
                                item.regime
                              )}
                            />
                          )
                        )}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
          </div>

          {/* =====================================================
              EXPERT TABLE
          ===================================================== */}
          <Panel
            title="Expert weighting breakdown"
            subtitle="A high gate probability means the corresponding regime expert has greater influence on the final forecast."
          >
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-slate-900 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th
                      scope="col"
                      className="px-4 py-3"
                    >
                      Regime expert
                    </th>

                    <th
                      scope="col"
                      className="px-4 py-3"
                    >
                      Gate weight
                    </th>

                    <th
                      scope="col"
                      className="px-4 py-3"
                    >
                      Expert prediction
                    </th>

                    <th
                      scope="col"
                      className="px-4 py-3"
                    >
                      Shrinkage
                    </th>

                    <th
                      scope="col"
                      className="px-4 py-3"
                    >
                      Effect
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800">
                  {model.experts.map(
                    (expert) => (
                      <tr
                        key={expert.regime}
                        className="bg-slate-950 transition hover:bg-slate-900/70"
                      >
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{
                                backgroundColor:
                                  regimeColor(
                                    expert.regime
                                  ),
                              }}
                              aria-hidden="true"
                            />

                            <span className="font-medium text-slate-200">
                              {expert.regime}
                            </span>
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-800">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.max(
                                      0,
                                      expert.gate_weight *
                                        100
                                    )
                                  )}%`,
                                  backgroundColor:
                                    regimeColor(
                                      expert.regime
                                    ),
                                }}
                              />
                            </div>

                            <span className="text-slate-300">
                              {fmtPct(
                                expert.gate_weight,
                                1
                              )}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3 font-semibold text-slate-200">
                          {fmt(
                            expert.prediction,
                            2,
                            "mm"
                          )}
                        </td>

                        <td className="px-4 py-3 text-slate-400">
                          {expert.shrinkage !==
                          undefined &&
                          expert.shrinkage !==
                            null
                            ? fmt(
                                expert.shrinkage,
                                2
                              )
                            : "—"}
                        </td>

                        <td
                          className={`px-4 py-3 font-semibold ${
                            Number(
                              expert.effect_mm
                            ) > 0
                              ? "text-emerald-300"
                              : Number(
                                  expert.effect_mm
                                ) < 0
                              ? "text-rose-300"
                              : "text-slate-400"
                          }`}
                        >
                          {expert.effect_mm !==
                            undefined &&
                          expert.effect_mm !==
                            null
                            ? fmtSigned(
                                expert.effect_mm,
                                2,
                                "mm"
                              )
                            : "—"}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* =====================================================
              WHY DID IT CHANGE?
          ===================================================== */}
          <Panel
            title="Why did VARSHA change the forecast?"
            subtitle="A human-readable interpretation of the post-processing result."
          >
            <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-300">
                    <FiInfo />
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-200">
                      Model interpretation
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {explanation}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {topRegimes.map(
                    (regime, index) => (
                      <div
                        key={regime.regime}
                        className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] uppercase tracking-wider text-slate-500">
                            {index === 0
                              ? "Primary signal"
                              : "Secondary signal"}
                          </span>

                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{
                              backgroundColor:
                                regimeColor(
                                  regime.regime
                                ),
                            }}
                          />
                        </div>

                        <p
                          className="mt-2 text-sm font-semibold"
                          style={{
                            color: regimeColor(
                              regime.regime
                            ),
                          }}
                        >
                          {regime.regime}
                        </p>

                        <p className="mt-1 text-lg font-bold text-slate-200">
                          {fmtPct(
                            regime.value,
                            1
                          )}
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                <div className="flex items-center gap-2">
                  {correction.direction ===
                  "increase" ? (
                    <FiArrowUp className="text-emerald-300" />
                  ) : correction.direction ===
                    "decrease" ? (
                    <FiArrowDown className="text-rose-300" />
                  ) : (
                    <FiActivity className="text-slate-400" />
                  )}

                  <span className="text-sm font-semibold text-slate-200">
                    Correction summary
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">
                      Raw NWP
                    </p>

                    <p className="mt-1 text-xl font-bold text-slate-200">
                      {fmt(model.raw, 1, "mm")}
                    </p>
                  </div>

                  <div className="h-px bg-slate-800" />

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">
                      Final adjustment
                    </p>

                    <p
                      className={`mt-1 text-xl font-bold ${
                        correction.direction ===
                        "increase"
                          ? "text-emerald-300"
                          : correction.direction ===
                            "decrease"
                          ? "text-rose-300"
                          : "text-slate-300"
                      }`}
                    >
                      {fmtSigned(
                        correction.absolute,
                        1,
                        "mm"
                      )}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {correction.percentage >= 0
                        ? "+"
                        : ""}
                      {correction.percentage.toFixed(
                        1
                      )}
                      % relative to raw NWP
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          {/* =====================================================
              PIPELINE
          ===================================================== */}
          <Panel
            title="VARSHA-MoE processing pipeline"
            subtitle="How the forecast moves through the regime-aware post-processing system."
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <PipelineStep
                number="01"
                title="Raw NWP"
                description="Start with the numerical rainfall forecast."
                active
              />

              <PipelineStep
                number="02"
                title="Regime gate"
                description="Estimate probabilities for the monsoon regimes."
                active
              />

              <PipelineStep
                number="03"
                title="Regime experts"
                description="Generate regime-specific rainfall corrections."
                active
              />

              <PipelineStep
                number="04"
                title="Soft blend"
                description="Weight expert outputs using gate probabilities."
                active
              />

              <PipelineStep
                number="05"
                title="District product"
                description="Expose the corrected forecast for downstream use."
                active
              />
            </div>
          </Panel>

          {/* =====================================================
              INPUT SIGNALS
          ===================================================== */}
          <Panel
            title="Atmospheric and terrain inputs"
            subtitle="Inputs used for the selected post-processing run. These values can be adjusted for an interactive what-if demonstration."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [
                  "Raw NWP rainfall",
                  "raw_nwp_rainfall",
                  "mm",
                ],
                ["u850", "u850", "m/s"],
                ["v850", "v850", "m/s"],
                [
                  "Vorticity 850",
                  "vorticity_850",
                  "s⁻¹",
                ],
                ["q500", "q500", ""],
                ["CAPE", "cape", "J/kg"],
                ["OLR", "olr", "W/m²"],
                [
                  "OLR anomaly",
                  "olr_anomaly",
                  "W/m²",
                ],
                [
                  "MSLP anomaly",
                  "mslp_anomaly",
                  "hPa",
                ],
                [
                  "Moisture flux",
                  "moisture_flux",
                  "",
                ],
                [
                  "Trough latitude",
                  "trough_latitude",
                  "°N",
                ],
                [
                  "Elevation",
                  "elevation",
                  "m",
                ],
                ["Slope", "slope", ""],
                [
                  "Distance from coast",
                  "dist_coast",
                  "km",
                ],
              ].map(
                ([label, key, unit]) => (
                  <label
                    key={key}
                    className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"
                  >
                    <span className="block text-[10px] uppercase tracking-wider text-slate-500">
                      {label}
                    </span>

                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
                        step="any"
                        value={
                          input[key] ?? ""
                        }
                        onChange={(event) =>
                          updateField(
                            key,
                            event.target.value
                          )
                        }
                        className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-2 text-xs text-slate-200 outline-none focus:border-cyan-400"
                      />

                      {unit && (
                        <span className="shrink-0 text-[10px] text-slate-600">
                          {unit}
                        </span>
                      )}
                    </div>
                  </label>
                )
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
              <p className="text-[11px] leading-5 text-slate-600">
                What-if changes affect the next model run.
                They do not modify the underlying dataset.
              </p>

              <button
                type="button"
                onClick={runForecast}
                disabled={loadingForecast}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-400/50 hover:text-cyan-300 disabled:opacity-50"
              >
                <FiRefreshCw
                  className={
                    loadingForecast
                      ? "animate-spin"
                      : ""
                  }
                />

                Recalculate
              </button>
            </div>
          </Panel>

          {/* =====================================================
              UNCERTAINTY PLACEHOLDER
          ===================================================== */}
          <Panel
            title="Uncertainty module"
            subtitle="Prediction intervals should only be shown when a calibrated QRF/conformal uncertainty model is available."
          >
            <div className="flex flex-col gap-4 rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-5 sm:flex-row sm:items-center">
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-amber-300">
                <FiAlertTriangle />
              </div>

              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-200">
                  Calibrated uncertainty is not displayed
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  This interface intentionally avoids inventing a
                  confidence percentage or prediction interval.
                  QRF/conformal intervals can be added when the
                  corresponding calibrated backend model is available.
                </p>
              </div>

              <StatusBadge tone="amber">
                Extension
              </StatusBadge>
            </div>
          </Panel>

          {/* =====================================================
              EXPORT
          ===================================================== */}
          <section className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-5 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <FiCheckCircle className="text-emerald-300" />

                <h3 className="text-sm font-semibold text-slate-200">
                  District forecast product ready
                </h3>
              </div>

              <p className="mt-1 text-xs text-slate-500">
                Export the current raw forecast, MoE correction,
                dominant regime and gate probability.
              </p>
            </div>

            <button
              type="button"
              onClick={exportCSV}
              disabled={!model}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-cyan-400/50 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FiDownload />
              Export CSV
            </button>
          </section>
        </>
      )}
    </div>
  );
}
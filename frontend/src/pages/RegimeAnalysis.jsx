import { useCallback, useEffect, useMemo, useState } from "react";

import RegimeCard from "../components/RegimeCard";
import RegimeChart from "../components/RegimeChart";

import {
  Panel,
  ErrorState,
  LoadingState,
  StatusBadge,
} from "../components/common/States";

import { getDistricts, getMoEForecast } from "../api/api";

import {
  buildForecastPayload,
  DEFAULT_FORECAST_INPUT,
} from "../api/forecastPayload";

import {
  REGIME_INFO,
  REGIME_NAMES,
  regimeColor,
  fmt,
  fmtSigned,
} from "../api/normalize";

function apiErrorMessage(error) {
  return (
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    error?.message ||
    "Unable to load regime analysis."
  );
}

function Driver({ label, value, unit = "" }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-lg font-semibold text-slate-100">
        {value ?? "—"}

        {value !== null && value !== undefined && unit ? (
          <span className="ml-1 text-xs font-normal text-slate-500">
            {unit}
          </span>
        ) : null}
      </p>
    </div>
  );
}

function ProbabilityBar({ regime, probability, active }) {
  const numeric = Number(probability);

  if (!Number.isFinite(numeric)) return null;

  const pct =
    numeric <= 1
      ? Math.max(0, Math.min(100, numeric * 100))
      : Math.max(0, Math.min(100, numeric));

  return (
    <div
      className={`rounded-xl border p-3 transition ${
        active
          ? "border-cyan-400/40 bg-cyan-400/5"
          : "border-slate-800 bg-slate-950/50"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{
              background: regimeColor(regime),
            }}
            aria-hidden="true"
          />

          <span className="text-sm text-slate-200">{regime}</span>
        </div>

        <span className="text-sm font-semibold text-slate-300">
          {pct.toFixed(1)}%
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: regimeColor(regime),
          }}
        />
      </div>
    </div>
  );
}

function ArchitectureFlow({ regime }) {
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-212.5 items-center justify-center gap-3 py-3">
        <div className="rounded-xl border border-slate-700 bg-slate-950 px-5 py-4 text-center">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Input
          </p>

          <p className="mt-1 font-semibold text-slate-200">
            Atmospheric data
          </p>
        </div>

        <span className="text-xl text-cyan-400">→</span>

        <div className="rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-5 py-4 text-center">
          <p className="text-xs uppercase tracking-wider text-indigo-300">
            Classifier
          </p>

          <p className="mt-1 font-semibold text-slate-100">
            Regime detection
          </p>
        </div>

        <span className="text-xl text-cyan-400">→</span>

        <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-5 py-4 text-center">
          <p className="text-xs uppercase tracking-wider text-cyan-300">
            Soft gate
          </p>

          <p className="mt-1 font-semibold text-slate-100">
            {regime || "Regime probabilities"}
          </p>
        </div>

        <span className="text-xl text-cyan-400">→</span>

        <div className="rounded-xl border border-purple-400/30 bg-purple-500/10 px-5 py-4 text-center">
          <p className="text-xs uppercase tracking-wider text-purple-300">
            Experts
          </p>

          <p className="mt-1 font-semibold text-slate-100">
            Regime-specific correction
          </p>
        </div>

        <span className="text-xl text-cyan-400">→</span>

        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-4 text-center">
          <p className="text-xs uppercase tracking-wider text-emerald-300">
            Output
          </p>

          <p className="mt-1 font-semibold text-slate-100">
            Corrected rainfall
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegimeAnalysis() {
  const [demo, setDemo] = useState(null);
  const [demoLoading, setDemoLoading] = useState(true);
  const [demoError, setDemoError] = useState("");

  const [districts, setDistricts] = useState([]);
  const [distLoading, setDistLoading] = useState(true);
  const [distError, setDistError] = useState("");

  const [date, setDate] = useState(null);
  const [selectedRegime, setSelectedRegime] = useState(null);

  const loadDemo = useCallback(async () => {
    setDemoLoading(true);
    setDemoError("");

    try {
      const { payload } = buildForecastPayload(DEFAULT_FORECAST_INPUT);

      if (!payload) {
        throw new Error("Default forecast inputs are invalid.");
      }

      const result = await getMoEForecast(payload);

      console.log("MoE Forecast Result:", result);

      /*
       * Backend response:
       *
       * {
       *   success: true,
       *   model: "VARSHA-MoE",
       *   data: {
       *     corrected_rainfall_mm: 46.014,
       *     dominant_regime: "Active Monsoon",
       *     expert_predictions: {...},
       *     regime_probabilities: {...}
       *   }
       * }
       */

      const data = result?.data ?? result;

      if (!data) {
        throw new Error("Empty MoE response received.");
      }

      setDemo(data);

      setSelectedRegime(
        data?.dominant_regime ??
          data?.regime ??
          null
      );
    } catch (e) {
      console.error("MoE forecast error:", e);

      setDemo(null);
      setSelectedRegime(null);
      setDemoError(apiErrorMessage(e));
    } finally {
      setDemoLoading(false);
    }
  }, []);

  const loadDistricts = useCallback(async () => {
    setDistLoading(true);
    setDistError("");

    try {
      const r = await getDistricts({ limit: 200 });

      setDistricts(r?.districts ?? []);
      setDate(r?.date ?? null);
    } catch (e) {
      setDistricts([]);
      setDistError(apiErrorMessage(e));
    } finally {
      setDistLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDemo();
    loadDistricts();
  }, [loadDemo, loadDistricts]);

  /*
   * District statistics
   */
  const stats = useMemo(() => {
    const map = new Map();

    for (const d of districts) {
      if (!d?.regime) continue;

      const current =
        map.get(d.regime) ?? {
          n: 0,
          bias: 0,
          biasN: 0,
          raw: 0,
          corr: 0,
          rcN: 0,
        };

      current.n += 1;

      if (
        d.bias_correction !== null &&
        d.bias_correction !== undefined
      ) {
        current.bias += Number(d.bias_correction);
        current.biasN += 1;
      }

      if (
        d.raw_rainfall !== null &&
        d.raw_rainfall !== undefined &&
        d.corrected_rainfall !== null &&
        d.corrected_rainfall !== undefined
      ) {
        current.raw += Number(d.raw_rainfall);
        current.corr += Number(d.corrected_rainfall);
        current.rcN += 1;
      }

      map.set(d.regime, current);
    }

    return REGIME_NAMES.filter((regime) => map.has(regime)).map(
      (regime) => {
        const s = map.get(regime);

        return {
          regime,
          n: s.n,
          bias: s.biasN ? s.bias / s.biasN : null,
          raw: s.rcN ? s.raw / s.rcN : null,
          corr: s.rcN ? s.corr / s.rcN : null,
        };
      }
    );
  }, [districts]);

  /*
   * COMPLETE MoE regime probability vector.
   *
   * Backend:
   *
   * data.regime_probabilities = {
   *   "Active Monsoon": 0.55488,
   *   "Break Monsoon": 0.002057,
   *   "Coastal": 0.000716,
   *   ...
   * }
   */
  const regimeProbabilities = useMemo(() => {
    const source = demo?.regime_probabilities;

    if (!source) return [];

    let values = [];

    if (Array.isArray(source)) {
      values = source.map((item) => ({
        regime: item?.regime ?? item?.name,
        probability:
          item?.probability ?? item?.value,
      }));
    } else if (typeof source === "object") {
      values = Object.entries(source).map(
        ([regime, probability]) => ({
          regime,
          probability,
        })
      );
    }

    return values
      .filter(
        (item) =>
          item.regime &&
          Number.isFinite(Number(item.probability))
      )
      .filter((item) =>
        REGIME_NAMES.includes(item.regime)
      )
      .sort(
        (a, b) =>
          Number(b.probability) -
          Number(a.probability)
      );
  }, [demo]);

  /*
   * Expert predictions from the MoE backend.
   */
  const expertPredictions = useMemo(() => {
    const source = demo?.expert_predictions;

    if (!source || typeof source !== "object") {
      return [];
    }

    return Object.entries(source)
      .map(([regime, prediction]) => ({
        regime,
        prediction: Number(prediction),
      }))
      .filter(
        (item) =>
          item.regime &&
          Number.isFinite(item.prediction)
      )
      .sort(
        (a, b) => b.prediction - a.prediction
      );
  }, [demo]);

  const dominantRegime =
    demo?.dominant_regime ??
    demo?.regime ??
    null;

  const dominantProbability = useMemo(() => {
    if (!dominantRegime) return null;

    const found = regimeProbabilities.find(
      (item) => item.regime === dominantRegime
    );

    return found?.probability ?? null;
  }, [dominantRegime, regimeProbabilities]);

  const selectedInfo =
    selectedRegime && REGIME_INFO[selectedRegime]
      ? REGIME_INFO[selectedRegime]
      : null;

  const heldOutNote = date
    ? `District statistics: held-out test split, ${date}`
    : undefined;

  return (
    <div className="mx-auto max-w-350 space-y-5">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">
          Atmospheric classification
        </p>

        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
          Regime analysis
        </h1>

        <p className="mt-1 max-w-4xl text-sm text-slate-500">
          Explore the atmospheric regime detected by VARSHA-MoE and
          how regime-aware correction changes the rainfall forecast.
        </p>
      </div>

      {/* Errors */}
      {demoError && (
        <ErrorState
          title="Regime could not be classified"
          message={demoError}
          onRetry={loadDemo}
        />
      )}

      {/* Current regime + probability distribution */}
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <RegimeCard
          regime={dominantRegime}
          probability={dominantProbability}
          loading={demoLoading}
          note="Demo Forecast (default inputs) — not an observation."
        />

        <Panel
          title="Regime probability distribution"
          subtitle="Complete probability vector returned by VARSHA-MoE"
        >
          {demoLoading ? (
            <LoadingState message="Loading regime probabilities…" />
          ) : regimeProbabilities.length ? (
            <div className="space-y-2">
              {regimeProbabilities.map((item) => (
                <button
                  type="button"
                  key={item.regime}
                  onClick={() =>
                    setSelectedRegime(item.regime)
                  }
                  className="block w-full text-left"
                >
                  <ProbabilityBar
                    regime={item.regime}
                    probability={item.probability}
                    active={
                      selectedRegime === item.regime
                    }
                  />
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-sm text-slate-400">
                No complete regime probability vector was
                returned by the MoE endpoint.
              </p>
            </div>
          )}
        </Panel>
      </div>

      {/* MoE result summary */}
      {demo && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Dominant regime
            </p>

            <p className="mt-2 text-lg font-semibold text-white">
              {dominantRegime ?? "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Dominant probability
            </p>

            <p className="mt-2 text-lg font-semibold text-cyan-300">
              {dominantProbability !== null &&
              dominantProbability !== undefined
                ? `${
                    Number(dominantProbability) <= 1
                      ? (
                          Number(dominantProbability) *
                          100
                        ).toFixed(1)
                      : Number(
                          dominantProbability
                        ).toFixed(1)
                  }%`
                : "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              MoE corrected rainfall
            </p>

            <p className="mt-2 text-lg font-semibold text-emerald-300">
              {fmt(
                demo?.corrected_rainfall_mm,
                1,
                "mm"
              )}
            </p>
          </div>
        </div>
      )}

      {/* Selected regime information */}
      {selectedRegime && (
        <Panel
          title={`Selected regime · ${selectedRegime}`}
          subtitle="Regime definition and model interpretation"
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
            <div
              className="rounded-2xl border p-5"
              style={{
                borderColor: `${regimeColor(
                  selectedRegime
                )}66`,
                background: `${regimeColor(
                  selectedRegime
                )}0D`,
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-4 w-4 rounded-full"
                  style={{
                    background:
                      regimeColor(selectedRegime),
                  }}
                />

                <h3 className="font-semibold text-slate-100">
                  {selectedRegime}
                </h3>
              </div>

              {dominantRegime === selectedRegime && (
                <div className="mt-3">
                  <StatusBadge tone="cyan">
                    Current dominant regime
                  </StatusBadge>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
              <p className="text-sm leading-7 text-slate-400">
                {selectedInfo?.text ??
                  "No additional description is available for this regime."}
              </p>
            </div>
          </div>
        </Panel>
      )}

      {/* Expert predictions */}
      {expertPredictions.length > 0 && (
        <Panel
          title="Regime expert outputs"
          subtitle="Rainfall estimates produced by each regime-specific expert"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {expertPredictions.map(
              ({ regime, prediction }) => {
                const probability =
                  regimeProbabilities.find(
                    (item) =>
                      item.regime === regime
                  )?.probability;

                const pct =
                  probability !== undefined
                    ? Number(probability) <= 1
                      ? Number(probability) * 100
                      : Number(probability)
                    : null;

                return (
                  <button
                    type="button"
                    key={regime}
                    onClick={() =>
                      setSelectedRegime(regime)
                    }
                    className={`rounded-xl border p-4 text-left transition ${
                      selectedRegime === regime
                        ? "border-cyan-400/40 bg-cyan-400/5"
                        : "border-slate-800 bg-slate-950/50 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm text-slate-300">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            background:
                              regimeColor(regime),
                          }}
                        />

                        {regime}
                      </span>

                      {pct !== null && (
                        <span className="text-xs text-slate-500">
                          {pct.toFixed(1)}%
                        </span>
                      )}
                    </div>

                    <p className="mt-3 text-xl font-semibold text-white">
                      {prediction.toFixed(2)}
                      <span className="ml-1 text-xs font-normal text-slate-500">
                        mm
                      </span>
                    </p>
                  </button>
                );
              }
            )}
          </div>
        </Panel>
      )}

      {/* Atmospheric drivers */}
      <Panel
        title="Atmospheric drivers"
        subtitle="Inputs used by the forecast pipeline for the demo case"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Driver
            label="850 hPa wind"
            value={Math.hypot(
              Number(DEFAULT_FORECAST_INPUT.u850),
              Number(DEFAULT_FORECAST_INPUT.v850)
            ).toFixed(2)}
            unit="m/s"
          />

          <Driver
            label="Vorticity 850"
            value={
              DEFAULT_FORECAST_INPUT.vorticity_850
            }
            unit="s⁻¹"
          />

          <Driver
            label="q500"
            value={DEFAULT_FORECAST_INPUT.q500}
          />

          <Driver
            label="CAPE"
            value={DEFAULT_FORECAST_INPUT.cape}
            unit="J/kg"
          />

          <Driver
            label="OLR"
            value={DEFAULT_FORECAST_INPUT.olr}
            unit="W/m²"
          />

          <Driver
            label="OLR anomaly"
            value={
              DEFAULT_FORECAST_INPUT.olr_anomaly
            }
            unit="W/m²"
          />

          <Driver
            label="MSLP anomaly"
            value={
              DEFAULT_FORECAST_INPUT.mslp_anomaly
            }
            unit="hPa"
          />

          <Driver
            label="Moisture flux"
            value={
              DEFAULT_FORECAST_INPUT.moisture_flux
            }
          />

          <Driver
            label="Trough latitude"
            value={
              DEFAULT_FORECAST_INPUT.trough_latitude
            }
            unit="°N"
          />

          <Driver
            label="Elevation"
            value={
              DEFAULT_FORECAST_INPUT.elevation
            }
            unit="m"
          />

          <Driver
            label="Slope"
            value={DEFAULT_FORECAST_INPUT.slope}
          />

          <Driver
            label="Distance from coast"
            value={
              DEFAULT_FORECAST_INPUT.dist_coast
            }
            unit="km"
          />
        </div>
      </Panel>

      {/* Architecture */}
      <Panel
        title="How VARSHA-MoE uses the regime"
        subtitle="Regime-aware post-processing pipeline"
      >
        <ArchitectureFlow regime={dominantRegime} />

        <div className="mt-3 text-center text-xs text-slate-500">
          The soft-gating probabilities weight the outputs of
          the regime-specific rainfall correction experts.
        </div>
      </Panel>

      {/* Existing charts */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel
          title="Regime distribution"
          subtitle={
            heldOutNote ??
            "Districts per detected regime"
          }
        >
          {distLoading ? (
            <LoadingState message="Loading district regimes…" />
          ) : distError ? (
            <ErrorState
              title="District data unavailable"
              message={distError}
              onRetry={loadDistricts}
            />
          ) : (
            <RegimeChart
              data={stats.map((s) => ({
                regime: s.regime,
                value: s.n,
              }))}
              label="Districts"
            />
          )}
        </Panel>

        <Panel
          title="Mean bias correction by regime"
          subtitle="Average (AI corrected − raw NWP) across districts"
        >
          {distLoading ? (
            <LoadingState message="Loading…" />
          ) : distError ? (
            <ErrorState
              title="District data unavailable"
              message={distError}
            />
          ) : (
            <RegimeChart
              data={stats
                .filter(
                  (s) => s.bias !== null
                )
                .map((s) => ({
                  regime: s.regime,
                  value: s.bias,
                }))}
              unit=" mm"
              signed
              label="Mean correction"
            />
          )}
        </Panel>
      </div>

      {/* Comparison table */}
      <Panel
        title="Regime comparison"
        subtitle="Raw vs corrected rainfall averaged per regime"
      >
        {!stats.length ? (
          <p className="text-sm text-slate-500">
            No district regime data available.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full min-w-170 text-left text-sm">
              <thead className="bg-slate-900 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">
                    Regime
                  </th>

                  <th className="px-4 py-3">
                    Districts
                  </th>

                  <th className="px-4 py-3">
                    Mean raw
                  </th>

                  <th className="px-4 py-3">
                    Mean corrected
                  </th>

                  <th className="px-4 py-3">
                    Mean bias
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800">
                {stats.map((s) => (
                  <tr
                    key={s.regime}
                    className={`cursor-pointer bg-slate-950 transition hover:bg-slate-900 ${
                      selectedRegime === s.regime
                        ? "bg-cyan-400/5"
                        : ""
                    }`}
                    onClick={() =>
                      setSelectedRegime(s.regime)
                    }
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            background:
                              regimeColor(
                                s.regime
                              ),
                          }}
                        />

                        {s.regime}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {s.n}
                    </td>

                    <td className="px-4 py-3 text-slate-400">
                      {fmt(
                        s.raw,
                        1,
                        "mm"
                      )}
                    </td>

                    <td className="px-4 py-3 text-cyan-300">
                      {fmt(
                        s.corr,
                        1,
                        "mm"
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {fmtSigned(
                        s.bias,
                        1,
                        "mm"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Six regimes */}
      <div>
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">
            Regime library
          </p>

          <h2 className="mt-1 text-lg font-semibold">
            Atmospheric regime definitions
          </h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {REGIME_NAMES.map((name) => {
            const active =
              selectedRegime === name;

            return (
              <button
                type="button"
                key={name}
                onClick={() =>
                  setSelectedRegime(name)
                }
                className={`rounded-2xl border p-5 text-left transition ${
                  active
                    ? "border-cyan-400/40 bg-cyan-400/5"
                    : "border-slate-800 bg-slate-900/50 hover:border-slate-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{
                      background:
                        regimeColor(name),
                    }}
                  />

                  {dominantRegime === name && (
                    <StatusBadge tone="cyan">
                      Current dominant regime
                    </StatusBadge>
                  )}
                </div>

                <h3 className="mt-3 font-semibold">
                  {name}
                </h3>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {REGIME_INFO[name]?.text ??
                    "No description available."}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
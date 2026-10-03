import { memo, useEffect, useMemo, useState } from "react";

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
  useMap,
} from "react-leaflet";

import { FiSearch } from "react-icons/fi";

import "leaflet/dist/leaflet.css";

import MapLegend, { rainColor, rainRadius } from "./MapLegend";
import DistrictDetails from "./DistrictDetails";

import {
  LoadingState,
  ErrorState,
  EmptyState,
} from "./common/States";

import {
  REGIME_NAMES,
  fmt,
  fmtPct,
} from "../api/normalize";

/* =========================================================
   MAP CONFIGURATION
========================================================= */

const INDIA_CENTER = [22.8, 80.5];

const INDIA_BOUNDS = [
  [6, 66],
  [37.5, 98],
];

/*
 * MapTiler API key comes from frontend/.env
 *
 * VITE_MAPTILER_API_KEY=YOUR_KEY
 *
 * Vite exposes VITE_* variables through import.meta.env.
 */
const MAPTILER_API_KEY =
  import.meta.env.VITE_MAPTILER_API_KEY;

/*
 * MapTiler raster XYZ tiles.
 *
 * 256px tiles are used because they are directly compatible
 * with Leaflet's standard TileLayer.
 */
const MAPTILER_TILE_URL = MAPTILER_API_KEY
  ? `https://api.maptiler.com/maps/streets-v4/256/{z}/{x}/{y}.png?key=${MAPTILER_API_KEY}`
  : "";

/* =========================================================
   SELECTED DISTRICT CAMERA
========================================================= */

function FlyToSelected({ district }) {
  const map = useMap();

  useEffect(() => {
    if (
      district?.latitude != null &&
      district?.longitude != null
    ) {
      map.flyTo(
        [
          district.latitude,
          district.longitude,
        ],
        Math.max(map.getZoom(), 6),
        {
          duration: 0.6,
        }
      );
    }
  }, [district, map]);

  return null;
}

/* =========================================================
   DISTRICT MARKERS
========================================================= */

const Markers = memo(function Markers({
  items,
  selectedId,
  onSelect,
}) {
  return items.map((d) => (
    <CircleMarker
      key={d.id}
      center={[
        d.latitude,
        d.longitude,
      ]}
      radius={rainRadius(d.rainfall)}
      pathOptions={{
        color:
          d.id === selectedId
            ? "#ffffff"
            : rainColor(d.rainfall),

        fillColor: rainColor(d.rainfall),

        fillOpacity: 0.7,

        weight:
          d.id === selectedId
            ? 3
            : 1.5,
      }}
      eventHandlers={{
        click: () => onSelect(d.id),
      }}
    >
      <Tooltip
        direction="top"
        offset={[0, -4]}
      >
        <strong>
          {d.district_name}
        </strong>

        {d.state_name
          ? `, ${d.state_name}`
          : ""}

        <br />

        AI:{" "}
        {fmt(
          d.corrected_rainfall,
          1,
          "mm"
        )}

        {" · "}

        Raw:{" "}
        {fmt(
          d.raw_rainfall,
          1,
          "mm"
        )}

        <br />

        Heavy-rain prob.:{" "}
        {fmtPct(
          d.heavy_rain_probability
        )}
      </Tooltip>
    </CircleMarker>
  ));
});

/* =========================================================
   COMMON SELECT STYLE
========================================================= */

const selectCls =
  "rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400";

/* =========================================================
   MAIN MAP
========================================================= */

function RainfallMap({
  districts = [],
  loading = false,
  error = "",
  onRetry,
  selectedId,
  onSelect,
}) {
  const [search, setSearch] =
    useState("");

  const [regime, setRegime] =
    useState("");

  const [state, setState] =
    useState("");

  const [heavyOnly, setHeavyOnly] =
    useState(false);

  /* =======================================================
     STATES
  ======================================================= */

  const states = useMemo(
    () =>
      [
        ...new Set(
          districts
            .map(
              (d) => d.state_name
            )
            .filter(Boolean)
        ),
      ].sort(),
    [districts]
  );

  /* =======================================================
     FILTER DISTRICTS
  ======================================================= */

  const filtered = useMemo(() => {
    const q = search
      .trim()
      .toLowerCase();

    return districts.filter(
      (d) =>
        (
          !q ||
          d.district_name
            ?.toLowerCase()
            .includes(q) ||
          (
            d.state_name ?? ""
          )
            .toLowerCase()
            .includes(q)
        ) &&
        (
          !regime ||
          d.regime === regime
        ) &&
        (
          !state ||
          d.state_name === state
        ) &&
        (
          !heavyOnly ||
          d.heavy_rain === true
        )
    );
  }, [
    districts,
    search,
    regime,
    state,
    heavyOnly,
  ]);

  /* =======================================================
     ONLY VALID MAP POINTS
  ======================================================= */

  const plottable = useMemo(
    () =>
      filtered.filter(
        (d) =>
          d.latitude !== null &&
          d.latitude !== undefined &&
          d.longitude !== null &&
          d.longitude !== undefined
      ),
    [filtered]
  );

  /* =======================================================
     SELECTED DISTRICT
  ======================================================= */

  const selected = useMemo(
    () =>
      districts.find(
        (d) =>
          d.id === selectedId
      ) ?? null,
    [districts, selectedId]
  );

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <LoadingState
        message="Loading district forecasts…"
        className="h-[420px]"
      />
    );
  }

  /* =======================================================
     ERROR
  ======================================================= */

  if (error) {
    return (
      <ErrorState
        title="District data unavailable"
        message={error}
        onRetry={onRetry}
      />
    );
  }

  /* =======================================================
     EMPTY DATA
  ======================================================= */

  if (!districts.length) {
    return (
      <EmptyState
        title="No district forecast available"
        message="The API returned no district records."
        className="h-[320px]"
      />
    );
  }

  /* =======================================================
     MAP
  ======================================================= */

  return (
    <div className="space-y-3">

      {/* ===================================================
          FILTER BAR
      =================================================== */}

      <div className="flex flex-wrap items-center gap-2">

        {/* Search */}
        <label className="relative">
          <span className="sr-only">
            Search district
          </span>

          <FiSearch
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            aria-hidden="true"
          />

          <input
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="Search district or state"
            className={`${selectCls} w-56 pl-8`}
          />
        </label>

        {/* Regime */}
        <label>
          <span className="sr-only">
            Filter by regime
          </span>

          <select
            value={regime}
            onChange={(e) =>
              setRegime(
                e.target.value
              )
            }
            className={selectCls}
          >
            <option value="">
              All regimes
            </option>

            {REGIME_NAMES.map(
              (r) => (
                <option
                  key={r}
                  value={r}
                >
                  {r}
                </option>
              )
            )}
          </select>
        </label>

        {/* State */}
        {states.length > 0 && (
          <label>
            <span className="sr-only">
              Filter by state
            </span>

            <select
              value={state}
              onChange={(e) =>
                setState(
                  e.target.value
                )
              }
              className={selectCls}
            >
              <option value="">
                All states
              </option>

              {states.map(
                (s) => (
                  <option
                    key={s}
                    value={s}
                  >
                    {s}
                  </option>
                )
              )}
            </select>
          </label>
        )}

        {/* Heavy rainfall */}
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={heavyOnly}
            onChange={(e) =>
              setHeavyOnly(
                e.target.checked
              )
            }
            className="accent-cyan-400"
          />

          Heavy rain only
        </label>

        {/* Counter */}
        <span className="ml-auto text-xs text-slate-500">
          {filtered.length} of{" "}
          {districts.length} districts
        </span>
      </div>

      {/* ===================================================
          MAP + DETAILS
      =================================================== */}

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">

        {/* =================================================
            MAP
        ================================================= */}

        <div className="relative h-[380px] overflow-hidden rounded-2xl border border-slate-800 sm:h-[480px]">

          <MapContainer
            center={INDIA_CENTER}
            zoom={5}
            minZoom={4}
            maxBounds={INDIA_BOUNDS}
            scrollWheelZoom
            className="h-full w-full"
          >

            {/* =================================================
                MAPTILER BASEMAP
            ================================================= */}

            {MAPTILER_TILE_URL ? (
              <TileLayer
                url={MAPTILER_TILE_URL}
                tileSize={256}
                minZoom={1}
                maxZoom={20}
                attribution={
                  '&copy; MapTiler &copy; OpenStreetMap contributors'
                }
              />
            ) : (
              /*
               * Do not silently use another provider.
               * Show a clear console message if the key is missing.
               */
              <TileLayer
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
            )}

            {/* District markers */}
            <Markers
              items={plottable}
              selectedId={selectedId}
              onSelect={onSelect}
            />

            {/* Fly to selected district */}
            <FlyToSelected
              district={selected}
            />

          </MapContainer>

          {/* =================================================
              NO FILTER RESULTS
          ================================================= */}

          {!plottable.length && (
            <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center">
              <div className="rounded-xl border border-slate-700 bg-slate-950/90 px-5 py-4 text-sm text-slate-300">
                No districts match the current filters
              </div>
            </div>
          )}

        </div>

        {/* =================================================
            DISTRICT DETAILS
        ================================================= */}

        <div>
          {selected ? (
            <DistrictDetails
              district={selected}
              onClose={() =>
                onSelect(null)
              }
            />
          ) : (
            <EmptyState
              title="Select a district"
              message="Click a marker or a table row to see its raw, corrected and regime details."
              className="h-full min-h-[160px]"
            />
          )}
        </div>
      </div>

      {/* ===================================================
          LEGEND
      =================================================== */}

      <MapLegend />

    </div>
  );
}

/* =========================================================
   EXPORT
========================================================= */

export default memo(RainfallMap);
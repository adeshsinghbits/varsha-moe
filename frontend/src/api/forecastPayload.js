import { toNum } from "./normalize";

// Demo inputs for the default forecast. These are illustrative model inputs,
// NOT observations; the UI labels the result "Demo Forecast".
export const DEFAULT_FORECAST_INPUT = {
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

// Fields editable in the form. Every one is a field of the backend PredictRequest.
export const FORECAST_FIELDS = [
  { key: "raw_nwp_rainfall", label: "Raw NWP rainfall", unit: "mm", min: 0 },
  { key: "u850", label: "u850", unit: "m/s" },
  { key: "v850", label: "v850", unit: "m/s" },
  { key: "vorticity_850", label: "Vorticity 850", unit: "s⁻¹" },
  { key: "q500", label: "q500", unit: "" },
  { key: "cape", label: "CAPE", unit: "J/kg" },
  { key: "olr", label: "OLR", unit: "W/m²" },
  { key: "olr_anomaly", label: "OLR anomaly", unit: "W/m²" },
  { key: "mslp_anomaly", label: "MSLP anomaly", unit: "hPa" },
  { key: "moisture_flux", label: "Moisture flux", unit: "" },
  { key: "trough_latitude", label: "Trough latitude", unit: "°N" },
  { key: "elevation", label: "Elevation", unit: "m", min: 0 },
  { key: "slope", label: "Slope", unit: "", min: 0 },
  { key: "dist_coast", label: "Distance from coast", unit: "km", min: 0 },
];

// Same definitions as src/preprocessing/feature_engineering.py
export function timeFeatures(dateString) {
  const d = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((d.getTime() - start) / 86400000);
  const month = d.getUTCMonth() + 1;
  return {
    month,
    day_of_year: dayOfYear,
    sin_day: Math.sin((2 * Math.PI * dayOfYear) / 365.25),
    cos_day: Math.cos((2 * Math.PI * dayOfYear) / 365.25),
    is_monsoon: month >= 6 && month <= 9 ? 1 : 0,
  };
}

// Returns { payload } or { errors: {field: message} }
export function buildForecastPayload(input) {
  const errors = {};
  const num = (key, label) => {
    const n = toNum(input[key]);
    if (n === null) errors[key] = `${label} is required`;
    return n;
  };

  const latitude = num("latitude", "Latitude");
  const longitude = num("longitude", "Longitude");
  if (latitude !== null && (latitude < 6 || latitude > 38)) errors.latitude = "Latitude must be 6–38°N";
  if (longitude !== null && (longitude < 66 || longitude > 98)) errors.longitude = "Longitude must be 66–98°E";

  const time = timeFeatures(input.date);
  if (!time) errors.date = "Valid date required";

  const values = {};
  for (const f of FORECAST_FIELDS) {
    values[f.key] = num(f.key, f.label);
    if (values[f.key] !== null && f.min !== undefined && values[f.key] < f.min) errors[f.key] = `${f.label} cannot be below ${f.min}`;
  }

  if (Object.keys(errors).length) return { errors };

  const speed = Math.hypot(values.u850, values.v850);
  return {
    payload: {
      latitude, longitude, ...values,
      wind_speed: speed,          // derived from u850/v850
      wind_speed_850: speed,
      ...time,
    },
  };
}

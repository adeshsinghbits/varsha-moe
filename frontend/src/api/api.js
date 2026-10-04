import axios from "axios";

import {
  normalizeDistrictResponse,
  normalizeDistrictHistory,
  normalizeForecastResponse,
  normalizeHistoryResponse,
  normalizeVerification,
  normalizeProvenance,
  normalizeCaseReplays,
  normalizeDataStatus,
} from "./normalize";

export const API_ROOT =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api";

const SERVER_ROOT = API_ROOT.replace(/\/api\/?$/, "");

const API = axios.create({
  baseURL: API_ROOT,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

/* =========================================================
   ERROR HANDLING
========================================================= */

export const apiErrorMessage = (error) => {
  if (
    error?.code === "ERR_NETWORK" ||
    (!error?.response && error?.request)
  ) {
    return "ML API Offline";
  }

  const detail = error?.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return (
      detail
        .map((item) => item?.msg)
        .filter(Boolean)
        .join("; ") || "Invalid request"
    );
  }

  return (
    error?.response?.data?.message ||
    error?.message ||
    "Unable to reach the VARSHA-MoE backend."
  );
};

/* =========================================================
   HEALTH CHECK
========================================================= */

export async function checkHealth() {
  try {
    const { data } = await axios.get(`${SERVER_ROOT}/health`, {
      timeout: 8000,
    });

    const mlModels =
      data?.model_loaded === true ||
      data?.models_loaded === true ||
      data?.ml_models === true ||
      data?.services?.ml_models === true ||
      data?.models?.loaded === true;

    return {
      status: mlModels ? "online" : "degraded",
      mlModels,

      mongodb: true,

      raw: data,
    };
  } catch (error) {
    return {
      status: "offline",
      mlModels: false,
      mongodb: true,
      raw: null,
      error: apiErrorMessage(error),
    };
  }
}

/* =========================================================
   SINGLE-POINT ML PREDICTION
========================================================= */

export const predictForecast = async (payload) =>
  (await API.post("/predict", payload)).data;

export const predictRegime = async (payload) =>
  (await API.post("/regime", payload)).data;

export const correctRainfall = async (payload) =>
  (await API.post("/correction", payload)).data;

export const predictHeavyRain = async (payload) =>
  (await API.post("/heavy-rain", payload)).data;

/* =========================================================
   FORECAST
========================================================= */

export const getForecast = async (payload) =>
  normalizeForecastResponse(
    (await API.post("/forecast", payload)).data
  );

  export const getMoEForecast = async (payload) => {
  const response = await API.post("/moe-predict", payload);
  return response.data;
};

/* =========================================================
   DISTRICTS
========================================================= */

export const getDistricts = async ({
  state = "",
  date = "",
  limit = 100,
} = {}) =>
  normalizeDistrictResponse(
    (
      await API.get("/districts", {
        params: {
          ...(state ? { state } : {}),
          ...(date ? { date } : {}),
          limit,
        },
      })
    ).data
  );

/* =========================================================
   DISTRICT HISTORY
========================================================= */

export const getDistrictHistory = async (filters = {}) => {
  const params = Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) =>
        value !== "" &&
        value !== null &&
        value !== undefined
    )
  );

  return normalizeDistrictHistory(
    (await API.get("/district-history", { params })).data
  );
};

/* =========================================================
   FORECAST HISTORY
========================================================= */

export const getForecastById = async (id) =>
  (await API.get(`/history/${id}`)).data;

export const getHistory = async (limit = 50) =>
  normalizeHistoryResponse(
    (
      await API.get("/history", {
        params: {
          limit,
        },
      })
    ).data
  );

/* =========================================================
   DATABASE
========================================================= */

export const getDatabaseStatus = async () =>
  (await API.get("/database")).data;

/* =========================================================
   DATA STATUS
========================================================= */

export const getDataStatus = async () =>
  normalizeDataStatus(
    (await API.get("/data-status")).data
  );

/* =========================================================
   PROJECT PROVENANCE
========================================================= */

export const getProvenance = async () =>
  normalizeProvenance(
    (await API.get("/provenance")).data
  );

/* =========================================================
   CASE REPLAYS
========================================================= */

export const getCaseReplays = async () =>
  normalizeCaseReplays(
    (await API.get("/case-replays")).data
  );

/* =========================================================
   VERIFICATION
========================================================= */

export const getVerification = async () =>
  normalizeVerification(
    (await API.get("/verification")).data
  );

/* =========================================================
   DEFAULT AXIOS INSTANCE
========================================================= */

export default API;

/* =========================================================
   VARSHA-MoE EXTRAS (verification, polygons, explainer, bulletin)
========================================================= */

export const getAvailableDates = async () =>
  (await API.get("/available-dates")).data;

export const getDistrictProducts = async ({ date = "", state = "" } = {}) =>
  (
    await API.get("/district-products", {
      params: { ...(date ? { date } : {}), ...(state ? { state } : {}) },
    })
  ).data;

export const getDistrictExplain = async ({ districtId, date = "" }) =>
  (
    await API.get("/district-explain", {
      params: { district_id: districtId, ...(date ? { date } : {}) },
    })
  ).data;

export const getGeoDistricts = async () =>
  (await API.get("/geo/districts")).data;

export const getVerificationFull = async () =>
  (await API.get("/verification/full")).data;

export const getModelCard = async () =>
  (await API.get("/model-card")).data;

export const bulletinUrl = (date = "") =>
  `${API_ROOT}/bulletin.pdf${date ? `?date=${encodeURIComponent(date)}` : ""}`;

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any, Optional

import numpy as np
import pandas as pd

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from inference.predict import (
    InputValidationError,
    MonsoonPredictor,
)
from inference.moe_predict import predict_moe


# ============================================================
# APP CONFIGURATION
# ============================================================

APP_NAME = "VARSHA-MoE API"
APP_VERSION = "1.0.0"

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description=(
        "Regime-Aware AI Post-Processing of Monsoon Rainfall Forecasts"
    ),
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# PATHS
# ============================================================

CURRENT_FILE = Path(__file__).resolve()

# main.py
#   -> api
#   -> src
#   -> ml
ML_DIR = CURRENT_FILE.parents[2]

DISTRICT_DATASET = (
    ML_DIR
    / "data"
    / "raw"
    / "district_daily.parquet"
)

VERIFICATION_FILE = (
    ML_DIR
    / "data"
    / "verification_test.json"
)

CASE_REPLAYS_FILE = (
    ML_DIR
    / "data"
    / "raw"
    / "case_replays.json"
)


# ============================================================
# MODEL
# ============================================================

try:
    predictor = MonsoonPredictor()
    MODEL_LOAD_ERROR: Optional[str] = None
except Exception as exc:
    predictor = None
    MODEL_LOAD_ERROR = str(exc)


# ============================================================
# REQUEST MODELS
# ============================================================

class ForecastRequest(BaseModel):
    latitude: float = Field(..., ge=6, le=38)
    longitude: float = Field(..., ge=66, le=98)

    raw_nwp_rainfall: float = Field(..., ge=0)

    u850: float
    v850: float

    wind_speed: float
    wind_speed_850: float

    vorticity_850: float
    q500: float
    cape: float

    olr: float
    olr_anomaly: float
    mslp_anomaly: float

    moisture_flux: float
    trough_latitude: float

    elevation: float
    slope: float
    dist_coast: float

    month: float
    day_of_year: float

    sin_day: float
    cos_day: float
    is_monsoon: float


class PredictRequest(ForecastRequest):
    pass


class RegimeRequest(ForecastRequest):
    pass


class CorrectionRequest(ForecastRequest):
    predicted_regime: str


class HeavyRainRequest(ForecastRequest):
    corrected_rainfall: Optional[float] = None


# ============================================================
# HELPERS
# ============================================================

def _safe_float(value: Any) -> Optional[float]:
    """
    Convert a value to float safely.
    Returns None for None/NaN/invalid values.
    """
    try:
        if value is None or pd.isna(value):
            return None

        result = float(value)

        if not math.isfinite(result):
            return None

        return result

    except Exception:
        return None


def ensure_predictor() -> MonsoonPredictor:
    """
    Return loaded predictor or raise readable HTTP error.
    """
    if predictor is None:
        raise HTTPException(
            status_code=500,
            detail={
                "message": "ML models could not be loaded.",
                "error": MODEL_LOAD_ERROR,
            },
        )

    return predictor


def request_to_dict(
    request: BaseModel,
) -> dict[str, Any]:
    """
    Convert Pydantic request into normal dictionary.
    Supports Pydantic v1 and v2.
    """
    if hasattr(request, "model_dump"):
        return request.model_dump()

    return request.dict()


def safe_float(
    value: Any,
    field_name: str,
) -> float:
    """
    Convert dataset value to finite float.
    """
    if value is None or pd.isna(value):
        raise ValueError(
            f"{field_name} is NaN"
        )

    result = float(value)

    if not math.isfinite(result):
        raise ValueError(
            f"{field_name} is not finite"
        )

    return result


def dataset_numeric(
    row: pd.Series,
    column: str,
) -> float:
    """
    Read numeric column from district row.
    """
    if column not in row.index:
        raise KeyError(
            f"Dataset column '{column}' is missing"
        )

    return safe_float(
        row[column],
        column,
    )


def normalize_regime_name(value: Any) -> str:
    """
    Normalize regime names for consistent frontend display.
    """
    if value is None:
        return ""

    return (
        str(value)
        .strip()
        .replace("_", " ")
    )


def normalize_district_id(value: Any) -> str:
    """
    Normalize district IDs so query-string and parquet
    representations can be compared safely.
    """
    if value is None:
        return ""

    if isinstance(value, float) and value.is_integer():
        return str(int(value))

    return str(value).strip()


def get_regime_from_row(row: pd.Series) -> str:
    """
    Return the dataset regime name.
    """
    if "regime_name" in row.index:
        value = row.get("regime_name")

        if value is not None and not pd.isna(value):
            return normalize_regime_name(value)

    if "regime" in row.index:
        return normalize_regime_name(
            row.get("regime")
        )

    return ""


# ============================================================
# DATASET LOADER
# ============================================================

def load_district_dataset() -> pd.DataFrame:
    """
    Load district_daily.parquet.
    """
    if not DISTRICT_DATASET.exists():
        raise FileNotFoundError(
            "district_daily.parquet not found at: "
            f"{DISTRICT_DATASET}"
        )

    df = pd.read_parquet(
        DISTRICT_DATASET
    )

    if df.empty:
        raise ValueError(
            "district_daily.parquet is empty"
        )

    return df


# ============================================================
# DISTRICT -> MODEL FEATURE BUILDER
# ============================================================

def build_district_payload(
    row: pd.Series,
) -> dict[str, float]:
    """
    Convert one district_daily.parquet row into the
    exact feature contract expected by MonsoonPredictor.

    wind_speed is derived from u850/v850.
    """

    # --------------------------------------------------------
    # DATE
    # --------------------------------------------------------

    if "date" not in row.index:
        raise KeyError(
            "Dataset column 'date' is missing"
        )

    date = pd.to_datetime(
        row["date"],
        errors="coerce",
    )

    if pd.isna(date):
        raise ValueError(
            f"Invalid date value: {row['date']}"
        )

    month = int(date.month)

    day_of_year = int(
        date.dayofyear
    )

    # --------------------------------------------------------
    # CYCLIC DATE FEATURES
    # --------------------------------------------------------

    sin_day = math.sin(
        2.0
        * math.pi
        * day_of_year
        / 365.25
    )

    cos_day = math.cos(
        2.0
        * math.pi
        * day_of_year
        / 365.25
    )

    is_monsoon = (
        1.0
        if month in (6, 7, 8, 9)
        else 0.0
    )

    # --------------------------------------------------------
    # WIND
    # --------------------------------------------------------

    u850 = dataset_numeric(
        row,
        "u850",
    )

    v850 = dataset_numeric(
        row,
        "v850",
    )

    wind_speed = math.hypot(
        u850,
        v850,
    )

    wind_speed_850 = dataset_numeric(
        row,
        "wind_speed_850",
    )

    # --------------------------------------------------------
    # MODEL INPUT
    # --------------------------------------------------------

    payload: dict[str, float] = {

        # Location
        "latitude": dataset_numeric(
            row,
            "latitude",
        ),

        "longitude": dataset_numeric(
            row,
            "longitude",
        ),

        # NWP rainfall
        "raw_nwp_rainfall": dataset_numeric(
            row,
            "raw_nwp_d1",
        ),

        # Wind
        "u850": u850,
        "v850": v850,
        "wind_speed": wind_speed,
        "wind_speed_850": wind_speed_850,

        # Atmospheric variables
        "vorticity_850": dataset_numeric(
            row,
            "vorticity_850",
        ),

        "q500": dataset_numeric(
            row,
            "q500",
        ),

        "cape": dataset_numeric(
            row,
            "cape",
        ),

        "olr": dataset_numeric(
            row,
            "olr",
        ),

        "olr_anomaly": dataset_numeric(
            row,
            "olr_anomaly",
        ),

        "mslp_anomaly": dataset_numeric(
            row,
            "mslp_anomaly",
        ),

        "moisture_flux": dataset_numeric(
            row,
            "moisture_flux",
        ),

        "trough_latitude": dataset_numeric(
            row,
            "trough_latitude",
        ),

        # Geography
        "elevation": dataset_numeric(
            row,
            "elevation",
        ),

        "slope": dataset_numeric(
            row,
            "slope",
        ),

        "dist_coast": dataset_numeric(
            row,
            "dist_coast",
        ),

        # Temporal
        "month": float(month),

        "day_of_year": float(
            day_of_year
        ),

        "sin_day": float(
            sin_day
        ),

        "cos_day": float(
            cos_day
        ),

        "is_monsoon": float(
            is_monsoon
        ),
    }

    return payload


# ============================================================
# DISTRICT FORECAST
# ============================================================

def build_district_forecast(
    row: pd.Series,
) -> dict[str, Any]:
    """
    Run complete ML inference for one district.
    """

    model = ensure_predictor()

    payload = build_district_payload(
        row
    )

    result = model.predict(
        payload
    )

    district_name = str(
        row.get(
            "district_name",
            "Unknown",
        )
    )

    state_name = str(
        row.get(
            "state_name",
            "Unknown",
        )
    )

    observed = (
        float(row["obs_rain_mean"])
        if (
            "obs_rain_mean" in row.index
            and pd.notna(
                row["obs_rain_mean"]
            )
        )
        else None
    )

    observed_max = (
        float(row["obs_rain_max"])
        if (
            "obs_rain_max" in row.index
            and pd.notna(
                row["obs_rain_max"]
            )
        )
        else None
    )

    return {
        "district_name": district_name,
        "state_name": state_name,

        "date": (
            pd.to_datetime(
                row["date"]
            ).strftime("%Y-%m-%d")
            if "date" in row.index
            else None
        ),

        "latitude": payload[
            "latitude"
        ],

        "longitude": payload[
            "longitude"
        ],

        "raw_rainfall_mm": float(
            result["raw_nwp_rainfall"]
        ),

        "corrected_rainfall_mm": float(
            result["corrected_rainfall"]
        ),

        "bias_correction_mm": float(
            result["bias_correction"]
        ),

        "observed_rainfall_mm": observed,

        "observed_max_rainfall_mm": (
            observed_max
        ),

        "regime": str(
            result["predicted_regime"]
        ),

        "regime_probability": float(
            result["regime_probability"]
        ),

        "heavy_rain": bool(
            result["heavy_rain"]
        ),

        "heavy_rain_probability": float(
            result["heavy_rain_probability"]
        ),
    }


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():
    return {
        "name": APP_NAME,
        "version": APP_VERSION,
        "status": "running",
        "docs": "/docs",
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():
    return {
        "status": (
            "ok"
            if predictor is not None
            else "model_error"
        ),

        "model_loaded": (
            predictor is not None
        ),

        "model_error": MODEL_LOAD_ERROR,

        "dataset_exists": (
            DISTRICT_DATASET.exists()
        ),

        "dataset_path": str(
            DISTRICT_DATASET
        ),
    }


# ============================================================
# AVAILABLE DATES
# ============================================================

@app.get("/api/available-dates")
def available_dates():
    try:
        df = load_district_dataset()

        if "date" not in df.columns:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Dataset does not contain "
                    "a date column."
                ),
            )

        dates = (
            pd.to_datetime(
                df["date"],
                errors="coerce",
            )
            .dropna()
            .dt.strftime("%Y-%m-%d")
            .drop_duplicates()
            .sort_values()
            .tolist()
        )

        return {
            "success": True,

            "dates": [
                {"date": d}
                for d in dates
            ],

            "latest": (
                dates[-1]
                if dates
                else None
            ),

            "earliest": (
                dates[0]
                if dates
                else None
            ),

            "count": len(dates),
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to load available dates: "
                f"{exc}"
            ),
        )


# ============================================================
# DISTRICT PRODUCTS
# ============================================================

@app.get("/api/district-products")
def district_products(
    date: str,
):
    """
    Return all district-level products for a selected date.

    Used by the MoE Explainability page.
    """

    try:
        df = load_district_dataset()

        if "date" not in df.columns:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Dataset does not contain date."
                ),
            )

        df["date"] = pd.to_datetime(
            df["date"],
            errors="coerce",
        )

        target_date = pd.to_datetime(
            date,
            errors="coerce",
        )

        if pd.isna(target_date):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid date. "
                    "Use YYYY-MM-DD."
                ),
            )

        target_date = target_date.normalize()

        day = df[
            df["date"].dt.normalize()
            == target_date
        ].copy()

        if day.empty:
            return {
                "success": True,
                "date": target_date.strftime(
                    "%Y-%m-%d"
                ),
                "count": 0,
                "districts": [],
            }

        districts: list[
            dict[str, Any]
        ] = []

        for _, row in day.iterrows():

            districts.append(
                {
                    "district_id": normalize_district_id(
                        row.get(
                            "district_id",
                            "",
                        )
                    ),

                    "district_name": str(
                        row.get(
                            "district_name",
                            "",
                        )
                    ),

                    "state_name": str(
                        row.get(
                            "state_name",
                            "",
                        )
                    ),

                    "regime": get_regime_from_row(
                        row
                    ),

                    "raw_nwp_rainfall": (
                        _safe_float(
                            row.get(
                                "raw_nwp_d1"
                            )
                        )
                    ),

                    "observed_rainfall_mm": (
                        _safe_float(
                            row.get(
                                "obs_rain_mean"
                            )
                        )
                    ),

                    "latitude": _safe_float(
                        row.get(
                            "latitude"
                        )
                    ),

                    "longitude": _safe_float(
                        row.get(
                            "longitude"
                        )
                    ),
                }
            )

        return {
            "success": True,
            "date": target_date.strftime(
                "%Y-%m-%d"
            ),
            "count": len(districts),
            "districts": districts,
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to load district products: "
                f"{exc}"
            ),
        )


# ============================================================
# DISTRICT EXPLAIN
# ============================================================
@app.get("/api/district-explain")
def district_explain(
    district_id: str = Query(
        ...,
        description="District ID",
    ),
    date: str = Query(
        ...,
        description="Date YYYY-MM-DD",
    ),
):
    """
    Explain the VARSHA-MoE prediction for one district/date.

    This endpoint uses the real dataset row and the existing
    predict_moe() inference pipeline.

    SHAP values are only returned when a compatible SHAP
    implementation is actually available. No fake values
    are generated.
    """

    try:

        # ----------------------------------------------------
        # Load dataset
        # ----------------------------------------------------

        df = load_district_dataset()

        required = {
            "date",
            "district_id",
            "district_name",
            "state_name",
            "raw_nwp_d1",
        }

        missing = sorted(
            required - set(df.columns)
        )

        if missing:
            raise HTTPException(
                status_code=500,
                detail={
                    "message": (
                        "Dataset is missing "
                        "required columns."
                    ),
                    "missing_columns": missing,
                },
            )

        # ----------------------------------------------------
        # Parse date
        # ----------------------------------------------------

        target_date = pd.to_datetime(
            date,
            errors="coerce",
        )

        if pd.isna(target_date):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid date. "
                    "Use YYYY-MM-DD."
                ),
            )

        target_date = target_date.normalize()

        # ----------------------------------------------------
        # Normalize district IDs
        # ----------------------------------------------------

        normalized_id = (
            df["district_id"]
            .map(normalize_district_id)
        )

        normalized_date = (
            pd.to_datetime(
                df["date"],
                errors="coerce",
            )
            .dt
            .normalize()
        )

        match = df[
            (normalized_id == str(district_id).strip())
            & (normalized_date == target_date)
        ].copy()

        # ----------------------------------------------------
        # If no exact ID match, try district name
        # ----------------------------------------------------

        if match.empty and "district_name" in df.columns:

            name_match = df[
                df["district_name"]
                .astype(str)
                .str.strip()
                .str.lower()
                == str(district_id)
                .strip()
                .lower()
            ]

            name_match = name_match[
                pd.to_datetime(
                    name_match["date"],
                    errors="coerce",
                )
                .dt
                .normalize()
                == target_date
            ]

            match = name_match.copy()

        if match.empty:
            raise HTTPException(
                status_code=404,
                detail={
                    "message": (
                        "No district record found "
                        "for the requested date."
                    ),
                    "districtId": district_id,
                    "date": target_date.strftime(
                        "%Y-%m-%d"
                    ),
                },
            )

        row = match.iloc[0]

        # ----------------------------------------------------
        # Build actual model payload
        # ----------------------------------------------------

        payload = build_district_payload(
            row
        )

        # ----------------------------------------------------
        # Run actual VARSHA-MoE
        # ----------------------------------------------------

        moe_result = predict_moe(
            payload
        )

        if not isinstance(
            moe_result,
            dict,
        ):
            raise ValueError(
                "predict_moe() did not return "
                "a dictionary."
            )

        # ----------------------------------------------------
        # Gate probabilities
        # ----------------------------------------------------

        regime_probabilities = (
            moe_result.get(
                "regime_probabilities",
                {},
            )
        )

        if not isinstance(
            regime_probabilities,
            dict,
        ):
            regime_probabilities = {}

        clean_probabilities = {}

        for regime, probability in (
            regime_probabilities.items()
        ):
            value = _safe_float(
                probability
            )

            if value is not None:
                clean_probabilities[
                    normalize_regime_name(
                        regime
                    )
                ] = value

        # ----------------------------------------------------
        # Expert predictions
        # ----------------------------------------------------

        expert_predictions = (
            moe_result.get(
                "expert_predictions",
                {},
            )
        )

        if not isinstance(
            expert_predictions,
            dict,
        ):
            expert_predictions = {}

        experts = {}

        for regime, prediction in (
            expert_predictions.items()
        ):

            regime_name = normalize_regime_name(
                regime
            )

            prediction_value = _safe_float(
                prediction
            )

            gate_weight = clean_probabilities.get(
                regime_name
            )

            effect = None

            if (
                prediction_value is not None
                and gate_weight is not None
            ):
                # This is the mathematically attributable
                # weighted expert component.
                effect = (
                    prediction_value
                    * gate_weight
                )

            experts[regime_name] = {
                "prediction_mm": (
                    prediction_value
                ),

                "gate_weight": (
                    gate_weight
                ),

                "effect_mm": effect,
            }

        # ----------------------------------------------------
        # Dominant regime
        # ----------------------------------------------------

        dominant_regime = moe_result.get(
            "dominant_regime"
        )

        if dominant_regime is None:
            dominant_regime = (
                max(
                    clean_probabilities,
                    key=lambda regime_name: clean_probabilities.get(
                        regime_name,
                        0.0,
                    ),
                )
                if clean_probabilities
                else None
            )

        dominant_probability = None

        if dominant_regime is not None:
            dominant_probability = (
                clean_probabilities.get(
                    normalize_regime_name(
                        dominant_regime
                    )
                )
            )

        # ----------------------------------------------------
        # Raw / corrected rainfall
        # ----------------------------------------------------

        raw_rainfall = _safe_float(
            row.get(
                "raw_nwp_d1"
            )
        )

        corrected_rainfall = _safe_float(
            moe_result.get(
                "corrected_rainfall_mm"
            )
        )

        if corrected_rainfall is None:
            corrected_rainfall = _safe_float(
                moe_result.get(
                    "corrected_rainfall"
                )
            )

        # ----------------------------------------------------
        # Observed rainfall
        # ----------------------------------------------------

        observed_rainfall = _safe_float(
            row.get(
                "obs_rain_mean"
            )
        )

        observed_max_rainfall = _safe_float(
            row.get(
                "obs_rain_max"
            )
        )

        # ----------------------------------------------------
        # Global model placeholder
        #
        # Do NOT invent a global prediction.
        # ----------------------------------------------------

        global_rainfall = None

        # Existing predictor may expose a global model
        # prediction in the future. We only use it if the
        # object actually provides one.

        if predictor is not None:

            try:

                if hasattr(
                    predictor,
                    "predict_corrected_rainfall",
                ):
                    predicted_regime = (
                        str(
                            dominant_regime
                        )
                        if dominant_regime
                        else ""
                    )

                    global_candidate = (
                        predictor.predict_corrected_rainfall(
                            payload,
                            predicted_regime,
                        )
                    )

                    global_candidate = _safe_float(
                        global_candidate
                    )

                    if global_candidate is not None:
                        global_rainfall = (
                            global_candidate
                        )

            except Exception:
                global_rainfall = None

        # ----------------------------------------------------
        # Split
        # ----------------------------------------------------

        year = int(
            pd.to_datetime(
                row["date"]
            ).year
        )

        if year == 2023:
            split = "test"
        elif year >= 2021:
            split = "validation"
        else:
            split = "train"

        # ----------------------------------------------------
        # SHAP
        # ----------------------------------------------------
        #
        # We intentionally do not generate fake SHAP values.
        #

        shap_result = {
            "available": False,
            "features": [],
            "base_value": None,
            "message": (
                "SHAP values are not exposed by the "
                "current inference model."
            ),
        }

        # ----------------------------------------------------
        # Expert adjustment
        # ----------------------------------------------------

        expert_adjustment = None

        if (
            raw_rainfall is not None
            and corrected_rainfall is not None
        ):
            expert_adjustment = (
                corrected_rainfall
                - raw_rainfall
            )

        # ----------------------------------------------------
        # Response
        # ----------------------------------------------------

        return {
            "success": True,

            "district": {
                "district_id": normalize_district_id(
                    row.get(
                        "district_id"
                    )
                ),

                "district_name": str(
                    row.get(
                        "district_name",
                        "",
                    )
                ),

                "state_name": str(
                    row.get(
                        "state_name",
                        "",
                    )
                ),

                "latitude": _safe_float(
                    row.get(
                        "latitude"
                    )
                ),

                "longitude": _safe_float(
                    row.get(
                        "longitude"
                    )
                ),

                "date": target_date.strftime(
                    "%Y-%m-%d"
                ),
            },

            "split": split,

            "moe": {
                "corrected_rainfall_mm": (
                    corrected_rainfall
                ),

                "dominant_regime": (
                    dominant_regime
                ),

                "dominant_probability": (
                    dominant_probability
                ),

                "regime_probabilities": (
                    clean_probabilities
                ),

                "experts": experts,

                "expert_adjustment_mm": (
                    expert_adjustment
                ),
            },

            "rainfall": {
                "raw_nwp_rainfall_mm": (
                    raw_rainfall
                ),

                "global_rainfall_mm": (
                    global_rainfall
                ),

                "corrected_rainfall_mm": (
                    corrected_rainfall
                ),

                "observed_rainfall_mm": (
                    observed_rainfall
                ),

                "observed_max_rainfall_mm": (
                    observed_max_rainfall
                ),

                "bias_correction_mm": (
                    (
                        corrected_rainfall
                        - raw_rainfall
                    )
                    if (
                        corrected_rainfall is not None
                        and raw_rainfall is not None
                    )
                    else None
                ),
            },

            "shap": shap_result,

            "input": payload,

            "model": {
                "name": "VARSHA-MoE",
                "version": APP_VERSION,
                "source": (
                    "district_daily.parquet"
                ),
            },
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "message": (
                    "Failed to generate "
                    "district explanation."
                ),
                "error": str(exc),
            },
        )


# ============================================================
# VARSHA-MoE PREDICTION
# ============================================================

@app.post("/api/moe-predict")
def moe_predict_endpoint(
    payload: dict,
):
    """
    VARSHA-MoE prototype endpoint.

    Delegates inference to predict_moe().
    """

    try:

        result = predict_moe(
            payload
        )

        return {
            "success": True,
            "model": "VARSHA-MoE",
            "data": result,
        }

    except Exception as exc:

        return {
            "success": False,
            "model": "VARSHA-MoE",
            "message": str(exc),
        }


# ============================================================
# GENERIC PREDICTION
# ============================================================

@app.post("/api/predict")
def predict(
    request: PredictRequest,
):
    model = ensure_predictor()

    try:

        data = request_to_dict(
            request
        )

        return {
            "success": True,
            "prediction": model.predict(
                data
            ),
        }

    except InputValidationError as exc:

        raise HTTPException(
            status_code=422,
            detail=str(exc),
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


# ============================================================
# REGIME
# ============================================================

@app.post("/api/regime")
def regime(
    request: RegimeRequest,
):
    model = ensure_predictor()

    try:

        data = request_to_dict(
            request
        )

        name, probability = (
            model.predict_regime_with_probability(
                data
            )
        )

        return {
            "success": True,
            "regime": name,
            "probability": probability,
        }

    except InputValidationError as exc:

        raise HTTPException(
            status_code=422,
            detail=str(exc),
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


# ============================================================
# RAINFALL CORRECTION
# ============================================================

@app.post("/api/correction")
def correction(
    request: CorrectionRequest,
):
    model = ensure_predictor()

    try:

        data = request_to_dict(
            request
        )

        predicted_regime = data.pop(
            "predicted_regime"
        )

        corrected = (
            model.predict_corrected_rainfall(
                data,
                predicted_regime,
            )
        )

        raw = float(
            data["raw_nwp_rainfall"]
        )

        return {
            "success": True,

            "raw_rainfall_mm": raw,

            "corrected_rainfall_mm": float(
                corrected
            ),

            "bias_correction_mm": float(
                corrected - raw
            ),

            "regime": predicted_regime,
        }

    except InputValidationError as exc:

        raise HTTPException(
            status_code=422,
            detail=str(exc),
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


# ============================================================
# HEAVY RAIN
# ============================================================

@app.post("/api/heavy-rain")
def heavy_rain(
    request: HeavyRainRequest,
):
    model = ensure_predictor()

    try:

        data = request_to_dict(
            request
        )

        corrected = data.pop(
            "corrected_rainfall",
            None,
        )

        result = model.predict_heavy_rain(
            data,
            corrected_rainfall=corrected,
        )

        return {
            "success": True,
            **result,
        }

    except InputValidationError as exc:

        raise HTTPException(
            status_code=422,
            detail=str(exc),
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


# ============================================================
# COMPLETE FORECAST
# ============================================================

@app.post("/api/forecast")
def forecast(
    request: ForecastRequest,
):
    model = ensure_predictor()

    try:

        data = request_to_dict(
            request
        )

        result = model.predict(
            data
        )

        return {
            "success": True,

            "location": {
                "latitude": float(
                    data["latitude"]
                ),

                "longitude": float(
                    data["longitude"]
                ),
            },

            "forecast": {
                "raw_rainfall_mm": float(
                    result[
                        "raw_nwp_rainfall"
                    ]
                ),

                "corrected_rainfall_mm": float(
                    result[
                        "corrected_rainfall"
                    ]
                ),

                "bias_correction_mm": float(
                    result[
                        "bias_correction"
                    ]
                ),

                "regime": str(
                    result[
                        "predicted_regime"
                    ]
                ),

                "regime_probability": float(
                    result[
                        "regime_probability"
                    ]
                ),

                "heavy_rain": bool(
                    result[
                        "heavy_rain"
                    ]
                ),

                "heavy_rain_probability": float(
                    result[
                        "heavy_rain_probability"
                    ]
                ),
            },
        }

    except InputValidationError as exc:

        raise HTTPException(
            status_code=422,
            detail=str(exc),
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


# ============================================================
# DISTRICT FORECAST MAP API
# ============================================================

@app.get("/api/districts")
def districts(
    date: Optional[str] = Query(
        default=None,
        description=(
            "Forecast date in YYYY-MM-DD format. "
            "If omitted, latest dataset date is used."
        ),
    ),

    state: Optional[str] = Query(
        default=None,
        description="Optional state filter.",
    ),

    limit: int = Query(
        default=200,
        ge=1,
        le=1000,
        description=(
            "Maximum number of districts."
        ),
    ),
):
    """
    Generate AI-corrected rainfall forecasts
    for districts.
    """

    try:
        df = load_district_dataset()

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )

    # --------------------------------------------------------
    # Required columns
    # --------------------------------------------------------

    required_columns = {
        "date",
        "district_name",
        "state_name",
        "latitude",
        "longitude",
        "raw_nwp_d1",
        "u850",
        "v850",
        "wind_speed_850",
        "vorticity_850",
        "q500",
        "cape",
        "olr",
        "olr_anomaly",
        "mslp_anomaly",
        "moisture_flux",
        "trough_latitude",
        "elevation",
        "slope",
        "dist_coast",
    }

    missing_columns = sorted(
        required_columns
        - set(df.columns)
    )

    if missing_columns:

        raise HTTPException(
            status_code=500,
            detail={
                "message": (
                    "district_daily.parquet "
                    "is missing required columns."
                ),
                "missing_columns": (
                    missing_columns
                ),
            },
        )

    # --------------------------------------------------------
    # Parse dates
    # --------------------------------------------------------

    df["date"] = pd.to_datetime(
        df["date"],
        errors="coerce",
    )

    df = df.dropna(
        subset=["date"]
    )

    if df.empty:

        raise HTTPException(
            status_code=500,
            detail=(
                "No valid dates found in "
                "district_daily.parquet"
            ),
        )

    # --------------------------------------------------------
    # Select date
    # --------------------------------------------------------

    if date is not None:

        requested_date = pd.to_datetime(
            date,
            errors="coerce",
        )

        if pd.isna(requested_date):

            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid date. "
                    "Use YYYY-MM-DD."
                ),
            )

        selected_date = (
            requested_date.normalize()
        )

        df = df[
            df["date"].dt.normalize()
            == selected_date
        ]

        if df.empty:

            return {
                "success": True,
                "count": 0,

                "date": selected_date.strftime(
                    "%Y-%m-%d"
                ),

                "districts": [],
                "data": [],
                "errors": [],
                "error_count": 0,
            }

    else:

        latest_date = df["date"].max()

        selected_date = (
            latest_date.normalize()
        )

        df = df[
            df["date"].dt.normalize()
            == selected_date
        ]

    # --------------------------------------------------------
    # Optional state filter
    # --------------------------------------------------------

    if state:

        df = df[
            df["state_name"]
            .astype(str)
            .str.lower()
            == state.lower()
        ]

    # --------------------------------------------------------
    # One row per district
    # --------------------------------------------------------

    df = (
        df.sort_values(
            [
                "district_name",
                "date",
            ]
        )
        .drop_duplicates(
            subset=[
                "district_name"
            ],
            keep="last",
        )
    )

    # --------------------------------------------------------
    # Limit
    # --------------------------------------------------------

    df = df.head(
        limit
    )

    # --------------------------------------------------------
    # ML inference
    # --------------------------------------------------------

    results: list[
        dict[str, Any]
    ] = []

    errors: list[
        dict[str, str]
    ] = []

    for _, row in df.iterrows():

        district_name = str(
            row.get(
                "district_name",
                "Unknown",
            )
        )

        try:

            result = build_district_forecast(
                row
            )

            results.append(
                result
            )

        except Exception as exc:

            errors.append(
                {
                    "district_name": district_name,
                    "error": str(exc),
                }
            )

    # --------------------------------------------------------
    # Response
    # --------------------------------------------------------

    date_string = (
        selected_date.strftime(
            "%Y-%m-%d"
        )
    )

    return {
        "success": True,

        "count": len(results),

        "date": date_string,

        "districts": results,

        "data": results,

        "errors": errors,

        "error_count": len(errors),
    }


# ============================================================
# PROVENANCE
# ============================================================

@app.get("/api/provenance")
def provenance():
    """
    Return dataset and model provenance.
    """

    dataset_exists = (
        DISTRICT_DATASET.exists()
    )

    dataset_info = {
        "file": DISTRICT_DATASET.name,
        "path": str(
            DISTRICT_DATASET
        ),
        "exists": dataset_exists,
    }

    if dataset_exists:

        try:

            df = pd.read_parquet(
                DISTRICT_DATASET
            )

            dates = pd.to_datetime(
                df["date"],
                errors="coerce",
            ).dropna()

            dataset_info.update(
                {
                    "rows": int(
                        len(df)
                    ),

                    "columns": int(
                        len(df.columns)
                    ),

                    "start_date": (
                        dates.min().strftime(
                            "%Y-%m-%d"
                        )
                        if not dates.empty
                        else None
                    ),

                    "end_date": (
                        dates.max().strftime(
                            "%Y-%m-%d"
                        )
                        if not dates.empty
                        else None
                    ),

                    "districts": (
                        int(
                            df[
                                "district_name"
                            ]
                            .nunique()
                        )
                        if (
                            "district_name"
                            in df.columns
                        )
                        else None
                    ),
                }
            )

        except Exception as exc:

            dataset_info[
                "read_error"
            ] = str(exc)

    return {
        "success": True,

        "project": "VARSHA-MoE",

        "title": (
            "Regime-Aware AI Post-Processing "
            "of Monsoon Rainfall Forecasts"
        ),

        "dataset": dataset_info,

        "models": {
            "regime_classifier": {
                "file": (
                    "regime_classifier.joblib"
                ),
                "loaded": (
                    predictor is not None
                ),
            },

            "rainfall_corrector": {
                "file": (
                    "rainfall_corrector.joblib"
                ),
                "loaded": (
                    predictor is not None
                ),
            },

            "heavy_rain_classifier": {
                "file": (
                    "heavy_rain_classifier.joblib"
                ),
                "loaded": (
                    predictor is not None
                ),
            },
        },

        "pipeline": [
            "NWP rainfall and atmospheric features",
            "Weather regime classification",
            "Regime-aware rainfall bias correction",
            "Heavy rainfall probability estimation",
            "District-level forecast generation",
        ],
    }


# ============================================================
# CASE REPLAYS
# ============================================================

@app.get("/api/case-replays")
def case_replays():
    """
    Return demonstration / validation case replays.
    """

    if not CASE_REPLAYS_FILE.exists():

        return {
            "success": True,
            "count": 0,
            "cases": [],
            "message": (
                "case_replays.json was not found."
            ),
        }

    try:

        with open(
            CASE_REPLAYS_FILE,
            "r",
            encoding="utf-8",
        ) as file:

            data = json.load(
                file
            )

        if isinstance(
            data,
            dict,
        ):

            cases = data.get(
                "cases",
                data.get(
                    "case_replays",
                    data.get(
                        "data",
                        [],
                    ),
                ),
            )

        elif isinstance(
            data,
            list,
        ):

            cases = data

        else:

            cases = []

        return {
            "success": True,
            "count": len(cases),
            "cases": cases,
        }

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail={
                "message": (
                    "Failed to read "
                    "case_replays.json"
                ),
                "error": str(exc),
            },
        )


# ============================================================
# DISTRICT HISTORY
# ============================================================

@app.get("/api/district-history")
def district_history(
    district: Optional[str] = Query(
        default=None,
        description="District name filter.",
    ),

    start: Optional[str] = Query(
        default=None,
        description="Start date YYYY-MM-DD.",
    ),

    end: Optional[str] = Query(
        default=None,
        description="End date YYYY-MM-DD.",
    ),

    regime: Optional[str] = Query(
        default=None,
        description="Regime name filter.",
    ),

    heavy_rain: Optional[bool] = Query(
        default=None,
        description=(
            "Filter by AI heavy-rain prediction."
        ),
    ),

    min_rain: Optional[float] = Query(
        default=None,
        ge=0,
        description="Minimum raw rainfall.",
    ),

    max_rain: Optional[float] = Query(
        default=None,
        ge=0,
        description="Maximum raw rainfall.",
    ),

    skip: int = Query(
        default=0,
        ge=0,
    ),

    limit: int = Query(
        default=25,
        ge=1,
        le=500,
    ),
):
    """
    Historical district rainfall endpoint.
    """

    try:

        df = load_district_dataset()

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )

    # --------------------------------------------------------
    # Required columns
    # --------------------------------------------------------

    required_columns = {
        "date",
        "district_name",
        "state_name",
        "latitude",
        "longitude",
        "obs_rain_mean",
        "obs_rain_max",
        "raw_nwp_d1",
        "u850",
        "v850",
        "wind_speed_850",
        "vorticity_850",
        "q500",
        "cape",
        "olr",
        "olr_anomaly",
        "mslp_anomaly",
        "moisture_flux",
        "trough_latitude",
        "elevation",
        "slope",
        "dist_coast",
    }

    missing_columns = sorted(
        required_columns
        - set(df.columns)
    )

    if missing_columns:

        raise HTTPException(
            status_code=500,
            detail={
                "message": (
                    "district_daily.parquet "
                    "is missing required columns."
                ),
                "missing_columns": missing_columns,
            },
        )

    # --------------------------------------------------------
    # Parse dates
    # --------------------------------------------------------

    df["date"] = pd.to_datetime(
        df["date"],
        errors="coerce",
    )

    df = df.dropna(
        subset=["date"]
    )

    # --------------------------------------------------------
    # District filter
    # --------------------------------------------------------

    if district:

        df = df[
            df["district_name"]
            .astype(str)
            .str.lower()
            == district.lower()
        ]

    # --------------------------------------------------------
    # Date range filter
    # --------------------------------------------------------

    if start:

        start_date = pd.to_datetime(
            start,
            errors="coerce",
        )

        if pd.isna(start_date):

            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid start date. "
                    "Use YYYY-MM-DD."
                ),
            )

        df = df[
            df["date"]
            >= start_date.normalize()
        ]

    if end:

        end_date = pd.to_datetime(
            end,
            errors="coerce",
        )

        if pd.isna(end_date):

            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid end date. "
                    "Use YYYY-MM-DD."
                ),
            )

        df = df[
            df["date"]
            <= end_date.normalize()
        ]

    # --------------------------------------------------------
    # Regime filter
    # --------------------------------------------------------

    if regime:

        regime_value = (
            regime
            .strip()
            .lower()
        )

        if "regime_name" in df.columns:

            regime_name = (
                df["regime_name"]
            )

        elif "regime" in df.columns:

            regime_name = (
                df["regime"]
            )

        else:

            regime_name = pd.Series(
                "",
                index=df.index,
            )

        df = df[
            regime_name
            .astype(str)
            .str.lower()
            == regime_value
        ]

    # --------------------------------------------------------
    # Rainfall filters
    # --------------------------------------------------------

    if min_rain is not None:

        df = df[
            pd.to_numeric(
                df["raw_nwp_d1"],
                errors="coerce",
            )
            >= min_rain
        ]

    if max_rain is not None:

        df = df[
            pd.to_numeric(
                df["raw_nwp_d1"],
                errors="coerce",
            )
            <= max_rain
        ]

    # --------------------------------------------------------
    # Sort newest first
    # --------------------------------------------------------

    df = df.sort_values(
        "date",
        ascending=False,
    )

    total_before_inference = len(
        df
    )

    # --------------------------------------------------------
    # Pagination
    # --------------------------------------------------------

    df = df.iloc[
        skip : skip + limit
    ]

    # --------------------------------------------------------
    # ML inference
    # --------------------------------------------------------

    records: list[
        dict[str, Any]
    ] = []

    errors: list[
        dict[str, str]
    ] = []

    for _, row in df.iterrows():

        try:

            result = (
                build_district_forecast(
                    row
                )
            )

            record = {

                "date": result[
                    "date"
                ],

                "district_name": result[
                    "district_name"
                ],

                "state_name": result[
                    "state_name"
                ],

                "latitude": result[
                    "latitude"
                ],

                "longitude": result[
                    "longitude"
                ],

                # Observed
                "observed_rainfall_mm": (
                    result[
                        "observed_rainfall_mm"
                    ]
                ),

                "observed_max_rainfall_mm": (
                    result[
                        "observed_max_rainfall_mm"
                    ]
                ),

                # Raw NWP
                "raw_nwp_d1_mm": (
                    result[
                        "raw_rainfall_mm"
                    ]
                ),

                # AI correction
                "corrected_rainfall_mm": (
                    result[
                        "corrected_rainfall_mm"
                    ]
                ),

                "bias_correction_mm": (
                    result[
                        "bias_correction_mm"
                    ]
                ),

                # Regime
                "regime": result[
                    "regime"
                ],

                "regime_probability": (
                    result[
                        "regime_probability"
                    ]
                ),

                # Heavy rain
                "heavy_rain": result[
                    "heavy_rain"
                ],

                "heavy_rain_probability": (
                    result[
                        "heavy_rain_probability"
                    ]
                ),

                # Raw D2-D5
                "raw_nwp_d2_mm": (
                    float(
                        row["raw_nwp_d2"]
                    )
                    if (
                        "raw_nwp_d2" in row.index
                        and pd.notna(
                            row["raw_nwp_d2"]
                        )
                    )
                    else None
                ),

                "raw_nwp_d3_mm": (
                    float(
                        row["raw_nwp_d3"]
                    )
                    if (
                        "raw_nwp_d3" in row.index
                        and pd.notna(
                            row["raw_nwp_d3"]
                        )
                    )
                    else None
                ),

                "raw_nwp_d4_mm": (
                    float(
                        row["raw_nwp_d4"]
                    )
                    if (
                        "raw_nwp_d4" in row.index
                        and pd.notna(
                            row["raw_nwp_d4"]
                        )
                    )
                    else None
                ),

                "raw_nwp_d5_mm": (
                    float(
                        row["raw_nwp_d5"]
                    )
                    if (
                        "raw_nwp_d5" in row.index
                        and pd.notna(
                            row["raw_nwp_d5"]
                        )
                    )
                    else None
                ),
            }

            # ------------------------------------------------
            # Heavy-rain filter AFTER inference
            # ------------------------------------------------

            if (
                heavy_rain is not None
                and record["heavy_rain"]
                != heavy_rain
            ):
                continue

            records.append(
                record
            )

        except Exception as exc:

            errors.append(
                {
                    "district_name": str(
                        row.get(
                            "district_name",
                            "Unknown",
                        )
                    ),

                    "date": (
                        row["date"].strftime(
                            "%Y-%m-%d"
                        )
                    ),

                    "error": str(exc),
                }
            )

    return {
        "success": True,

        "district": district,

        "filters": {
            "start": start,
            "end": end,
            "regime": regime,
            "heavy_rain": heavy_rain,
            "min_rain": min_rain,
            "max_rain": max_rain,
        },

        "skip": skip,

        "limit": limit,

        "total": total_before_inference,

        "count": len(records),

        "data": records,

        "records": records,

        "errors": errors,

        "error_count": len(errors),
    }


# ============================================================
# DATA STATUS
# ============================================================

@app.get("/api/data-status")
def data_status():
    """
    Return current ML dataset and model availability.
    """

    try:

        dataset_exists = (
            DISTRICT_DATASET.exists()
        )

        dataset_info = {
            "exists": dataset_exists,

            "path": str(
                DISTRICT_DATASET
            ),

            "rows": 0,

            "columns": 0,

            "start_date": None,

            "end_date": None,

            "districts": 0,
        }

        if dataset_exists:

            df = pd.read_parquet(
                DISTRICT_DATASET
            )

            dataset_info[
                "rows"
            ] = int(
                len(df)
            )

            dataset_info[
                "columns"
            ] = int(
                len(df.columns)
            )

            if (
                "date" in df.columns
                and not df.empty
            ):

                dates = (
                    pd.to_datetime(
                        df["date"],
                        errors="coerce",
                    )
                    .dropna()
                )

                if not dates.empty:

                    dataset_info[
                        "start_date"
                    ] = (
                        dates.min()
                        .strftime(
                            "%Y-%m-%d"
                        )
                    )

                    dataset_info[
                        "end_date"
                    ] = (
                        dates.max()
                        .strftime(
                            "%Y-%m-%d"
                        )
                    )

            if (
                "district_name"
                in df.columns
            ):

                dataset_info[
                    "districts"
                ] = int(
                    df[
                        "district_name"
                    ]
                    .dropna()
                    .nunique()
                )

        model_status = {
            "regime_classifier": False,
            "rainfall_corrector": False,
            "heavy_rain_classifier": False,
        }

        if predictor is not None:

            model_status = {
                "regime_classifier": True,
                "rainfall_corrector": True,
                "heavy_rain_classifier": True,
            }

        return {
            "success": True,

            "project": "VARSHA-MoE",

            "dataset": dataset_info,

            "models": model_status,

            "model_loaded": (
                predictor is not None
            ),

            "verification_available": (
                VERIFICATION_FILE.exists()
            ),

            "status": (
                "ready"
                if (
                    dataset_exists
                    and predictor is not None
                )
                else "degraded"
            ),
        }

    except Exception as exc:

        return {
            "success": False,
            "status": "error",
            "message": str(exc),
        }


# ============================================================
# VERIFICATION
# ============================================================

@app.get("/api/verification")
def verification():
    """
    Return held-out test verification results.

    The API never invents metrics.
    """

    if not VERIFICATION_FILE.exists():

        return {
            "success": False,

            "available": False,

            "message": (
                "No verification record. "
                "Run the held-out test evaluation first."
            ),

            "data": None,
        }

    try:

        with open(
            VERIFICATION_FILE,
            "r",
            encoding="utf-8",
        ) as file:

            results = json.load(
                file
            )

        return {
            "success": True,
            "available": True,
            "data": results,
        }

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail={
                "message": (
                    "Failed to read "
                    "verification_test.json"
                ),
                "error": str(exc),
            },
        )


# ============================================================
# STARTUP
# ============================================================

@app.on_event("startup")
async def startup_event():

    print("=" * 70)

    print(
        f"{APP_NAME} v{APP_VERSION}"
    )

    print("=" * 70)

    print(
        f"ML directory: {ML_DIR}"
    )

    print(
        "District dataset:",
        DISTRICT_DATASET,
    )

    print(
        "District dataset exists:",
        DISTRICT_DATASET.exists(),
    )

    print(
        "Verification file:",
        VERIFICATION_FILE,
    )

    print(
        "Verification available:",
        VERIFICATION_FILE.exists(),
    )

    print(
        "Case replays file:",
        CASE_REPLAYS_FILE,
    )

    print(
        "Case replays available:",
        CASE_REPLAYS_FILE.exists(),
    )

    if predictor is not None:

        print(
            "ML models: LOADED"
        )

    else:

        print(
            "ML models: FAILED"
        )

        print(
            "Model error:",
            MODEL_LOAD_ERROR,
        )

    print("=" * 70)
import json
import math
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from sklearn.metrics import mean_absolute_error, mean_squared_error
from xgboost import XGBRegressor


# ============================================================
# PATHS
# ============================================================

SRC_ROOT = Path(__file__).resolve().parents[1]
ML_ROOT = SRC_ROOT.parent

DATA_FILE = ML_ROOT / "data" / "raw" / "district_daily.parquet"
MODEL_DIR = ML_ROOT / "models"
MOE_DIR = MODEL_DIR / "moe"

REGIME_MODEL = MODEL_DIR / "regime_classifier.joblib"

MOE_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# CONFIG
# ============================================================

TRAIN_YEARS = [2016, 2017, 2018, 2019, 2020]
VALIDATION_YEARS = [2021, 2022]

TARGET = "obs_rain_mean"

REGIME_COLUMN = "regime_name"

BASE_FEATURES = [
    "latitude",
    "longitude",
    "raw_nwp_rainfall",
    "u850",
    "v850",
    "wind_speed",
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
    "month",
    "day_of_year",
    "sin_day",
    "cos_day",
    "is_monsoon",
]


# ============================================================
# HELPERS
# ============================================================

def add_engineered_features(df: pd.DataFrame) -> pd.DataFrame:

    df = df.copy()

    df["date"] = pd.to_datetime(df["date"], errors="coerce")

    df["month"] = df["date"].dt.month
    df["day_of_year"] = df["date"].dt.dayofyear

    df["sin_day"] = np.sin(
        2 * np.pi * df["day_of_year"] / 365.25
    )

    df["cos_day"] = np.cos(
        2 * np.pi * df["day_of_year"] / 365.25
    )

    df["is_monsoon"] = (
        df["month"].between(6, 9)
    ).astype(int)

    df["raw_nwp_rainfall"] = pd.to_numeric(
        df["raw_nwp_d1"],
        errors="coerce"
    )

    u = pd.to_numeric(df["u850"], errors="coerce")
    v = pd.to_numeric(df["v850"], errors="coerce")

    df["wind_speed"] = np.sqrt(
        np.square(u) + np.square(v)
    )

    numeric_columns = [
        "latitude",
        "longitude",
        "raw_nwp_rainfall",
        "u850",
        "v850",
        "wind_speed",
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
        "month",
        "day_of_year",
        "sin_day",
        "cos_day",
        "is_monsoon",
    ]

    for col in numeric_columns:
        if col in df.columns:
            df[col] = pd.to_numeric(
                df[col],
                errors="coerce"
            )

    return df


def safe_name(name: str) -> str:

    return (
        str(name)
        .lower()
        .replace("/", "_")
        .replace("-", "_")
        .replace(" ", "_")
        .replace("(", "")
        .replace(")", "")
    )


def train_expert(
    train_df: pd.DataFrame,
    regime: str,
):

    subset = train_df[
        train_df[REGIME_COLUMN] == regime
    ].copy()

    subset = subset.dropna(
        subset=BASE_FEATURES + [TARGET]
    )

    if len(subset) < 100:
        raise ValueError(
            f"Not enough samples for regime '{regime}': "
            f"{len(subset)}"
        )

    X = subset[BASE_FEATURES].astype(float)

    y = subset[TARGET].astype(float)

    y_log = np.log1p(
        np.clip(y, 0, None)
    )

    model = XGBRegressor(
        n_estimators=600,
        max_depth=8,
        learning_rate=0.04,
        subsample=0.85,
        colsample_bytree=0.85,
        min_child_weight=5,
        objective="reg:squarederror",
        eval_metric="rmse",
        tree_method="hist",
        random_state=42,
        n_jobs=-1,
    )

    model.fit(X, y_log)

    return model, subset


def evaluate_expert(
    model,
    validation_df: pd.DataFrame,
):

    validation_df = validation_df.dropna(
        subset=BASE_FEATURES + [TARGET]
    )

    if validation_df.empty:
        return {
            "n": 0,
            "rmse": None,
            "mae": None,
        }

    X = validation_df[BASE_FEATURES].astype(float)

    y = validation_df[TARGET].astype(float)

    prediction = np.expm1(
        model.predict(X)
    )

    prediction = np.clip(
        prediction,
        0,
        None
    )

    return {
        "n": int(len(y)),
        "rmse": float(
            np.sqrt(
                mean_squared_error(
                    y,
                    prediction
                )
            )
        ),
        "mae": float(
            mean_absolute_error(
                y,
                prediction
            )
        ),
    }


# ============================================================
# MAIN
# ============================================================

def main():

    print("=" * 70)
    print("VARSHA-MoE EXPERT TRAINING")
    print("=" * 70)

    print(f"Dataset: {DATA_FILE}")

    df = pd.read_parquet(DATA_FILE)

    print(f"Rows: {len(df):,}")
    print(f"Columns: {len(df.columns)}")

    df = add_engineered_features(df)

    if REGIME_COLUMN not in df.columns:

        raise ValueError(
            f"Missing regime column: {REGIME_COLUMN}"
        )

    # --------------------------------------------------------
    # Temporal split
    # --------------------------------------------------------

    train_df = df[
        df["year"].isin(TRAIN_YEARS)
    ].copy()

    validation_df = df[
        df["year"].isin(VALIDATION_YEARS)
    ].copy()

    print()
    print(
        f"Train rows: {len(train_df):,}"
    )

    print(
        f"Validation rows: {len(validation_df):,}"
    )

    # --------------------------------------------------------
    # Load regime gate
    # --------------------------------------------------------

    if not REGIME_MODEL.exists():

        raise FileNotFoundError(
            f"Regime model not found: {REGIME_MODEL}"
        )

    regime_bundle = joblib.load(
        REGIME_MODEL
    )

    regime_model = (
        regime_bundle["model"]
        if isinstance(regime_bundle, dict)
        else regime_bundle
    )

    regime_encoder = (
        regime_bundle.get("encoder")
        if isinstance(regime_bundle, dict)
        else None
    )

    regime_features = (
        regime_bundle.get("features")
        if isinstance(regime_bundle, dict)
        else None
    )

    if regime_features is None:

        raise ValueError(
            "Regime model bundle does not contain features."
        )

    # --------------------------------------------------------
    # Prepare gate features
    # --------------------------------------------------------

    missing = [
        col
        for col in regime_features
        if col not in train_df.columns
    ]

    if missing:

        raise ValueError(
            f"Missing regime features: {missing}"
        )

    X_gate_train = (
        train_df[regime_features]
        .replace([np.inf, -np.inf], np.nan)
        .fillna(0)
        .astype(float)
    )

    # --------------------------------------------------------
    # Get regime predictions
    # --------------------------------------------------------

    if hasattr(regime_model, "predict_proba"):

        regime_probabilities = (
            regime_model.predict_proba(
                X_gate_train
            )
        )

        regime_classes = (
            regime_model.classes_
        )

        if regime_encoder is not None:

            try:

                regime_classes = (
                    regime_encoder
                    .inverse_transform(
                        np.arange(
                            len(regime_classes)
                        ).reshape(-1, 1)
                    )
                    .ravel()
                )

            except Exception:
                pass

    else:

        raise ValueError(
            "Regime model does not support predict_proba()."
        )

    predicted_indices = (
        np.argmax(
            regime_probabilities,
            axis=1
        )
    )

    train_df["_gate_regime"] = [
        regime_classes[i]
        for i in predicted_indices
    ]

    # --------------------------------------------------------
    # Train one expert for every physical regime
    # --------------------------------------------------------

    regimes = sorted(
        train_df[REGIME_COLUMN]
        .dropna()
        .unique()
        .tolist()
    )

    print()
    print("Regimes detected:")

    for regime in regimes:

        count = int(
            (
                train_df[REGIME_COLUMN]
                == regime
            ).sum()
        )

        print(
            f"  {regime}: {count:,}"
        )

    expert_models = {}

    expert_metrics = {}

    print()
    print("=" * 70)
    print("TRAINING EXPERTS")
    print("=" * 70)

    for regime in regimes:

        print()
        print(
            f"Training expert: {regime}"
        )

        model, subset = train_expert(
            train_df,
            regime
        )

        filename = (
            f"expert_{safe_name(regime)}.joblib"
        )

        output_path = (
            MOE_DIR / filename
        )

        joblib.dump(
            {
                "model": model,
                "regime": regime,
                "features": BASE_FEATURES,
                "target": TARGET,
                "log_target": True,
            },
            output_path,
        )

        expert_models[regime] = model

        validation_subset = (
            validation_df[
                validation_df[REGIME_COLUMN]
                == regime
            ]
            .copy()
        )

        metrics = evaluate_expert(
            model,
            validation_subset
        )

        expert_metrics[regime] = metrics

        print(
            f"  Samples: {len(subset):,}"
        )

        print(
            f"  Validation RMSE: "
            f"{metrics['rmse']}"
        )

        print(
            f"  Validation MAE: "
            f"{metrics['mae']}"
        )

    # --------------------------------------------------------
    # Save complete MoE bundle
    # --------------------------------------------------------

    bundle = {
        "type": "VARSHA-MoE",
        "version": "1.0",
        "regimes": regimes,
        "experts": expert_models,
        "expert_metrics": expert_metrics,
        "features": BASE_FEATURES,
        "gate_model": regime_model,
        "gate_features": regime_features,
        "gate_classes": list(
            map(str, regime_classes)
        ),
        "target": TARGET,
        "log_target": True,
        "train_years": TRAIN_YEARS,
        "validation_years": VALIDATION_YEARS,
    }

    bundle_path = (
        MOE_DIR / "moe_bundle.joblib"
    )

    joblib.dump(
        bundle,
        bundle_path
    )

    metadata_path = (
        MOE_DIR / "moe_metadata.json"
    )

    with open(
        metadata_path,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            {
                "version": "1.0",
                "regimes": regimes,
                "features": BASE_FEATURES,
                "train_years": TRAIN_YEARS,
                "validation_years": VALIDATION_YEARS,
                "expert_metrics": expert_metrics,
            },
            f,
            indent=2,
        )

    print()
    print("=" * 70)
    print("MOE TRAINING COMPLETE")
    print("=" * 70)

    print(
        f"Bundle: {bundle_path}"
    )


if __name__ == "__main__":
    main()
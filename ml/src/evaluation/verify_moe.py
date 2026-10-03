import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from sklearn.metrics import (
    accuracy_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
)


# ============================================================
# PATHS
# ============================================================

SRC_ROOT = Path(__file__).resolve().parents[1]
ML_ROOT = SRC_ROOT.parent

DATA_FILE = (
    ML_ROOT
    / "data"
    / "raw"
    / "district_daily.parquet"
)

MODEL_DIR = ML_ROOT / "models"

MOE_DIR = (
    MODEL_DIR
    / "moe"
)

MOE_BUNDLE = (
    MOE_DIR
    / "moe_bundle.joblib"
)

REGIME_MODEL = (
    MODEL_DIR
    / "regime_classifier.joblib"
)

CORRECTION_MODEL = (
    MODEL_DIR
    / "rainfall_corrector.joblib"
)

HEAVY_MODEL = (
    MODEL_DIR
    / "heavy_rain_classifier.joblib"
)

OUTPUT_FILE = (
    ML_ROOT
    / "verification_moe_test.json"
)


# ============================================================
# CONFIG
# ============================================================

TEST_YEARS = [2023]

TARGET = "obs_rain_mean"

HEAVY_THRESHOLD = 64.5

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
# FEATURE ENGINEERING
# ============================================================

def add_engineered_features(
    df: pd.DataFrame,
) -> pd.DataFrame:

    df = df.copy()

    df["date"] = pd.to_datetime(
        df["date"],
        errors="coerce",
    )

    df["month"] = (
        df["date"].dt.month
    )

    df["day_of_year"] = (
        df["date"].dt.dayofyear
    )

    df["sin_day"] = np.sin(
        2
        * np.pi
        * df["day_of_year"]
        / 365.25
    )

    df["cos_day"] = np.cos(
        2
        * np.pi
        * df["day_of_year"]
        / 365.25
    )

    df["is_monsoon"] = (
        df["month"].between(6, 9)
    ).astype(int)

    # --------------------------------------------------------
    # Raw NWP rainfall
    # --------------------------------------------------------

    if "raw_nwp_rainfall" not in df.columns:

        if "raw_nwp_d1" in df.columns:

            df["raw_nwp_rainfall"] = (
                pd.to_numeric(
                    df["raw_nwp_d1"],
                    errors="coerce",
                )
            )

        else:

            raise ValueError(
                "Missing raw_nwp_d1 column."
            )

    # --------------------------------------------------------
    # Wind speed
    # --------------------------------------------------------

    u = pd.to_numeric(
        df["u850"],
        errors="coerce",
    )

    v = pd.to_numeric(
        df["v850"],
        errors="coerce",
    )

    df["wind_speed"] = np.sqrt(
        np.square(u)
        + np.square(v)
    )

    # --------------------------------------------------------
    # Numeric conversion
    # --------------------------------------------------------

    numeric_columns = list(
        set(BASE_FEATURES)
        | {
            TARGET,
            "raw_nwp_d1",
            "raw_nwp_d2",
            "raw_nwp_d3",
            "raw_nwp_d4",
            "raw_nwp_d5",
        }
    )

    for col in numeric_columns:

        if col in df.columns:

            df[col] = pd.to_numeric(
                df[col],
                errors="coerce",
            )

    return df


# ============================================================
# FEATURE VALIDATION
# ============================================================

def require_features(
    df: pd.DataFrame,
    features,
    model_name: str,
):

    missing = [
        feature
        for feature in features
        if feature not in df.columns
    ]

    if missing:

        raise ValueError(
            f"{model_name} is missing "
            f"features: {missing}"
        )


# ============================================================
# SAFE METRICS
# ============================================================

def safe_rmse(
    observed,
    predicted,
):

    return float(
        np.sqrt(
            mean_squared_error(
                observed,
                predicted,
            )
        )
    )


def safe_mae(
    observed,
    predicted,
):

    return float(
        mean_absolute_error(
            observed,
            predicted,
        )
    )


# ============================================================
# CONTINGENCY
# ============================================================

def contingency(
    observed,
    predicted,
    threshold,
):

    observed_event = (
        np.asarray(observed)
        >= threshold
    )

    predicted_event = (
        np.asarray(predicted)
        >= threshold
    )

    hits = int(
        np.sum(
            observed_event
            & predicted_event
        )
    )

    misses = int(
        np.sum(
            observed_event
            & ~predicted_event
        )
    )

    false_alarm = int(
        np.sum(
            ~observed_event
            & predicted_event
        )
    )

    correct_negative = int(
        np.sum(
            ~observed_event
            & ~predicted_event
        )
    )

    return (
        hits,
        misses,
        false_alarm,
        correct_negative,
    )


# ============================================================
# WEATHER VERIFICATION METRICS
# ============================================================

def calculate_event_metrics(
    observed,
    predicted,
    threshold,
):

    hits, misses, false_alarm, correct_negative = (
        contingency(
            observed,
            predicted,
            threshold,
        )
    )

    denominator_csi = (
        hits
        + misses
        + false_alarm
    )

    csi = (
        hits / denominator_csi
        if denominator_csi > 0
        else 0.0
    )

    pod = (
        hits / (hits + misses)
        if hits + misses > 0
        else 0.0
    )

    far = (
        false_alarm
        / (hits + false_alarm)
        if hits + false_alarm > 0
        else 0.0
    )

    total = (
        hits
        + misses
        + false_alarm
        + correct_negative
    )

    random_hits = (
        (
            (hits + misses)
            * (hits + false_alarm)
        )
        / total
        if total > 0
        else 0.0
    )

    ets_denominator = (
        hits
        + misses
        + false_alarm
        - random_hits
    )

    ets = (
        (hits - random_hits)
        / ets_denominator
        if ets_denominator != 0
        else 0.0
    )

    return {
        "hits": hits,
        "misses": misses,
        "false_alarm": false_alarm,
        "correct_negative": correct_negative,
        "csi": float(csi),
        "pod": float(pod),
        "far": float(far),
        "ets": float(ets),
    }


# ============================================================
# REGIME GATE
# ============================================================

def get_regime_probabilities(
    df,
    regime_bundle,
):

    model = (
        regime_bundle["model"]
        if isinstance(regime_bundle, dict)
        else regime_bundle
    )

    features = (
        regime_bundle.get("features")
        if isinstance(regime_bundle, dict)
        else None
    )

    encoder = (
        regime_bundle.get("encoder")
        if isinstance(regime_bundle, dict)
        else None
    )

    if features is None:

        raise ValueError(
            "Regime model bundle does not contain features."
        )

    require_features(
        df,
        features,
        "Regime model",
    )

    X = (
        df[features]
        .replace(
            [np.inf, -np.inf],
            np.nan,
        )
        .fillna(0)
        .astype(float)
    )

    probabilities = (
        model.predict_proba(X)
    )

    class_indices = np.arange(
        len(model.classes_)
    )

    # --------------------------------------------------------
    # Decode classes
    # --------------------------------------------------------

    if encoder is not None:

        try:

            decoded = (
                encoder.inverse_transform(
                    class_indices.reshape(-1, 1)
                ).ravel()
            )

            classes = [
                str(value)
                for value in decoded
            ]

        except Exception:

            classes = [
                str(value)
                for value in model.classes_
            ]

    else:

        classes = [
            str(value)
            for value in model.classes_
        ]

    return (
        probabilities,
        classes,
    )


# ============================================================
# MOE PREDICTION
# ============================================================

def predict_moe_batch(
    df,
    moe_bundle,
):

    experts = (
        moe_bundle["experts"]
    )

    gate_model = (
        moe_bundle["gate_model"]
    )

    gate_features = (
        moe_bundle["gate_features"]
    )

    expert_features = (
        moe_bundle["features"]
    )

    require_features(
        df,
        gate_features,
        "MoE gate",
    )

    require_features(
        df,
        expert_features,
        "MoE experts",
    )

    # --------------------------------------------------------
    # Gate probabilities
    # --------------------------------------------------------

    X_gate = (
        df[gate_features]
        .replace(
            [np.inf, -np.inf],
            np.nan,
        )
        .fillna(0)
        .astype(float)
    )

    gate_probabilities = (
        gate_model.predict_proba(
            X_gate
        )
    )

    gate_classes = [
        str(value)
        for value in gate_model.classes_
    ]

    # --------------------------------------------------------
    # Expert predictions
    # --------------------------------------------------------

    expert_predictions = {}

    X_expert = (
        df[expert_features]
        .replace(
            [np.inf, -np.inf],
            np.nan,
        )
        .fillna(0)
        .astype(float)
    )

    for regime, expert in experts.items():

        prediction = (
            expert.predict(
                X_expert
            )
        )

        prediction = np.expm1(
            prediction
        )

        prediction = np.clip(
            prediction,
            0,
            None,
        )

        expert_predictions[
            str(regime)
        ] = prediction

    # --------------------------------------------------------
    # Align gate class names with expert names
    # --------------------------------------------------------

    aligned_weights = np.zeros_like(
        gate_probabilities,
        dtype=float,
    )

    expert_lookup = {
        str(key): key
        for key in experts.keys()
    }

    for class_index, regime in enumerate(
        gate_classes
    ):

        if regime in expert_lookup:

            aligned_weights[:, class_index] = (
                gate_probabilities[
                    :,
                    class_index,
                ]
            )

    # --------------------------------------------------------
    # Normalize only over available experts
    # --------------------------------------------------------

    weight_sum = (
        aligned_weights.sum(
            axis=1,
            keepdims=True,
        )
    )

    weight_sum = np.where(
        weight_sum <= 0,
        1.0,
        weight_sum,
    )

    aligned_weights = (
        aligned_weights
        / weight_sum
    )

    # --------------------------------------------------------
    # Weighted blend
    # --------------------------------------------------------

    corrected = np.zeros(
        len(df),
        dtype=float,
    )

    for class_index, regime in enumerate(
        gate_classes
    ):

        if regime not in expert_lookup:
            continue

        expert_key = expert_lookup[
            regime
        ]

        corrected += (
            aligned_weights[
                :,
                class_index,
            ]
            * expert_predictions[
                str(expert_key)
            ]
        )

    # --------------------------------------------------------
    # Dominant regime
    # --------------------------------------------------------

    dominant_indices = np.argmax(
        aligned_weights,
        axis=1,
    )

    dominant_regimes = [
        gate_classes[index]
        for index in dominant_indices
    ]

    return (
        corrected,
        gate_probabilities,
        gate_classes,
        dominant_regimes,
        expert_predictions,
    )


# ============================================================
# SINGLE XGBOOST BASELINE
# ============================================================

def predict_single_corrector(
    df,
    correction_bundle,
    predicted_regimes,
):

    model = (
        correction_bundle["model"]
    )

    features = (
        correction_bundle["features"]
    )

    encoder = (
        correction_bundle.get(
            "regime_encoder"
        )
    )

    regime_columns = (
        correction_bundle.get(
            "regime_columns",
            [],
        )
    )

    require_features(
        df,
        features,
        "Single correction model",
    )

    X_numeric = (
        df[features]
        .replace(
            [np.inf, -np.inf],
            np.nan,
        )
        .fillna(0)
        .astype(float)
    )

    if encoder is not None:

        encoded = encoder.transform(
            np.asarray(
                predicted_regimes,
                dtype=object,
            ).reshape(-1, 1)
        )

        encoded_df = pd.DataFrame(
            encoded,
            columns=regime_columns,
            index=df.index,
        )

    else:

        encoded_df = pd.DataFrame(
            0.0,
            index=df.index,
            columns=regime_columns,
        )

    X = pd.concat(
        [
            X_numeric,
            encoded_df,
        ],
        axis=1,
    )

    booster_features = (
        model.get_booster()
        .feature_names
    )

    if booster_features is None:

        raise ValueError(
            "Single correction model "
            "does not expose feature names."
        )

    # --------------------------------------------------------
    # Exact model feature ordering
    # --------------------------------------------------------

    for feature in booster_features:

        if feature not in X.columns:

            X[feature] = 0.0

    X = X[
        booster_features
    ]

    prediction = model.predict(
        X
    )

    prediction = np.expm1(
        prediction
    )

    return np.clip(
        prediction,
        0,
        None,
    )


# ============================================================
# HEAVY RAIN MODEL
# ============================================================

def evaluate_heavy_model(
    df,
    heavy_bundle,
):

    model = (
        heavy_bundle["model"]
        if isinstance(
            heavy_bundle,
            dict,
        )
        else heavy_bundle
    )

    features = (
        heavy_bundle.get("features")
        if isinstance(
            heavy_bundle,
            dict,
        )
        else BASE_FEATURES
    )

    require_features(
        df,
        features,
        "Heavy rainfall model",
    )

    X = (
        df[features]
        .replace(
            [np.inf, -np.inf],
            np.nan,
        )
        .fillna(0)
        .astype(float)
    )

    observed_heavy = (
        df[TARGET]
        >= HEAVY_THRESHOLD
    ).astype(int)

    predicted_heavy = (
        model.predict(X)
    )

    metrics: dict[str, float | None] = {
        "accuracy": float(
            accuracy_score(
                observed_heavy,
                predicted_heavy,
            )
        ),
        "precision": float(
            precision_score(
                observed_heavy,
                predicted_heavy,
                zero_division=0,
            )
        ),
        "recall": float(
            recall_score(
                observed_heavy,
                predicted_heavy,
                zero_division=0,
            )
        ),
        "f1": float(
            f1_score(
                observed_heavy,
                predicted_heavy,
                zero_division=0,
            )
        ),
    }

    if hasattr(
        model,
        "predict_proba",
    ):

        probabilities = (
            model.predict_proba(X)
        )

        if probabilities.shape[1] > 1:

            heavy_probability = (
                probabilities[:, 1]
            )

            try:

                metrics["roc_auc"] = float(
                    roc_auc_score(
                        observed_heavy,
                        heavy_probability,
                    )
                )

            except ValueError:

                metrics["roc_auc"] = None

        else:

            metrics["roc_auc"] = None

    else:

        metrics["roc_auc"] = None

    return metrics


# ============================================================
# MAIN
# ============================================================

def evaluate():

    print("=" * 72)
    print("VARSHA-MoE HELD-OUT TEST VERIFICATION")
    print("=" * 72)

    # --------------------------------------------------------
    # Check files
    # --------------------------------------------------------

    required_files = [
        DATA_FILE,
        MOE_BUNDLE,
        REGIME_MODEL,
        CORRECTION_MODEL,
        HEAVY_MODEL,
    ]

    for file in required_files:

        if not file.exists():

            raise FileNotFoundError(
                f"Required file not found: {file}"
            )

    # --------------------------------------------------------
    # Load data
    # --------------------------------------------------------

    print(
        f"Dataset: {DATA_FILE}"
    )

    df = pd.read_parquet(
        DATA_FILE
    )

    df = add_engineered_features(
        df
    )

    # --------------------------------------------------------
    # Held-out test
    # --------------------------------------------------------

    test_df = df[
        df["year"].isin(TEST_YEARS)
    ].copy()

    print(
        f"Test years: {TEST_YEARS}"
    )

    print(
        f"Test rows: {len(test_df):,}"
    )

    if test_df.empty:

        raise ValueError(
            "Held-out test dataset is empty."
        )

    # --------------------------------------------------------
    # Valid target
    # --------------------------------------------------------

    valid = (
        test_df[TARGET].notna()
        & test_df["raw_nwp_rainfall"].notna()
    )

    test_df = test_df.loc[
        valid
    ].copy()

    observed = (
        test_df[TARGET]
        .astype(float)
        .to_numpy()
    )

    raw_nwp = (
        test_df["raw_nwp_rainfall"]
        .astype(float)
        .clip(lower=0)
        .to_numpy()
    )

    # --------------------------------------------------------
    # Load models
    # --------------------------------------------------------

    moe_bundle = joblib.load(
        MOE_BUNDLE
    )

    regime_bundle = joblib.load(
        REGIME_MODEL
    )

    correction_bundle = joblib.load(
        CORRECTION_MODEL
    )

    heavy_bundle = joblib.load(
        HEAVY_MODEL
    )

    # --------------------------------------------------------
    # Regime probabilities
    # --------------------------------------------------------

    (
        regime_probabilities,
        regime_classes,
    ) = get_regime_probabilities(
        test_df,
        regime_bundle,
    )

    predicted_regime_indices = (
        np.argmax(
            regime_probabilities,
            axis=1,
        )
    )

    predicted_regimes = [
        regime_classes[index]
        for index
        in predicted_regime_indices
    ]

    # --------------------------------------------------------
    # Existing single model
    # --------------------------------------------------------

    print()
    print(
        "Running existing single correction model..."
    )

    single_corrected = (
        predict_single_corrector(
            test_df,
            correction_bundle,
            predicted_regimes,
        )
    )

    # --------------------------------------------------------
    # MoE
    # --------------------------------------------------------

    print(
        "Running VARSHA-MoE..."
    )

    (
        moe_corrected,
        moe_probabilities,
        moe_classes,
        dominant_regimes,
        expert_predictions,
    ) = predict_moe_batch(
        test_df,
        moe_bundle,
    )

    # --------------------------------------------------------
    # Metrics
    # --------------------------------------------------------

    raw_metrics = calculate_event_metrics(
        observed,
        raw_nwp,
        HEAVY_THRESHOLD,
    )

    single_metrics = calculate_event_metrics(
        observed,
        single_corrected,
        HEAVY_THRESHOLD,
    )

    moe_metrics = calculate_event_metrics(
        observed,
        moe_corrected,
        HEAVY_THRESHOLD,
    )

    # --------------------------------------------------------
    # Continuous metrics
    # --------------------------------------------------------

    raw_rmse = safe_rmse(
        observed,
        raw_nwp,
    )

    raw_mae = safe_mae(
        observed,
        raw_nwp,
    )

    single_rmse = safe_rmse(
        observed,
        single_corrected,
    )

    single_mae = safe_mae(
        observed,
        single_corrected,
    )

    moe_rmse = safe_rmse(
        observed,
        moe_corrected,
    )

    moe_mae = safe_mae(
        observed,
        moe_corrected,
    )

    # --------------------------------------------------------
    # Heavy rainfall classifier
    # --------------------------------------------------------

    heavy_metrics = evaluate_heavy_model(
        test_df,
        heavy_bundle,
    )

    # --------------------------------------------------------
    # Regime distribution
    # --------------------------------------------------------

    regime_counts = (
        pd.Series(
            dominant_regimes
        )
        .value_counts()
        .to_dict()
    )

    regime_distribution = {
        str(key): int(value)
        for key, value
        in regime_counts.items()
    }

    # --------------------------------------------------------
    # Average gate probabilities
    # --------------------------------------------------------

    average_probabilities = {}

    for index, regime in enumerate(
        moe_classes
    ):

        average_probabilities[
            str(regime)
        ] = float(
            np.mean(
                moe_probabilities[
                    :,
                    index,
                ]
            )
        )

    # --------------------------------------------------------
    # Improvement calculations
    # --------------------------------------------------------

    def improvement(
        baseline,
        new,
    ):

        if baseline == 0:
            return None

        return float(
            (
                baseline - new
            )
            / baseline
            * 100.0
        )

    # --------------------------------------------------------
    # Final results
    # --------------------------------------------------------

    results = {

        "success": True,

        "model": "VARSHA-MoE",

        "version": "1.0",

        "split": "test",

        "split_years": TEST_YEARS,

        "n_samples": int(
            len(test_df)
        ),

        "threshold_mm": (
            HEAVY_THRESHOLD
        ),

        "metrics": {

            "raw_gfs_rmse": raw_rmse,

            "single_model_rmse": (
                single_rmse
            ),

            "moe_rmse": moe_rmse,

            "raw_gfs_mae": raw_mae,

            "single_model_mae": (
                single_mae
            ),

            "moe_mae": moe_mae,

            "raw_gfs_csi": (
                raw_metrics["csi"]
            ),

            "single_model_csi": (
                single_metrics["csi"]
            ),

            "moe_csi": (
                moe_metrics["csi"]
            ),

            "raw_gfs_pod": (
                raw_metrics["pod"]
            ),

            "single_model_pod": (
                single_metrics["pod"]
            ),

            "moe_pod": (
                moe_metrics["pod"]
            ),

            "raw_gfs_far": (
                raw_metrics["far"]
            ),

            "single_model_far": (
                single_metrics["far"]
            ),

            "moe_far": (
                moe_metrics["far"]
            ),

            "raw_gfs_ets": (
                raw_metrics["ets"]
            ),

            "single_model_ets": (
                single_metrics["ets"]
            ),

            "moe_ets": (
                moe_metrics["ets"]
            ),

            # Spatial FSS requires grid/neighborhood
            # predictions and is not calculated here.
            "raw_gfs_fss": None,

            "single_model_fss": None,

            "moe_fss": None,
        },

        "improvement_percent": {

            "rmse_vs_raw": improvement(
                raw_rmse,
                moe_rmse,
            ),

            "mae_vs_raw": improvement(
                raw_mae,
                moe_mae,
            ),

            "csi_vs_raw": improvement(
                raw_metrics["csi"],
                moe_metrics["csi"],
            ),

        },

        "heavy_rain": heavy_metrics,

        "regime_distribution": (
            regime_distribution
        ),

        "average_gate_probabilities": (
            average_probabilities
        ),

        "source": {

            "dataset": str(
                DATA_FILE
            ),

            "model": str(
                MOE_BUNDLE
            ),

            "target": TARGET,

            "test_years": TEST_YEARS,

        },

        "created_at": (
            pd.Timestamp.utcnow()
            .isoformat()
        ),
    }

    # --------------------------------------------------------
    # Save JSON
    # --------------------------------------------------------

    with open(
        OUTPUT_FILE,
        "w",
        encoding="utf-8",
    ) as file:

        json.dump(
            results,
            file,
            indent=2,
        )

    # --------------------------------------------------------
    # Console report
    # --------------------------------------------------------

    print()
    print("=" * 72)
    print("VARSHA-MoE TEST RESULTS")
    print("=" * 72)

    print(
        f"Samples: {len(test_df):,}"
    )

    print()

    print(
        "RMSE"
    )

    print(
        f"  Raw NWP     : {raw_rmse:.4f}"
    )

    print(
        f"  Single XGB  : {single_rmse:.4f}"
    )

    print(
        f"  VARSHA-MoE  : {moe_rmse:.4f}"
    )

    print()

    print(
        "MAE"
    )

    print(
        f"  Raw NWP     : {raw_mae:.4f}"
    )

    print(
        f"  Single XGB  : {single_mae:.4f}"
    )

    print(
        f"  VARSHA-MoE  : {moe_mae:.4f}"
    )

    print()

    print(
        "Heavy Rain Verification"
    )

    print(
        f"  Threshold   : {HEAVY_THRESHOLD} mm"
    )

    print(
        f"  Raw CSI     : {raw_metrics['csi']:.4f}"
    )

    print(
        f"  Single CSI  : {single_metrics['csi']:.4f}"
    )

    print(
        f"  MoE CSI     : {moe_metrics['csi']:.4f}"
    )

    print(
        f"  Raw POD     : {raw_metrics['pod']:.4f}"
    )

    print(
        f"  MoE POD     : {moe_metrics['pod']:.4f}"
    )

    print(
        f"  Raw FAR     : {raw_metrics['far']:.4f}"
    )

    print(
        f"  MoE FAR     : {moe_metrics['far']:.4f}"
    )

    print(
        f"  Raw ETS     : {raw_metrics['ets']:.4f}"
    )

    print(
        f"  MoE ETS     : {moe_metrics['ets']:.4f}"
    )

    print()

    print(
        "MoE average regime probabilities:"
    )

    for regime, probability in (
        average_probabilities.items()
    ):

        print(
            f"  {regime:<28} "
            f"{probability:.4f}"
        )

    print()

    print(
        f"Saved: {OUTPUT_FILE}"
    )

    print("=" * 72)

    return results


if __name__ == "__main__":

    evaluate()
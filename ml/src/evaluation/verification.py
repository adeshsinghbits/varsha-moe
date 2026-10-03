import joblib
import numpy as np
import pandas as pd
import json
from pathlib import Path

from sklearn.metrics import (
    mean_squared_error,
    mean_absolute_error,
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
)

from config import (
    TEST_DATA,
    CORRECTION_MODEL,
    HEAVY_RAIN_MODEL,
    REGIME_MODEL,
)


# ============================================================
# COMMON FEATURES
# ============================================================

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

def clean_numeric(df, columns):
    df = df.copy()

    for column in columns:
        if column in df.columns:
            df[column] = pd.to_numeric(
                df[column],
                errors="coerce"
            )

    return df


def add_engineered_features(df):
    """
    Ensure the test dataframe contains the same engineered
    fields used during training.
    """

    df = df.copy()

    if "date" in df.columns:
        df["date"] = pd.to_datetime(
            df["date"],
            errors="coerce"
        )

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

    if "obs_rain_mean" in df.columns:
        df["observed_rainfall"] = pd.to_numeric(
            df["obs_rain_mean"],
            errors="coerce"
        )

    if "raw_nwp_d1" in df.columns:
        df["raw_nwp_rainfall"] = pd.to_numeric(
            df["raw_nwp_d1"],
            errors="coerce"
        )

    if "u850" in df.columns and "v850" in df.columns:
        u = pd.to_numeric(
            df["u850"],
            errors="coerce"
        )

        v = pd.to_numeric(
            df["v850"],
            errors="coerce"
        )

        df["wind_speed"] = np.sqrt(
            u ** 2 + v ** 2
        )

    return df


# ============================================================
# REGIME PREDICTION
# ============================================================

def predict_regime(
    df,
    regime_bundle
):

    model = regime_bundle["model"]
    encoder = regime_bundle["encoder"]
    features = regime_bundle["features"]

    available = [
        feature
        for feature in features
        if feature in df.columns
    ]

    X = df[available].copy()

    X = clean_numeric(
        X,
        available
    )

    X = X.replace(
        [np.inf, -np.inf],
        np.nan
    )

    predictions = model.predict(X)

    regime_names = encoder.inverse_transform(
        predictions.astype(int)
    )

    return regime_names


# ============================================================
# BUILD CORRECTION INPUT
# ============================================================

def build_correction_features(
    df,
    correction_bundle,
    predicted_regimes
):

    model = correction_bundle["model"]

    # Features saved during correction training
    numeric_features = correction_bundle[
        "features"
    ]

    # --------------------------------------------------------
    # Numeric features
    # --------------------------------------------------------

    available = [
        feature
        for feature in numeric_features
        if feature in df.columns
    ]

    X_numeric = df[
        available
    ].copy()

    X_numeric = clean_numeric(
        X_numeric,
        available
    )

    X_numeric = X_numeric.replace(
        [np.inf, -np.inf],
        np.nan
    )

    # --------------------------------------------------------
    # Recreate EXACT regime encoding
    # --------------------------------------------------------

    regime_encoder = correction_bundle[
        "regime_encoder"
    ]

    regime_df = pd.DataFrame(
        {
            "predicted_regime": predicted_regimes
        }
    )

    encoded = regime_encoder.transform(
        regime_df
    )

    regime_columns = correction_bundle[
        "regime_columns"
    ]

    X_regime = pd.DataFrame(
        encoded,
        columns=regime_columns,
        index=df.index
    )

    # --------------------------------------------------------
    # Combine
    # --------------------------------------------------------

    X = pd.concat(
        [
            X_numeric.reset_index(drop=True),
            X_regime.reset_index(drop=True),
        ],
        axis=1
    )

    # --------------------------------------------------------
    # EXACT feature order from trained XGBoost model
    # --------------------------------------------------------

    expected_features = model.get_booster().feature_names

    for feature in expected_features:

        if feature not in X.columns:
            X[feature] = 0.0

    X = X[
        expected_features
    ]

    return X


# ============================================================
# HEAVY RAIN FEATURES
# ============================================================

def build_heavy_rain_features(
    df,
    heavy_bundle
):

    model = heavy_bundle["model"]

    if "features" in heavy_bundle:

        features = heavy_bundle[
            "features"
        ]

    else:

        features = BASE_FEATURES

    available = [
        feature
        for feature in features
        if feature in df.columns
    ]

    X = df[
        available
    ].copy()

    X = clean_numeric(
        X,
        available
    )

    X = X.replace(
        [np.inf, -np.inf],
        np.nan
    )

    expected_features = model.get_booster().feature_names

    for feature in expected_features:

        if feature not in X.columns:
            X[feature] = 0.0

    X = X[
        expected_features
    ]

    return X


# ============================================================
# ETS
# ============================================================

def equitable_threat_score(
    observed,
    predicted
):

    observed = np.asarray(observed).astype(bool)
    predicted = np.asarray(predicted).astype(bool)

    hits = np.sum(
        observed & predicted
    )

    false_alarms = np.sum(
        (~observed) & predicted
    )

    misses = np.sum(
        observed & (~predicted)
    )

    correct_negatives = np.sum(
        (~observed) & (~predicted)
    )

    total = (
        hits
        + false_alarms
        + misses
        + correct_negatives
    )

    if total == 0:
        return 0.0

    random_hits = (
        (hits + misses)
        * (hits + false_alarms)
        / total
    )

    denominator = (
        hits
        + false_alarms
        + misses
        - random_hits
    )

    if denominator == 0:
        return 0.0

    return (
        hits - random_hits
    ) / denominator


# ============================================================
# CSI / POD / FAR
# ============================================================

def calculate_contingency(
    observed,
    predicted
):

    observed = np.asarray(
        observed
    ).astype(bool)

    predicted = np.asarray(
        predicted
    ).astype(bool)

    hits = np.sum(
        observed & predicted
    )

    false_alarms = np.sum(
        (~observed) & predicted
    )

    misses = np.sum(
        observed & (~predicted)
    )

    return hits, false_alarms, misses


def calculate_scores(
    observed,
    predicted
):

    hits, false_alarms, misses = (
        calculate_contingency(
            observed,
            predicted
        )
    )

    csi_denominator = (
        hits
        + false_alarms
        + misses
    )

    pod_denominator = (
        hits
        + misses
    )

    far_denominator = (
        hits
        + false_alarms
    )

    csi = (
        hits / csi_denominator
        if csi_denominator > 0
        else 0.0
    )

    pod = (
        hits / pod_denominator
        if pod_denominator > 0
        else 0.0
    )

    far = (
        false_alarms / far_denominator
        if far_denominator > 0
        else 0.0
    )

    ets = equitable_threat_score(
        observed,
        predicted
    )

    return csi, pod, far, ets


# ============================================================
# MAIN EVALUATION
# ============================================================

def evaluate():

    print("\n============================================================")
    print(" HELD-OUT TEST SET VERIFICATION")
    print("============================================================")

    # --------------------------------------------------------
    # Load test data
    # --------------------------------------------------------

    df = pd.read_csv(
        TEST_DATA
    )

    print(
        f"\nTest rows: {len(df):,}"
    )

    df = add_engineered_features(
        df
    )

    # --------------------------------------------------------
    # Load models
    # --------------------------------------------------------

    print("\nLoading models...")

    regime_bundle = joblib.load(
        REGIME_MODEL
    )

    correction_bundle = joblib.load(
        CORRECTION_MODEL
    )

    heavy_bundle = joblib.load(
        HEAVY_RAIN_MODEL
    )

    print("All models loaded.")

    # --------------------------------------------------------
    # REGIME
    # --------------------------------------------------------

    print(
        "\n[1] Predicting weather regimes..."
    )

    predicted_regimes = predict_regime(
        df,
        regime_bundle
    )

    df["predicted_regime"] = (
        predicted_regimes
    )

    # --------------------------------------------------------
    # CORRECTION
    # --------------------------------------------------------

    print(
        "\n[2] Predicting corrected rainfall..."
    )

    X_correction = build_correction_features(
        df,
        correction_bundle,
        predicted_regimes
    )

    correction_model = (
        correction_bundle["model"]
    )

    corrected_log = (
        correction_model.predict(
            X_correction
        )
    )

    corrected_rainfall = np.expm1(
        corrected_log
    )

    corrected_rainfall = np.maximum(
        corrected_rainfall,
        0
    )

    # --------------------------------------------------------
    # OBSERVED RAINFALL
    # --------------------------------------------------------

    observed = pd.to_numeric(
        df["observed_rainfall"],
        errors="coerce"
    )

    raw_nwp = pd.to_numeric(
        df["raw_nwp_rainfall"],
        errors="coerce"
    )

    valid = (
        observed.notna()
        & raw_nwp.notna()
    )

    observed = observed.loc[
        valid
    ]

    raw_nwp = raw_nwp.loc[
        valid
    ]

    corrected = pd.Series(
        corrected_rainfall,
        index=df.index
    ).loc[
        valid
    ]

    # --------------------------------------------------------
    # RAINFALL METRICS
    # --------------------------------------------------------

    raw_rmse = np.sqrt(
        mean_squared_error(
            observed,
            raw_nwp
        )
    )

    corrected_rmse = np.sqrt(
        mean_squared_error(
            observed,
            corrected
        )
    )

    raw_mae = mean_absolute_error(
        observed,
        raw_nwp
    )

    corrected_mae = mean_absolute_error(
        observed,
        corrected
    )

    # --------------------------------------------------------
    # Heavy rain threshold
    # --------------------------------------------------------

    threshold = 64.5

    observed_heavy = (
        observed >= threshold
    )

    corrected_heavy = (
        corrected >= threshold
    )

    raw_heavy = (
        raw_nwp >= threshold
    )

    # --------------------------------------------------------
    # Corrected rainfall scores
    # --------------------------------------------------------

    csi, pod, far, ets = calculate_scores(
        observed_heavy,
        corrected_heavy
    )

    raw_csi, raw_pod, raw_far, raw_ets = (
        calculate_scores(
            observed_heavy,
            raw_heavy
        )
    )

    # --------------------------------------------------------
    # HEAVY RAIN CLASSIFIER
    # --------------------------------------------------------

    print(
        "\n[3] Evaluating heavy rainfall classifier..."
    )

    X_heavy = build_heavy_rain_features(
        df,
        heavy_bundle
    )

    heavy_model = heavy_bundle[
        "model"
    ]

    heavy_probability = (
        heavy_model.predict_proba(
            X_heavy
        )[:, 1]
    )

    heavy_prediction = (
        heavy_probability >= 0.5
    ).astype(int)

    observed_heavy_int = (
        observed_heavy
        .astype(int)
        .to_numpy()
    )

    classifier_accuracy = (
        accuracy_score(
            observed_heavy_int,
            heavy_prediction[valid.to_numpy()]
        )
    )

    classifier_precision = (
        precision_score(
            observed_heavy_int,
            heavy_prediction[valid.to_numpy()],
            zero_division=0
        )
    )

    classifier_recall = (
        recall_score(
            observed_heavy_int,
            heavy_prediction[valid.to_numpy()],
            zero_division=0
        )
    )

    classifier_f1 = (
        f1_score(
            observed_heavy_int,
            heavy_prediction[valid.to_numpy()],
            zero_division=0
        )
    )

    classifier_auc = (
        roc_auc_score(
            observed_heavy_int,
            heavy_probability[valid.to_numpy()]
        )
    )

    # --------------------------------------------------------
    # OUTPUT
    # --------------------------------------------------------

    print("\n============================================================")
    print(" FINAL TEST SET RESULTS")
    print("============================================================")

    print("\nRAIN FALL CORRECTION")
    print("--------------------------------")
    print(
        f"Raw GFS RMSE       : {raw_rmse:.4f}"
    )
    print(
        f"Corrected RMSE     : {corrected_rmse:.4f}"
    )
    print(
        f"Raw GFS MAE        : {raw_mae:.4f}"
    )
    print(
        f"Corrected MAE      : {corrected_mae:.4f}"
    )

    print("\nHEAVY RAIN EVENT")
    print("--------------------------------")
    print(
        f"Threshold          : {threshold} mm/day"
    )
    print(
        f"Raw GFS CSI        : {raw_csi:.4f}"
    )
    print(
        f"Corrected CSI      : {csi:.4f}"
    )
    print(
        f"Raw GFS POD        : {raw_pod:.4f}"
    )
    print(
        f"Corrected POD      : {pod:.4f}"
    )
    print(
        f"Raw GFS FAR        : {raw_far:.4f}"
    )
    print(
        f"Corrected FAR      : {far:.4f}"
    )
    print(
        f"Raw GFS ETS        : {raw_ets:.4f}"
    )
    print(
        f"Corrected ETS      : {ets:.4f}"
    )

    print("\nHEAVY RAIN CLASSIFIER")
    print("--------------------------------")
    print(
        f"Accuracy           : {classifier_accuracy:.4f}"
    )
    print(
        f"Precision          : {classifier_precision:.4f}"
    )
    print(
        f"Recall             : {classifier_recall:.4f}"
    )
    print(
        f"F1 Score           : {classifier_f1:.4f}"
    )
    print(
        f"ROC-AUC            : {classifier_auc:.4f}"
    )

    # --------------------------------------------------------
    # Save verification results
    # --------------------------------------------------------

    results = {
        "raw_gfs_rmse": float(raw_rmse),
        "corrected_rmse": float(corrected_rmse),

        "raw_gfs_mae": float(raw_mae),
        "corrected_mae": float(corrected_mae),

        "raw_gfs_csi": float(raw_csi),
        "corrected_csi": float(csi),

        "raw_gfs_pod": float(raw_pod),
        "corrected_pod": float(pod),

        "raw_gfs_far": float(raw_far),
        "corrected_far": float(far),

        "raw_gfs_ets": float(raw_ets),
        "corrected_ets": float(ets),

        "heavy_accuracy": float(
            classifier_accuracy
        ),

        "heavy_precision": float(
            classifier_precision
        ),

        "heavy_recall": float(
            classifier_recall
        ),

        "heavy_f1": float(
            classifier_f1
        ),

        "heavy_roc_auc": float(
            classifier_auc
        ),
    }

        # --------------------------------------------------------
    # SAVE VERIFICATION RESULTS
    # --------------------------------------------------------

    results = {
        "success": True,

        "split": "test",

        "split_years": [2023],

        "n_samples": int(len(observed)),

        "threshold_mm": float(threshold),

        "metrics": {
            "raw_gfs_rmse": float(raw_rmse),
            "corrected_rmse": float(corrected_rmse),

            "raw_gfs_mae": float(raw_mae),
            "corrected_mae": float(corrected_mae),

            "raw_gfs_csi": float(raw_csi),
            "corrected_csi": float(csi),

            "raw_gfs_pod": float(raw_pod),
            "corrected_pod": float(pod),

            "raw_gfs_far": float(raw_far),
            "corrected_far": float(far),

            "raw_gfs_ets": float(raw_ets),
            "corrected_ets": float(ets),

            "heavy_accuracy": float(classifier_accuracy),
            "heavy_precision": float(classifier_precision),
            "heavy_recall": float(classifier_recall),
            "heavy_f1": float(classifier_f1),
            "heavy_roc_auc": float(classifier_auc),

            # FSS is not calculated by this evaluator.
            "raw_gfs_fss": None,
            "corrected_fss": None,
        },

        "heavy_rain": {
            "threshold_mm": float(threshold),
            "accuracy": float(classifier_accuracy),
            "precision": float(classifier_precision),
            "recall": float(classifier_recall),
            "f1": float(classifier_f1),
            "roc_auc": float(classifier_auc),
        },

        "created_at": pd.Timestamp.utcnow().isoformat(),

        "source": {
            "test_data": str(TEST_DATA),
            "regime_model": str(REGIME_MODEL),
            "correction_model": str(CORRECTION_MODEL),
            "heavy_rain_model": str(HEAVY_RAIN_MODEL),
        },
    }

    # --------------------------------------------------------
    # SAVE JSON NEXT TO ML PROJECT
    # --------------------------------------------------------

    verification_path = (
        Path(TEST_DATA).resolve().parents[1]
        / "verification_test.json"
    )

    verification_path.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    with open(
        verification_path,
        "w",
        encoding="utf-8"
    ) as file:
        json.dump(
            results,
            file,
            indent=2,
            ensure_ascii=False
        )

    print(
        f"\nVerification saved to:"
        f"\n{verification_path}"
    )

    print(
        "\nVerification completed successfully."
    )

    return results


if __name__ == "__main__":
    evaluate()
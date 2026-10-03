import joblib
import numpy as np
import pandas as pd

from sklearn.metrics import mean_squared_error, mean_absolute_error
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBRegressor

from config import (
    TRAIN_DATA,
    VAL_DATA,
    CORRECTION_MODEL,
    REGIME_MODEL,
)


# ============================================================
# FEATURES
# ============================================================

BASE_FEATURES = [
    "latitude",
    "longitude",

    # Raw NWP rainfall
    "raw_nwp_rainfall",

    # Atmospheric variables
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

    # Static geography
    "elevation",
    "slope",
    "dist_coast",

    # Time
    "month",
    "day_of_year",
    "sin_day",
    "cos_day",
    "is_monsoon",
]


# ============================================================
# NUMERIC CLEANING
# ============================================================

def clean_numeric(df, features):
    df = df.copy()

    for feature in features:
        if feature in df.columns:
            df[feature] = pd.to_numeric(
                df[feature],
                errors="coerce"
            )

    return df


# ============================================================
# LOAD REGIME MODEL
# ============================================================

def load_regime_model():
    print("\nLoading trained regime classifier...")

    bundle = joblib.load(REGIME_MODEL)

    model = bundle["model"]
    encoder = bundle["encoder"]
    regime_features = bundle["features"]

    print("Regime classifier loaded.")

    return model, encoder, regime_features


# ============================================================
# PREDICT REGIME
# ============================================================

def predict_regimes(
    df,
    regime_model,
    regime_encoder,
    regime_features
):
    available = [
        feature
        for feature in regime_features
        if feature in df.columns
    ]

    X = df[available].copy()

    X = clean_numeric(X, available)

    X = X.replace(
        [np.inf, -np.inf],
        np.nan
    )

    predictions = regime_model.predict(X)

    regime_names = regime_encoder.inverse_transform(
        predictions.astype(int)
    )

    return regime_names


# ============================================================
# MAIN TRAINING
# ============================================================

def train():

    print("\n==============================")
    print(" TRAINING RAINFALL CORRECTION")
    print("==============================")

    # --------------------------------------------------------
    # Load datasets
    # --------------------------------------------------------

    train_df = pd.read_csv(TRAIN_DATA)
    val_df = pd.read_csv(VAL_DATA)

    print(f"\nTraining rows   : {len(train_df):,}")
    print(f"Validation rows : {len(val_df):,}")

    # --------------------------------------------------------
    # Load trained regime classifier
    # --------------------------------------------------------

    regime_model, regime_encoder, regime_features = (
        load_regime_model()
    )

    # --------------------------------------------------------
    # Predict regime
    #
    # IMPORTANT:
    # We intentionally DO NOT use the ground-truth
    # regime_name column.
    # --------------------------------------------------------

    print("\nPredicting regimes for training data...")

    train_df["predicted_regime"] = predict_regimes(
        train_df,
        regime_model,
        regime_encoder,
        regime_features
    )

    print("Training regimes predicted.")

    print("\nPredicting regimes for validation data...")

    val_df["predicted_regime"] = predict_regimes(
        val_df,
        regime_model,
        regime_encoder,
        regime_features
    )

    print("Validation regimes predicted.")

    # --------------------------------------------------------
    # Features
    # --------------------------------------------------------

    available_features = [
        feature
        for feature in BASE_FEATURES
        if feature in train_df.columns
    ]

    missing_features = [
        feature
        for feature in BASE_FEATURES
        if feature not in train_df.columns
    ]

    print("\nUsing numeric features:")

    for feature in available_features:
        print(" -", feature)

    if missing_features:

        print("\nMissing features:")

        for feature in missing_features:
            print(" -", feature)

    # --------------------------------------------------------
    # Numeric conversion
    # --------------------------------------------------------

    train_df = clean_numeric(
        train_df,
        available_features
    )

    val_df = clean_numeric(
        val_df,
        available_features
    )

    # --------------------------------------------------------
    # One-hot encode predicted regime
    # --------------------------------------------------------

    print("\nEncoding predicted regimes...")

    encoder = OneHotEncoder(
        handle_unknown="ignore",
        sparse_output=False
    )

    train_regime = train_df[
        ["predicted_regime"]
    ]

    val_regime = val_df[
        ["predicted_regime"]
    ]

    regime_train_encoded = encoder.fit_transform(
        train_regime
    )

    regime_val_encoded = encoder.transform(
        val_regime
    )

    regime_columns = encoder.get_feature_names_out(
        ["predicted_regime"]
    )

    regime_train_df = pd.DataFrame(
        regime_train_encoded,
        columns=regime_columns,
        index=train_df.index
    )

    regime_val_df = pd.DataFrame(
        regime_val_encoded,
        columns=regime_columns,
        index=val_df.index
    )

    # --------------------------------------------------------
    # Construct X
    # --------------------------------------------------------

    X_train = pd.concat(
        [
            train_df[available_features].reset_index(drop=True),
            regime_train_df.reset_index(drop=True),
        ],
        axis=1
    )

    X_val = pd.concat(
        [
            val_df[available_features].reset_index(drop=True),
            regime_val_df.reset_index(drop=True),
        ],
        axis=1
    )

    # --------------------------------------------------------
    # Targets
    #
    # Target = observed rainfall
    # Input contains raw GFS rainfall.
    # --------------------------------------------------------

    y_train = pd.to_numeric(
        train_df["observed_rainfall"],
        errors="coerce"
    )

    y_val = pd.to_numeric(
        val_df["observed_rainfall"],
        errors="coerce"
    )

    # --------------------------------------------------------
    # Replace invalid values
    # --------------------------------------------------------

    X_train = X_train.replace(
        [np.inf, -np.inf],
        np.nan
    )

    X_val = X_val.replace(
        [np.inf, -np.inf],
        np.nan
    )

    # --------------------------------------------------------
    # XGBoost can handle NaN, but target cannot
    # --------------------------------------------------------

    train_valid = y_train.notna()
    val_valid = y_val.notna()

    X_train = X_train.loc[train_valid]
    y_train = y_train.loc[train_valid]

    X_val = X_val.loc[val_valid]
    y_val = y_val.loc[val_valid]

    # --------------------------------------------------------
    # Log target transformation
    #
    # Rainfall is highly skewed.
    # log1p makes extreme rainfall less dominant during
    # regression training.
    # --------------------------------------------------------

    y_train_log = np.log1p(
        np.maximum(y_train, 0)
    )

    # --------------------------------------------------------
    # Model
    # --------------------------------------------------------

    model = XGBRegressor(
        n_estimators=600,
        max_depth=8,
        learning_rate=0.04,

        subsample=0.85,
        colsample_bytree=0.85,

        min_child_weight=5,

        objective="reg:squarederror",

        eval_metric="rmse",

        random_state=42,

        tree_method="hist",
    )

    print("\nTraining XGBoost rainfall correction model...")

    model.fit(
        X_train,
        y_train_log,
        eval_set=[
            (
                X_val,
                np.log1p(
                    np.maximum(y_val, 0)
                )
            )
        ],
        verbose=False
    )

    # --------------------------------------------------------
    # Validation prediction
    # --------------------------------------------------------

    pred_log = model.predict(X_val)

    predictions = np.expm1(pred_log)

    predictions = np.maximum(
        predictions,
        0
    )

    # --------------------------------------------------------
    # Metrics
    # --------------------------------------------------------

    rmse = np.sqrt(
        mean_squared_error(
            y_val,
            predictions
        )
    )

    mae = mean_absolute_error(
        y_val,
        predictions
    )

    print("\n==============================")
    print(" RAINFALL CORRECTION RESULTS")
    print("==============================")

    print(f"Validation RMSE : {rmse:.4f}")
    print(f"Validation MAE  : {mae:.4f}")

    # --------------------------------------------------------
    # Compare raw NWP vs corrected rainfall
    # --------------------------------------------------------

    raw_nwp = pd.to_numeric(
        val_df.loc[
            val_valid,
            "raw_nwp_rainfall"
        ],
        errors="coerce"
    )

    raw_valid = raw_nwp.notna()

    raw_rmse = np.sqrt(
        mean_squared_error(
            y_val.loc[raw_valid],
            raw_nwp.loc[raw_valid]
        )
    )

    raw_mae = mean_absolute_error(
        y_val.loc[raw_valid],
        raw_nwp.loc[raw_valid]
    )

    print("\nRaw GFS baseline:")

    print(
        f"Raw GFS RMSE    : {raw_rmse:.4f}"
    )

    print(
        f"Raw GFS MAE     : {raw_mae:.4f}"
    )

    # --------------------------------------------------------
    # Save model bundle
    # --------------------------------------------------------

    bundle = {
        "model": model,
        "regime_encoder": encoder,
        "features": available_features,
        "regime_columns": regime_columns.tolist(),
        "target": "observed_rainfall",
        "target_transform": "log1p",
    }

    joblib.dump(
        bundle,
        CORRECTION_MODEL
    )

    print(
        f"\nCorrection model saved:\n{CORRECTION_MODEL}"
    )

    return bundle


if __name__ == "__main__":
    train()
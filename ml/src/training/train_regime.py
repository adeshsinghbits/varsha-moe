import joblib
import pandas as pd

from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (
    accuracy_score,
    classification_report,
)

from xgboost import XGBClassifier

from config import (
    TRAIN_DATA,
    VAL_DATA,
    REGIME_MODEL,
)


# =========================================================
# FEATURES
# =========================================================

FEATURES = [
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


def train():

    print(
        "\n=============================="
    )

    print(
        " TRAINING REGIME CLASSIFIER"
    )

    print(
        "=============================="
    )

    # =====================================================
    # LOAD
    # =====================================================

    train_df = pd.read_csv(
        TRAIN_DATA
    )

    val_df = pd.read_csv(
        VAL_DATA
    )

    print(
        f"\nTraining rows   : {len(train_df):,}"
    )

    print(
        f"Validation rows : {len(val_df):,}"
    )

    # =====================================================
    # CHECK TARGET
    # =====================================================

    if "regime" not in train_df.columns:

        raise ValueError(
            "'regime' target not found "
            "in training dataset."
        )

    # =====================================================
    # CHECK FEATURES
    # =====================================================

    available_features = [
        feature
        for feature in FEATURES
        if feature in train_df.columns
    ]

    missing_features = [
        feature
        for feature in FEATURES
        if feature not in train_df.columns
    ]

    print(
        "\nUsing features:"
    )

    for feature in available_features:
        print(
            " -",
            feature
        )

    if missing_features:

        print(
            "\nOptional/missing features:"
        )

        for feature in missing_features:
            print(
                " -",
                feature
            )

    if len(available_features) == 0:

        raise ValueError(
            "No valid ML features found."
        )

    # =====================================================
    # NUMERIC CONVERSION
    # =====================================================

    for feature in available_features:

        train_df[feature] = pd.to_numeric(
            train_df[feature],
            errors="coerce"
        )

        val_df[feature] = pd.to_numeric(
            val_df[feature],
            errors="coerce"
        )

    X_train = train_df[
        available_features
    ].astype(float)

    X_val = val_df[
        available_features
    ].astype(float)

    # =====================================================
    # HANDLE INF
    # =====================================================

    X_train = X_train.replace(
        [float("inf"), float("-inf")],
        float("nan")
    )

    X_val = X_val.replace(
        [float("inf"), float("-inf")],
        float("nan")
    )

    # =====================================================
    # LABEL ENCODING
    # =====================================================

    encoder = LabelEncoder()

    y_train = encoder.fit_transform(
        train_df["regime"].astype(str)
    )

    # Validate unknown validation labels
    unknown = set(
        val_df["regime"].astype(str)
    ) - set(
        encoder.classes_
    )

    if unknown:

        raise ValueError(
            "Validation contains unseen regimes: "
            f"{unknown}"
        )

    y_val = encoder.transform(
        val_df["regime"].astype(str)
    )

    print(
        "\nRegime classes:"
    )

    for index, name in enumerate(
        encoder.classes_
    ):

        print(
            f"{index}: {name}"
        )

    # =====================================================
    # MODEL
    # =====================================================

    model = XGBClassifier(

        n_estimators=400,

        max_depth=7,

        learning_rate=0.05,

        subsample=0.85,

        colsample_bytree=0.85,

        objective="multi:softprob",

        eval_metric="mlogloss",

        random_state=42,

        tree_method="hist",
    )

    # =====================================================
    # TRAIN
    # =====================================================

    print(
        "\nTraining XGBoost regime model..."
    )

    model.fit(
        X_train,
        y_train,
        eval_set=[
            (
                X_val,
                y_val
            )
        ],
        verbose=False,
    )

    # =====================================================
    # VALIDATION
    # =====================================================

    predictions = model.predict(
        X_val
    )

    accuracy = accuracy_score(
        y_val,
        predictions
    )

    print(
        f"\nValidation Accuracy: "
        f"{accuracy:.4f}"
    )

    print(
        "\nClassification Report:"
    )

    print(
        classification_report(
            y_val,
            predictions,
            target_names=encoder.classes_,
            zero_division=0,
        )
    )

    # =====================================================
    # SAVE
    # =====================================================

    bundle = {
        "model": model,
        "encoder": encoder,
        "features": available_features,
    }

    joblib.dump(
        bundle,
        REGIME_MODEL
    )

    print(
        f"\nRegime model saved:"
        f"\n{REGIME_MODEL}"
    )

    return bundle


if __name__ == "__main__":
    train()
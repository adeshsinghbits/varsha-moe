import joblib
import pandas as pd

from xgboost import XGBClassifier
from sklearn.metrics import (
    classification_report,
    roc_auc_score,
)

from config import (
    TRAIN_DATA,
    VAL_DATA,
    HEAVY_RAIN_MODEL,
    HEAVY_RAIN_THRESHOLD,
)


FEATURES = [
    "latitude",
    "longitude",
    "temperature",
    "humidity",
    "pressure",
    "wind_u",
    "wind_v",
    "wind_speed",
    "cape",
    "cin",
    "pwat",
    "elevation",
    "distance_coast",
    "raw_nwp_rainfall",
    "month",
    "day_of_year",
    "sin_day",
    "cos_day",
    "is_monsoon",
]


def train():

    train = pd.read_csv(
        TRAIN_DATA
    )

    val = pd.read_csv(
        VAL_DATA
    )

    available = [
        f for f in FEATURES
        if f in train.columns
    ]

    train["heavy_rain"] = (
        train["observed_rainfall"]
        >= HEAVY_RAIN_THRESHOLD
    ).astype(int)

    val["heavy_rain"] = (
        val["observed_rainfall"]
        >= HEAVY_RAIN_THRESHOLD
    ).astype(int)

    train = train.dropna(
        subset=available + ["heavy_rain"]
    )

    val = val.dropna(
        subset=available + ["heavy_rain"]
    )

    model = XGBClassifier(
        n_estimators=450,
        max_depth=7,
        learning_rate=0.05,
        subsample=0.85,
        colsample_bytree=0.85,
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=42,
        tree_method="hist",
    )

    model.fit(
        train[available],
        train["heavy_rain"],
        eval_set=[
            (
                val[available],
                val["heavy_rain"],
            )
        ],
        verbose=False,
    )

    probabilities = model.predict_proba(
        val[available]
    )[:, 1]

    predictions = (
        probabilities >= 0.5
    ).astype(int)

    print(
        classification_report(
            val["heavy_rain"],
            predictions,
            zero_division=0,
        )
    )

    if val["heavy_rain"].nunique() == 2:
        print(
            "ROC-AUC:",
            roc_auc_score(
                val["heavy_rain"],
                probabilities,
            ),
        )

    bundle = {
        "model": model,
        "features": available,
        "threshold": HEAVY_RAIN_THRESHOLD,
    }

    joblib.dump(
        bundle,
        HEAVY_RAIN_MODEL
    )

    print(
        f"Saved: {HEAVY_RAIN_MODEL}"
    )


if __name__ == "__main__":
    train()
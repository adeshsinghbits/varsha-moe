"""
Populate MongoDB with model-generated district forecasts and verification.

Run from the project root (after training):
    python scripts/seed_database.py

What it writes (all computed by the trained models, nothing invented):
  district_forecasts : one document per district-day of the held-out TEST split
                       (data/processed/test.csv) with raw NWP, AI-corrected
                       rainfall, regime, heavy-rain probability, and the
                       observed rainfall that exists in the dataset.
  verification       : one document produced by src.evaluation.verification
                       .evaluate() on the same test split, plus per-regime
                       RMSE/MAE computed here. FSS is NOT implemented in the
                       backend, so it is not stored.

Existing collections are replaced so the script is safe to re-run.
"""

import os
import sys
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "src"))

import numpy as np
import pandas as pd

from config import TEST_DATA, TEST_YEARS, TRAIN_YEARS, VALIDATION_YEARS
from database.mongodb import (
    check_database,
    district_forecasts_collection,
    verification_collection,
)
from inference.predict import BASE_FEATURES, MonsoonPredictor


def _clean(value):
    if value is None:
        return None
    if isinstance(value, (np.floating, float)):
        return float(value) if np.isfinite(value) else None
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.bool_):
        return bool(value)
    return value


def main():
    if not check_database():
        raise SystemExit("MongoDB is not reachable. Start MongoDB first.")

    df = pd.read_csv(TEST_DATA)
    df = df.dropna(subset=BASE_FEATURES).reset_index(drop=True)
    print(f"Test rows: {len(df):,}")

    predictor = MonsoonPredictor()
    pred = predictor.predict_batch(df)

    now = datetime.now(timezone.utc)
    docs = []
    for i in range(len(df)):
        row, p = df.iloc[i], pred.iloc[i]
        docs.append({k: _clean(v) for k, v in {
            "date": str(row["date"])[:10],
            "district_id": row.get("district_id"),
            "district_name": row["district_name"],
            "state_name": row.get("state_name"),
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "raw_rainfall": p["raw_nwp_rainfall"],
            "corrected_rainfall": p["corrected_rainfall"],
            "bias_correction": p["bias_correction"],
            "observed_rainfall": row.get("observed_rainfall"),
            "regime": p["predicted_regime"],
            "regime_probability": p["regime_probability"],
            "heavy_rain": p["heavy_rain"],
            "heavy_rain_probability": p["heavy_rain_probability"],
            "split": "test",
            "created_at": now,
        }.items()})

    district_forecasts_collection.delete_many({})
    district_forecasts_collection.insert_many(docs)
    district_forecasts_collection.create_index([("date", -1)])
    district_forecasts_collection.create_index("district_name")
    district_forecasts_collection.create_index("regime")
    print(f"Inserted {len(docs):,} district forecasts")

    # ---- verification -------------------------------------------------
    from evaluation.verification import evaluate

    results = evaluate()

    obs = df["observed_rainfall"].to_numpy(dtype=float)
    by_regime = {}
    for regime, idx in pd.Series(pred["predicted_regime"]).groupby(
        pred["predicted_regime"]
    ).groups.items():
        idx = np.array(list(idx))
        raw = pred["raw_nwp_rainfall"].to_numpy()[idx]
        cor = pred["corrected_rainfall"].to_numpy()[idx]
        o = obs[idx]
        by_regime[regime] = {
            "n": int(len(idx)),
            "raw_rmse": float(np.sqrt(np.mean((raw - o) ** 2))),
            "corrected_rmse": float(np.sqrt(np.mean((cor - o) ** 2))),
            "raw_mae": float(np.mean(np.abs(raw - o))),
            "corrected_mae": float(np.mean(np.abs(cor - o))),
            "mean_bias_correction": float(np.mean(cor - raw)),
        }

    verification_collection.delete_many({})
    verification_collection.insert_one({
        "split": "test",
        "split_years": TEST_YEARS,
        "train_years": TRAIN_YEARS,
        "validation_years": VALIDATION_YEARS,
        "n_samples": int(len(df)),
        "metrics": results,
        "by_regime": by_regime,
        "created_at": now,
    })
    print("Verification stored (held-out test split).")


if __name__ == "__main__":
    main()

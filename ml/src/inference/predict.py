"""
VARSHA-MoE inference layer.

Design rules
------------
* Models are loaded from explicit bundle structures written by the training
  scripts (no recursive key hunting):
    regime_classifier.joblib  -> {"model", "encoder" (LabelEncoder), "features"}
    rainfall_corrector.joblib -> {"model", "regime_encoder" (OneHotEncoder),
                                  "regime_columns", ..., "target_transform"}
    heavy_rain_classifier.joblib -> {"model", "features", "threshold"}
* The encoders fitted at training time are reused. Nothing is fitted here.
* Regime names come from the trained LabelEncoder, never from a hand-written
  index -> name table.
* Every model receives a DataFrame whose columns are the training feature names.
"""

import math
import os

import joblib
import numpy as np
import pandas as pd


BASE_FEATURES = [
    "latitude", "longitude", "raw_nwp_rainfall",
    "u850", "v850", "wind_speed", "wind_speed_850",
    "vorticity_850", "q500", "cape", "olr", "olr_anomaly",
    "mslp_anomaly", "moisture_flux", "trough_latitude",
    "elevation", "slope", "dist_coast",
    "month", "day_of_year", "sin_day", "cos_day", "is_monsoon",
]

REQUIRED_BUNDLE_KEYS = {
    "regime_classifier.joblib": {"model", "encoder", "features"},
    "rainfall_corrector.joblib": {"model", "regime_encoder", "regime_columns"},
    "heavy_rain_classifier.joblib": {"model", "features"},
}


class InputValidationError(ValueError):
    """Raised for invalid model input (mapped to HTTP 422 by the API)."""


def _load_bundle(models_dir, filename):
    path = os.path.join(models_dir, filename)
    bundle = joblib.load(path)

    if not isinstance(bundle, dict):
        raise RuntimeError(
            f"{filename} must be a dict bundle, got {type(bundle).__name__}. "
            "Re-run the training script to regenerate it."
        )

    missing = REQUIRED_BUNDLE_KEYS[filename] - set(bundle)
    if missing:
        raise RuntimeError(
            f"{filename} is missing required keys {sorted(missing)}. "
            f"Found: {sorted(bundle)}"
        )

    return bundle


class MonsoonPredictor:

    def __init__(self):
        base_dir = os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        )
        models_dir = os.path.join(base_dir, "models")

        regime = _load_bundle(models_dir, "regime_classifier.joblib")
        correction = _load_bundle(models_dir, "rainfall_corrector.joblib")
        heavy = _load_bundle(models_dir, "heavy_rain_classifier.joblib")

        # Regime classifier (+ its own LabelEncoder and feature list)
        self.regime_model = regime["model"]
        self.regime_label_encoder = regime["encoder"]
        self.regime_features = list(regime["features"])

        # Rainfall corrector (+ the OneHotEncoder fitted during training)
        self.correction_model = correction["model"]
        self.regime_encoder = correction["regime_encoder"]
        self.regime_columns = list(correction["regime_columns"])
        self.target_transform = correction.get("target_transform", "log1p")

        if self.target_transform != "log1p":
            raise RuntimeError(
                f"Unsupported target_transform '{self.target_transform}'"
            )

        # Heavy-rain classifier
        self.heavy_model = heavy["model"]
        self.heavy_features = list(heavy["features"])
        self.heavy_threshold_mm = heavy.get("threshold")

        self.regime_names = [str(c) for c in self.regime_label_encoder.classes_]

        self._validate_feature_contracts()

    # ------------------------------------------------------------------
    # Startup consistency checks (fail loudly instead of mis-predicting)
    # ------------------------------------------------------------------

    def _validate_feature_contracts(self):
        unknown = [f for f in self.regime_features if f not in BASE_FEATURES]
        if unknown:
            raise RuntimeError(f"Regime features not in BASE_FEATURES: {unknown}")

        unknown = [f for f in self.heavy_features if f not in BASE_FEATURES]
        if unknown:
            raise RuntimeError(
                f"Heavy-rain features not in BASE_FEATURES: {unknown}"
            )

        expected = list(self.correction_model.get_booster().feature_names or [])
        if expected:
            provided = BASE_FEATURES + self.regime_columns
            missing = [f for f in expected if f not in provided]
            if missing:
                raise RuntimeError(
                    f"Corrector expects features the API cannot supply: {missing}"
                )
            self.correction_input_columns = expected
        else:
            self.correction_input_columns = BASE_FEATURES + self.regime_columns

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    @staticmethod
    def validate_input(data):
        missing = [f for f in BASE_FEATURES if f not in data]
        if missing:
            raise InputValidationError(f"Missing features: {missing}")

        clean = {}
        for feature in BASE_FEATURES:
            try:
                value = float(data[feature])
            except (TypeError, ValueError):
                raise InputValidationError(f"'{feature}' must be numeric")
            if not math.isfinite(value):
                raise InputValidationError(f"'{feature}' must be finite")
            clean[feature] = value

        if not 6.0 <= clean["latitude"] <= 38.0:
            raise InputValidationError("latitude outside the model domain (6-38)")
        if not 66.0 <= clean["longitude"] <= 98.0:
            raise InputValidationError("longitude outside the model domain (66-98)")
        if clean["raw_nwp_rainfall"] < 0:
            raise InputValidationError("raw_nwp_rainfall cannot be negative")

        return clean

    # ------------------------------------------------------------------
    # Feature frames (always DataFrames with training column names)
    # ------------------------------------------------------------------

    @staticmethod
    def _frame(clean):
        return pd.DataFrame([clean], columns=BASE_FEATURES)

    def _regime_frame(self, base):
        return base[self.regime_features]

    # ------------------------------------------------------------------
    # Regime
    # ------------------------------------------------------------------

    def _regime_from_frame(self, X):
        proba = self.regime_model.predict_proba(X)
        idx = np.argmax(proba, axis=1)
        # class index -> name via the trained LabelEncoder
        names = self.regime_label_encoder.inverse_transform(
            self.regime_model.classes_[idx]
            if hasattr(self.regime_model, "classes_") else idx
        )
        return [str(n) for n in names], proba[np.arange(len(idx)), idx]

    def predict_regime_with_probability(self, data):
        base = self._frame(self.validate_input(data))
        names, probs = self._regime_from_frame(self._regime_frame(base))
        return names[0], float(probs[0])

    def predict_regime(self, data):
        return self.predict_regime_with_probability(data)[0]

    # ------------------------------------------------------------------
    # Correction
    # ------------------------------------------------------------------

    def _correct_frame(self, base, regime_names):
        regime_df = pd.DataFrame({"predicted_regime": list(regime_names)})
        encoded = self.regime_encoder.transform(regime_df)
        if hasattr(encoded, "toarray"):
            encoded = encoded.toarray()

        X_regime = pd.DataFrame(
            encoded, columns=self.regime_columns, index=base.index
        )
        X = pd.concat([base, X_regime], axis=1)[self.correction_input_columns]

        log_pred = self.correction_model.predict(X)
        corrected = np.expm1(log_pred)
        return np.clip(corrected, 0.0, None)

    def predict_corrected_rainfall(self, data, predicted_regime):
        base = self._frame(self.validate_input(data))
        return float(self._correct_frame(base, [predicted_regime])[0])

    # ------------------------------------------------------------------
    # Heavy rain
    # ------------------------------------------------------------------

    def _heavy_frame(self, base):
        proba = self.heavy_model.predict_proba(base[self.heavy_features])[:, 1]
        return np.clip(proba, 0.0, 1.0)

    def predict_heavy_rain(self, data, corrected_rainfall=None):
        # corrected_rainfall kept for call-site compatibility; the trained
        # classifier does not use it as an input.
        base = self._frame(self.validate_input(data))
        probability = float(self._heavy_frame(base)[0])
        return {
            "heavy_rain": bool(probability >= 0.5),
            "heavy_rain_probability": probability,
        }

    # ------------------------------------------------------------------
    # Full pipeline
    # ------------------------------------------------------------------

    def predict(self, data):
        clean = self.validate_input(data)
        base = self._frame(clean)

        names, probs = self._regime_from_frame(self._regime_frame(base))
        corrected = float(self._correct_frame(base, names)[0])
        heavy_prob = float(self._heavy_frame(base)[0])
        raw = clean["raw_nwp_rainfall"]

        return {
            "predicted_regime": names[0],
            "regime_probability": float(probs[0]),
            "raw_nwp_rainfall": raw,
            "corrected_rainfall": corrected,
            "bias_correction": corrected - raw,
            "heavy_rain": bool(heavy_prob >= 0.5),
            "heavy_rain_probability": heavy_prob,
        }

    def predict_batch(self, df):
        """Vectorised pipeline for many rows (used by the seeding script)."""
        base = df[BASE_FEATURES].astype(float).reset_index(drop=True)
        names, probs = self._regime_from_frame(self._regime_frame(base))
        corrected = self._correct_frame(base, names)
        heavy = self._heavy_frame(base)
        raw = base["raw_nwp_rainfall"].to_numpy()

        return pd.DataFrame({
            "predicted_regime": names,
            "regime_probability": probs,
            "raw_nwp_rainfall": raw,
            "corrected_rainfall": corrected,
            "bias_correction": corrected - raw,
            "heavy_rain": heavy >= 0.5,
            "heavy_rain_probability": heavy,
        })

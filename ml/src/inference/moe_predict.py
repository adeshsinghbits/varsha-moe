from pathlib import Path

import joblib
import numpy as np
import pandas as pd


SRC_ROOT = Path(__file__).resolve().parents[1]
ML_ROOT = SRC_ROOT.parent

MOE_BUNDLE = (
    ML_ROOT
    / "models"
    / "moe"
    / "moe_bundle.joblib"
)


def add_engineered_features(
    payload: dict,
) -> pd.DataFrame:

    df = pd.DataFrame([payload])

    if "date" in df.columns:

        date = pd.to_datetime(
            df["date"],
            errors="coerce"
        )

        df["month"] = date.dt.month
        df["day_of_year"] = date.dt.dayofyear

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

    if "raw_nwp_rainfall" not in df.columns:

        if "raw_nwp_d1" in df.columns:

            df["raw_nwp_rainfall"] = (
                df["raw_nwp_d1"]
            )

    if (
        "u850" in df.columns
        and "v850" in df.columns
    ):

        u = pd.to_numeric(
            df["u850"],
            errors="coerce"
        )

        v = pd.to_numeric(
            df["v850"],
            errors="coerce"
        )

        df["wind_speed"] = np.sqrt(
            np.square(u)
            + np.square(v)
        )

    return df


class VARSHAMoE:

    def __init__(
        self,
        bundle_path=MOE_BUNDLE,
    ):

        self.bundle = joblib.load(
            bundle_path
        )

        self.experts = (
            self.bundle["experts"]
        )

        self.regimes = (
            self.bundle["regimes"]
        )

        self.features = (
            self.bundle["features"]
        )

        self.gate_model = (
            self.bundle["gate_model"]
        )

        self.gate_features = (
            self.bundle["gate_features"]
        )

        self.gate_classes = (
            self.bundle["gate_classes"]
        )

    def _prepare(
        self,
        df: pd.DataFrame,
        features,
    ):

        missing = [
            col
            for col in features
            if col not in df.columns
        ]

        if missing:

            raise ValueError(
                f"Missing features: {missing}"
            )

        X = (
            df[features]
            .replace(
                [np.inf, -np.inf],
                np.nan
            )
            .fillna(0)
            .astype(float)
        )

        return X

    def predict(
        self,
        payload: dict,
    ):

        df = add_engineered_features(
            payload
        )

        # ----------------------------------------------------
        # Gate
        # ----------------------------------------------------

        X_gate = self._prepare(
            df,
            self.gate_features
        )

        gate_prob = (
            self.gate_model
            .predict_proba(X_gate)[0]
        )

        gate_classes = (
            self.gate_model.classes_
        )

        # ----------------------------------------------------
        # Expert predictions
        # ----------------------------------------------------

        expert_predictions: dict[str, float] = {}

        for regime, expert in (
            self.experts.items()
        ):

            X_expert = self._prepare(
                df,
                self.features
            )

            prediction = expert.predict(
                X_expert
            )[0]

            prediction = np.expm1(
                prediction
            )

            prediction = max(
                0.0,
                float(prediction)
            )

            expert_predictions[
                regime
            ] = prediction

        # ----------------------------------------------------
        # Probability-weighted blending
        # ----------------------------------------------------

        weights: dict[str, float] = {}

        for i, regime in enumerate(
            gate_classes
        ):

            regime = str(regime)

            if regime in expert_predictions:

                weights[regime] = float(
                    gate_prob[i]
                )

        total_weight = sum(
            weights.values()
        )

        if total_weight <= 0:

            raise RuntimeError(
                "No valid expert received "
                "a gate probability."
            )

        weights = {
            regime: weight / total_weight
            for regime, weight
            in weights.items()
        }

        corrected_rainfall = sum(
            weights[regime]
            * expert_predictions[regime]
            for regime in weights
        )

        # ----------------------------------------------------
        # Dominant regime
        # ----------------------------------------------------

        dominant_regime = max(
            weights.items(),
            key=lambda item: item[1]
        )[0]

        return {
            "corrected_rainfall_mm": round(
                corrected_rainfall,
                3
            ),
            "dominant_regime": (
                dominant_regime
            ),
            "regime_probabilities": {
                regime: round(
                    float(weight),
                    6
                )
                for regime, weight
                in weights.items()
            },
            "expert_predictions": {
                regime: round(
                    value,
                    3
                )
                for regime, value
                in expert_predictions.items()
            },
        }


_predictor = None


def get_moe_predictor():

    global _predictor

    if _predictor is None:

        _predictor = VARSHAMoE()

    return _predictor


def predict_moe(payload: dict):

    predictor = get_moe_predictor()

    return predictor.predict(
        payload
    )
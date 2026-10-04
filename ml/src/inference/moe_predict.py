from pathlib import Path
import joblib
import numpy as np
import pandas as pd

SRC_ROOT = Path(__file__).resolve().parents[1]
ML_ROOT = SRC_ROOT.parent
MOE_BUNDLE = ML_ROOT / "models" / "moe" / "moe_bundle.joblib"


def add_engineered_features(payload: dict) -> pd.DataFrame:
    df = pd.DataFrame([payload])

    if "date" in df.columns:
        date = pd.to_datetime(df["date"], errors="coerce")
        df["month"] = date.dt.month
        df["day_of_year"] = date.dt.dayofyear
        df["sin_day"] = np.sin(2 * np.pi * df["day_of_year"] / 365.25)
        df["cos_day"] = np.cos(2 * np.pi * df["day_of_year"] / 365.25)
        df["is_monsoon"] = df["month"].between(6, 9).astype(int)

    if "raw_nwp_rainfall" not in df.columns and "raw_nwp_d1" in df.columns:
        df["raw_nwp_rainfall"] = df["raw_nwp_d1"]

    if "u850" in df.columns and "v850" in df.columns:
        u = pd.to_numeric(df["u850"], errors="coerce")
        v = pd.to_numeric(df["v850"], errors="coerce")
        df["wind_speed"] = np.sqrt(np.square(u) + np.square(v))
        df["wind_speed_850"] = df["wind_speed"]

    return df


class VARSHAMoE:
    def __init__(self, bundle_path=MOE_BUNDLE):
        if not Path(bundle_path).exists():
            raise FileNotFoundError(f"MoE bundle not found: {bundle_path}")

        self.bundle = joblib.load(bundle_path)
        self.experts = self.bundle["experts"]
        self.regimes = [str(r).strip() for r in self.bundle["regimes"]]
        self.features = self.bundle["features"]
        self.gate_model = self.bundle["gate_model"]
        self.gate_features = self.bundle["gate_features"]
        self.gate_classes = self.bundle.get("gate_classes", self.gate_model.classes_)
        self.expert_keys = {str(k).strip(): k for k in self.experts.keys()}

        print("==============================================")
        print("VARSHA-MoE loaded")
        print("Gate classes:", list(self.gate_model.classes_))
        print("Bundle gate classes:", list(self.gate_classes))
        print("Regimes:", self.regimes)
        print("Expert keys:", list(self.experts.keys()))
        print("==============================================")

    def _prepare(self, df, features):
        missing = [col for col in features if col not in df.columns]
        if missing:
            raise ValueError(f"Missing features: {missing}")
        return (
            df[features]
            .replace([np.inf, -np.inf], np.nan)
            .fillna(0)
            .astype(float)
        )

    def _build_gate_mapping(self, gate_classes):
        # Case 1: gate labels already match expert/regime names.
        mapping = {}
        for gate_class in gate_classes:
            gate_name = str(gate_class).strip()
            if gate_name in self.expert_keys:
                mapping[gate_class] = gate_name

        if len(mapping) == len(gate_classes):
            return mapping

        # Case 2: encoded classes (0,1,2,...) map by saved regime order.
        if len(gate_classes) == len(self.regimes):
            return {
                gate_class: self.regimes[index]
                for index, gate_class in enumerate(gate_classes)
            }

        raise RuntimeError(
            "Unable to map gate classes to regime experts. "
            f"Gate classes={list(gate_classes)}, "
            f"regimes={self.regimes}, "
            f"experts={list(self.experts.keys())}"
        )

    def predict(self, payload: dict):
        df = add_engineered_features(payload)

        # 1. Soft gate
        X_gate = self._prepare(df, self.gate_features)
        gate_prob = self.gate_model.predict_proba(X_gate)[0]
        gate_classes = self.gate_model.classes_
        gate_mapping = self._build_gate_mapping(gate_classes)

        # 2. Expert predictions
        expert_predictions = {}
        for regime_name, expert_key in self.expert_keys.items():
            expert = self.experts[expert_key]
            X_expert = self._prepare(df, self.features)
            prediction = expert.predict(X_expert)[0]

            # Keep this only if expert training used log1p(target).
            prediction = np.expm1(prediction)
            prediction = max(0.0, float(prediction))
            expert_predictions[regime_name] = prediction

        # 3. Gate probability -> expert weights
        weights = {}
        for index, gate_class in enumerate(gate_classes):
            regime = gate_mapping.get(gate_class)
            if regime is None:
                continue
            regime = str(regime).strip()
            if regime in expert_predictions:
                weights[regime] = float(gate_prob[index])

        total_weight = sum(weights.values())
        if total_weight <= 0:
            raise RuntimeError(
                "No valid expert received a gate probability. "
                f"Gate classes={list(gate_classes)}, "
                f"Gate mapping={gate_mapping}, "
                f"Regimes={self.regimes}, "
                f"Experts={list(expert_predictions.keys())}"
            )

        # 4. Normalize probabilities
        weights = {
            regime: weight / total_weight
            for regime, weight in weights.items()
        }

        # 5. Probability-weighted MoE blend
        corrected_rainfall = sum(
            weights[regime] * expert_predictions[regime]
            for regime in weights
        )

        dominant_regime = max(weights.items(), key=lambda item: item[1])[0]

        return {
            "corrected_rainfall_mm": round(corrected_rainfall, 3),
            "dominant_regime": dominant_regime,
            "regime_probabilities": {
                regime: round(float(weight), 6)
                for regime, weight in weights.items()
            },
            "expert_predictions": {
                regime: round(float(value), 3)
                for regime, value in expert_predictions.items()
            },
        }


_predictor = None


def get_moe_predictor():
    global _predictor
    if _predictor is None:
        _predictor = VARSHAMoE()
    return _predictor


def predict_moe(payload: dict):
    return get_moe_predictor().predict(payload)

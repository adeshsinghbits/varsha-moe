# VARSHA-MoE 🌧️

### Regime-Aware AI Post-Processing of Monsoon Rainfall Forecasts

> **SIH 2026 | Problem Statement ID: 26080 | Team ID: 171211**

VARSHA-MoE is an AI-based rainfall post-processing system designed to improve numerical weather prediction (NWP) rainfall forecasts by adapting the correction process to different monsoon weather regimes.

Instead of applying one correction model to every weather situation, VARSHA-MoE uses a **soft-gated Mixture-of-Experts (MoE)** architecture. A regime gate estimates the probability of different atmospheric regimes, multiple regime-specific experts generate rainfall predictions, and their outputs are combined using probability-weighted blending.

The system provides a web-based dashboard for rainfall forecasts, regime information, verification metrics, district-level analysis, and model outputs.

---

## 🚀 Key Features

- 🌦️ Regime-aware rainfall post-processing
- 🧠 Soft-gated Mixture-of-Experts architecture
- 📊 Regime probability estimation
- 🤖 Multiple regime-specific rainfall experts
- 🔀 Probability-weighted expert blending
- 🌧️ Heavy-rain classification
- 📍 District-level rainfall analysis
- 📈 Forecast verification and historical analysis
- ⚡ FastAPI inference backend
- 💻 Interactive React dashboard
- 🔌 REST API architecture
- 📦 Serialized ML models using Joblib

---

# 🏗️ System Architecture

```text
                         ┌──────────────────────────┐
                         │       React Frontend     │
                         │      VARSHA Dashboard    │
                         └────────────┬─────────────┘
                                      │
                                      │ REST API
                                      ▼
                         ┌──────────────────────────┐
                         │        FastAPI           │
                         │      Inference API       │
                         └────────────┬─────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────┐
                    │          VARSHA-MoE             │
                    │                                 │
                    │       Atmospheric Input        │
                    │              │                  │
                    │              ▼                  │
                    │        ┌────────────┐           │
                    │        │ Regime Gate│           │
                    │        └──────┬─────┘           │
                    │               │                  │
                    │       Regime Probabilities      │
                    │               │                  │
                    │      ┌────────┼────────┐         │
                    │      ▼        ▼        ▼         │
                    │   Expert 1 Expert 2 ... Expert N│
                    │      │        │        │         │
                    │      └────────┼────────┘         │
                    │               ▼                  │
                    │    Probability-Weighted Blend   │
                    │               │                  │
                    │               ▼                  │
                    │      Corrected Rainfall         │
                    │               │                  │
                    │               ▼                  │
                    │       Heavy Rain Model          │
                    └─────────────────────────────────┘
```
## 🎥 Demo Video

Watch the complete working demonstration of **VARSHA-MoE**:

[![VARSHA-MoE Demo](https://img.youtube.com/vi/Hs5rVmUrfQY/maxresdefault.jpg)](https://youtu.be/ulZbJ8Q5suw)

▶️ **[Watch Demo on YouTube](https://youtu.be/ulZbJ8Q5suw)**
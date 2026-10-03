from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]

DATA_DIR = ROOT_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
MODEL_DIR = ROOT_DIR / "models"

DISTRICT_DATA = RAW_DIR / "district_daily.parquet"
REGIME_DATA = RAW_DIR / "regime_labels.csv"

MASTER_DATA = PROCESSED_DIR / "master_dataset.csv"
TRAIN_DATA = PROCESSED_DIR / "train.csv"
VAL_DATA = PROCESSED_DIR / "validation.csv"
TEST_DATA = PROCESSED_DIR / "test.csv"

REGIME_MODEL = MODEL_DIR / "regime_classifier.joblib"
CORRECTION_MODEL = MODEL_DIR / "rainfall_corrector.joblib"
HEAVY_RAIN_MODEL = MODEL_DIR / "heavy_rain_classifier.joblib"

HEAVY_RAIN_THRESHOLD = 64.5

# Temporal split for the REAL IMD-observation + NOAA-GFS archive
# (June-September 2021-2025; see data/raw/dataset_metadata.json).
# The previous 2016-2023 split described the old synthetic archive and leaves
# TRAIN empty on the real data. Split adopted from the MonsoonIQ reference
# project: fit on 2021-2022, tune on 2023, report on held-out 2024-2025.
# Nothing from the test seasons may be used for fitting, thresholds or climatologies.
TRAIN_YEARS = [2016, 2017, 2018, 2019, 2020]
VALIDATION_YEARS = [2021, 2022]
TEST_YEARS = [2023]

DATASET_METADATA = RAW_DIR / "dataset_metadata.json"
CASE_REPLAYS = RAW_DIR / "case_replays.json"

REGIMES = [
    "Active Monsoon",
    "Break Monsoon",
    "Monsoon Low/Depression",
    "Orographic",
    "Coastal",
    "Western Disturbance",
    "Weak/Normal",
]

PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
MODEL_DIR.mkdir(parents=True, exist_ok=True)
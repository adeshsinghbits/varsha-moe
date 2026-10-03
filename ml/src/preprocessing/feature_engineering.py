import numpy as np
import pandas as pd


def find_column(df, candidates, required=True):
    """
    Find the first matching column from a list of candidates.
    """
    columns = set(df.columns)

    for candidate in candidates:
        candidate = candidate.lower()

        if candidate in columns:
            return candidate

    if required:
        raise ValueError(
            "\nRequired column not found.\n"
            f"Tried: {candidates}\n"
            f"Available columns:\n{list(df.columns)}"
        )

    return None


def detect_columns(df):
    """
    Detect columns from the REAL IMD + GFS district dataset.
    """

    mapping = {
        "date": "date",
        "district": "district_name",

        # Observed IMD rainfall
        "rainfall": "obs_rain_mean",

        # GFS Day-1 rainfall
        "gfs_rainfall": "raw_nwp_d1",

        # Location
        "latitude": "latitude",
        "longitude": "longitude",

        # Atmospheric variables
        "temperature": None,
        "humidity": None,
        "pressure": "mslp_anomaly",

        # Wind
        "wind_u": "u850",
        "wind_v": "v850",

        "cape": "cape",
        "cin": None,

        # Moisture
        "pwat": "q500",

        # Terrain
        "elevation": "elevation",
        "distance_coast": "dist_coast",
    }

    # Validate required columns
    required_keys = [
        "date",
        "district",
        "rainfall",
        "gfs_rainfall",
    ]

    missing = []

    for key in required_keys:
        column = mapping[key]

        if column not in df.columns:
            missing.append(
                f"{key} -> {column}"
            )

    if missing:
        raise ValueError(
            "\nMissing required dataset columns:\n"
            + "\n".join(missing)
        )

    return mapping


def engineer_features(df):
    """
    Create ML-ready features from the REAL district dataset.
    """

    df = df.copy()

    columns = detect_columns(df)

    print("\nDetected columns:")

    for key, value in columns.items():
        print(
            f"{key:20s} -> {value}"
        )

    # =========================================================
    # DATE
    # =========================================================

    date_col = columns["date"]

    df[date_col] = pd.to_datetime(
        df[date_col],
        errors="coerce"
    )

    df = df.dropna(
        subset=[date_col]
    )

    # =========================================================
    # TIME FEATURES
    # =========================================================

    df["year"] = df[date_col].dt.year

    df["month"] = df[date_col].dt.month

    df["day_of_year"] = (
        df[date_col].dt.dayofyear
    )

    df["sin_day"] = np.sin(
        2 * np.pi * df["day_of_year"] / 365.25
    )

    df["cos_day"] = np.cos(
        2 * np.pi * df["day_of_year"] / 365.25
    )

    df["is_monsoon"] = (
        df["month"].between(6, 9)
    ).astype(int)

    # =========================================================
    # WIND
    # =========================================================

    if (
        columns["wind_u"] is not None
        and columns["wind_v"] is not None
    ):

        u = pd.to_numeric(
            df[columns["wind_u"]],
            errors="coerce"
        )

        v = pd.to_numeric(
            df[columns["wind_v"]],
            errors="coerce"
        )

        df["wind_speed"] = np.sqrt(
            u ** 2 + v ** 2
        )

    else:

        df["wind_speed"] = np.nan

    # =========================================================
    # TARGET: OBSERVED RAINFALL
    # =========================================================

    df["observed_rainfall"] = pd.to_numeric(
        df[columns["rainfall"]],
        errors="coerce"
    )

    # =========================================================
    # RAW NWP RAINFALL
    # =========================================================

    df["raw_nwp_rainfall"] = pd.to_numeric(
        df[columns["gfs_rainfall"]],
        errors="coerce"
    )

    # =========================================================
    # HEAVY RAIN
    # IMD threshold: >= 64.5 mm/day
    # =========================================================

    df["heavy_rain"] = (
        df["observed_rainfall"] >= 64.5
    ).astype(int)

    # =========================================================
    # FORCE NUMERIC FEATURES
    # =========================================================

    numeric_features = [
        "latitude",
        "longitude",

        "raw_nwp_rainfall",
        "observed_rainfall",

        "wind_speed",

        "cape",
        "elevation",

        "month",
        "day_of_year",

        "sin_day",
        "cos_day",

        "is_monsoon",

        # Real atmospheric features
        "u850",
        "v850",
        "wind_speed_850",
        "vorticity_850",
        "q500",
        "olr",
        "olr_anomaly",
        "mslp_anomaly",
        "moisture_flux",
        "trough_latitude",
        "slope",
        "dist_coast",
    ]

    for column in numeric_features:

        if column in df.columns:

            df[column] = pd.to_numeric(
                df[column],
                errors="coerce"
            )

    # =========================================================
    # YEAR
    # =========================================================

    df["year"] = pd.to_numeric(
        df["year"],
        errors="coerce"
    )

    return df, columns
import pandas as pd

from config import (
    DISTRICT_DATA,
    MASTER_DATA,
    TRAIN_DATA,
    VAL_DATA,
    TEST_DATA,
    TRAIN_YEARS,
    VALIDATION_YEARS,
    TEST_YEARS,
)

from preprocessing.load_real_dataset import (
    load_district_dataset,
    normalize_column_names,
)

from preprocessing.feature_engineering import (
    engineer_features,
)


def prepare():

    print("\nLoading REAL IMD + GFS dataset...")

    # =========================================================
    # STEP 1: LOAD DATA
    # =========================================================

    df = load_district_dataset(
        DISTRICT_DATA
    )

    df = normalize_column_names(
        df
    )

    # =========================================================
    # STEP 2: FEATURE ENGINEERING
    # =========================================================

    print("\nEngineering features...")

    df, columns = engineer_features(
        df
    )

    # =========================================================
    # STEP 3: ENSURE DATE/YEAR
    # =========================================================

    df["date"] = pd.to_datetime(
        df["date"],
        errors="coerce"
    )

    df = df.dropna(
        subset=["date"]
    )

    # Always derive year from date
    # instead of trusting an existing year column.

    df["year"] = (
        df["date"]
        .dt.year
        .astype(int)
    )

    print("\nYear distribution:")

    print(
        df["year"]
        .value_counts()
        .sort_index()
    )

    # =========================================================
    # STEP 4: REGIME
    # =========================================================

    if "regime_name" not in df.columns:

        raise ValueError(
            "\n'regime_name' column is missing "
            "from district_daily dataset."
        )

    print(
        "\nUsing regime labels already present "
        "in district_daily dataset."
    )

    print("\nRegime distribution:")

    print(
        df["regime_name"]
        .value_counts(
            dropna=False
        )
    )

    # Human-readable regime target
    df["regime"] = (
        df["regime_name"]
        .fillna("Weak/Normal")
        .astype(str)
        .str.strip()
    )

    # =========================================================
    # STEP 5: RAINFALL TARGET
    # =========================================================

    df["observed_rainfall"] = pd.to_numeric(
        df["observed_rainfall"],
        errors="coerce"
    )

    df["raw_nwp_rainfall"] = pd.to_numeric(
        df["raw_nwp_rainfall"],
        errors="coerce"
    )

    # Remove rows without target/NWP
    df = df.dropna(
        subset=[
            "observed_rainfall",
            "raw_nwp_rainfall",
        ]
    )

    # =========================================================
    # STEP 6: DISTRICT NAME
    # =========================================================

    if "district_name" not in df.columns:

        raise ValueError(
            "\n'district_name' column is missing."
        )

    # =========================================================
    # STEP 7: SORT
    # =========================================================

    df = df.sort_values(
        [
            "date",
            "district_name",
        ]
    ).reset_index(
        drop=True
    )

    # =========================================================
    # STEP 8: MASTER DATASET
    # =========================================================

    print(
        "\nSaving master dataset..."
    )

    df.to_csv(
        MASTER_DATA,
        index=False
    )

    # =========================================================
    # STEP 9: YEAR SPLIT
    # =========================================================

    train = df[
        df["year"].isin(
            TRAIN_YEARS
        )
    ].copy()

    validation = df[
        df["year"].isin(
            VALIDATION_YEARS
        )
    ].copy()

    test = df[
        df["year"].isin(
            TEST_YEARS
        )
    ].copy()

    # =========================================================
    # STEP 10: CHECK SPLITS
    # =========================================================

    print("\n==============================")
    print(" DATASET SPLIT")
    print("==============================")

    print(
        f"Train      : {len(train):,}"
    )

    print(
        f"Validation : {len(validation):,}"
    )

    print(
        f"Test       : {len(test):,}"
    )

    if len(train) == 0:
        raise ValueError(
            "Training dataset is empty."
        )

    if len(validation) == 0:
        raise ValueError(
            "Validation dataset is empty. "
            f"Expected years: {VALIDATION_YEARS}"
        )

    if len(test) == 0:
        raise ValueError(
            "Test dataset is empty. "
            f"Expected years: {TEST_YEARS}"
        )

    # =========================================================
    # STEP 11: SAVE SPLITS
    # =========================================================

    train.to_csv(
        TRAIN_DATA,
        index=False
    )

    validation.to_csv(
        VAL_DATA,
        index=False
    )

    test.to_csv(
        TEST_DATA,
        index=False
    )

    # =========================================================
    # FINAL SUMMARY
    # =========================================================

    print("\n==============================")
    print(" DATASET PREPARATION COMPLETE")
    print("==============================")

    print(
        f"\nMaster dataset : {len(df):,}"
    )

    print(
        f"Train          : {len(train):,}"
    )

    print(
        f"Validation     : {len(validation):,}"
    )

    print(
        f"Test           : {len(test):,}"
    )

    print("\nYears:")

    print(
        "Train:",
        sorted(
            train["year"]
            .unique()
            .tolist()
        )
    )

    print(
        "Validation:",
        sorted(
            validation["year"]
            .unique()
            .tolist()
        )
    )

    print(
        "Test:",
        sorted(
            test["year"]
            .unique()
            .tolist()
        )
    )

    print("\nRegime distribution:")

    print(
        df["regime"]
        .value_counts()
    )

    print(
        "\nDataset preparation "
        "finished successfully."
    )


if __name__ == "__main__":
    prepare()
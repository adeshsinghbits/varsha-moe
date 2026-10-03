import pandas as pd
from pathlib import Path


def load_district_dataset(path: str | Path) -> pd.DataFrame:
    path = Path(path)

    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")

    if path.suffix == ".parquet":
        df = pd.read_parquet(path)

    elif path.name.endswith(".csv.gz"):
        df = pd.read_csv(path, compression="gzip")

    elif path.suffix == ".csv":
        df = pd.read_csv(path)

    else:
        raise ValueError(
            f"Unsupported dataset format: {path.suffix}"
        )

    print("\nDataset loaded")
    print(f"Rows: {len(df):,}")
    print(f"Columns: {len(df.columns)}")

    print("\nColumns:")
    for col in df.columns:
        print(" -", col)

    return df


def normalize_column_names(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    new_columns = []

    for column in df.columns:
        name = str(column)
        name = name.strip()
        name = name.lower()
        name = name.replace(" ", "_")
        name = name.replace("-", "_")
        name = name.replace("/", "_")
        name = name.replace("(", "")
        name = name.replace(")", "")
        new_columns.append(name)

    df.columns = new_columns

    return df

def print_dataset_summary(df: pd.DataFrame):
    print("\n========== DATASET SUMMARY ==========")

    print("Shape:", df.shape)

    print("\nDtypes:")
    print(df.dtypes)

    print("\nMissing values:")
    print(df.isna().sum().sort_values(ascending=False).head(20))

    print("\nSample:")
    print(df.head())
"""Temporal-split integrity checks (adapted from MonsoonIQ tests/test_leakage.py)."""
import os, sys
import pandas as pd
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src"))
from config import TRAIN_YEARS, VALIDATION_YEARS, TEST_YEARS, TRAIN_DATA, VAL_DATA, TEST_DATA


def test_year_sets_are_disjoint_and_ordered():
    tr, va, te = set(TRAIN_YEARS), set(VALIDATION_YEARS), set(TEST_YEARS)
    assert not (tr & va) and not (tr & te) and not (va & te)
    assert max(tr) < min(va) <= max(va) < min(te)


@pytest.mark.skipif(not (TRAIN_DATA.exists() and VAL_DATA.exists() and TEST_DATA.exists()),
                    reason="processed splits not built yet (run prepare_dataset.py)")
def test_processed_splits_respect_years():
    train, val, test = (pd.read_csv(p, usecols=["date"]) for p in (TRAIN_DATA, VAL_DATA, TEST_DATA))
    for df in (train, val, test):
        df["date"] = pd.to_datetime(df["date"])
    assert set(train.date.dt.year) <= set(TRAIN_YEARS)
    assert set(val.date.dt.year) <= set(VALIDATION_YEARS)
    assert set(test.date.dt.year) <= set(TEST_YEARS)
    assert train.date.max() < val.date.min() and val.date.max() < test.date.min()

from src.preprocessing.prepare_dataset import prepare
from src.training.train_regime import train as train_regime
from src.training.train_correction import train as train_correction
from src.training.train_heavy_rain import train as train_heavy
from src.evaluation.verification import evaluate


def main():

    print("=" * 60)
    print("        MONSOON AI - REAL DATA PIPELINE")
    print("=" * 60)

    print("\n[1/5] Preparing REAL IMD + GFS dataset...")
    prepare()

    print("\n[2/5] Training regime classifier...")
    train_regime()

    print("\n[3/5] Training rainfall correction model...")
    train_correction()

    print("\n[4/5] Training heavy rainfall model...")
    train_heavy()

    print("\n[5/5] Evaluating on held-out test set...")
    evaluate()

    print("\nPipeline completed.")


if __name__ == "__main__":
    main()
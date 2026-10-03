from preprocessing.prepare_dataset import prepare
from training.train_regime import train as train_regime
from training.train_correction import train as train_correction
from training.train_heavy_rain import train as train_heavy_rain


def main():

    print("\n==============================")
    print(" MONSOON AI REAL ML PIPELINE")
    print("==============================\n")

    print("STEP 1: Preparing dataset")
    prepare()

    print("\nSTEP 2: Training regime model")
    train_regime()

    print("\nSTEP 3: Training rainfall correction")
    train_correction()

    print("\nSTEP 4: Training heavy rainfall")
    train_heavy_rain()

    print("\n================================")
    print(" ALL MODELS TRAINED SUCCESSFULLY")
    print("================================")


if __name__ == "__main__":
    main()
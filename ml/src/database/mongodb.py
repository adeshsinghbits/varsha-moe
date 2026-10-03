import os

from pymongo import MongoClient
from pymongo.server_api import ServerApi


MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb://localhost:27017"
)

DATABASE_NAME = os.getenv(
    "MONGO_DB_NAME",
    "varsha_moe"
)


client = MongoClient(
    MONGO_URI,
    server_api=ServerApi("1")
)

db = client[DATABASE_NAME]


forecasts_collection = db["forecasts"]
district_forecasts_collection = db["district_forecasts"]
verification_collection = db["verification"]
forecast_history_collection = db["forecast_history"]


def check_database():

    try:

        client.admin.command("ping")

        return True

    except Exception as e:

        print("MongoDB connection error:", e)

        return False
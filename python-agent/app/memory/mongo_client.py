from functools import lru_cache

from pymongo import MongoClient

from app.config import settings


@lru_cache
def get_client() -> MongoClient:
    return MongoClient(settings.mongo_uri)


def get_db():
    # Matches the "agent" database the NestJS backend connects to
    # (MONGO_URI in docker-compose points both services at the same Mongo).
    return get_client().get_database("agent")

import os
from pathlib import Path
from dotenv import load_dotenv
import psycopg

load_dotenv(Path(__file__).resolve().parent / ".env")


def require_env(name):
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing environmental variable {name}")
    return value


def connect_db():
    return psycopg.connect(
        host=require_env("DB_HOST"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=require_env("DB_NAME"),
        user=require_env("DB_USER"),
        password=require_env("DB_PASSWORD"),
        connect_timeout=10,
        autocommit=True,
        keepalives=1,
        keepalives_idle=30,
        keepalives_interval=10,
        keepalives_count=5
    )

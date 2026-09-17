"""
supabase_client.py
--------------------
Creates a single, reusable Supabase client from environment variables.

Setup:
  1. Copy backend/.env.example to backend/.env
  2. Fill in SUPABASE_URL and SUPABASE_KEY (service_role key)
  3. Run sql/schema.sql once in the Supabase SQL editor to create the tables

supabase-py's client is synchronous. FastAPI route handlers here are async,
so every call site wraps `get_supabase()` calls with `asyncio.to_thread(...)`
(see services/db_queries.py) to avoid blocking the event loop.
"""
import os
from functools import lru_cache

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")


@lru_cache
def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError(
            "SUPABASE_URL / SUPABASE_KEY are not set. "
            "Copy backend/.env.example to backend/.env and fill in your "
            "Supabase project's URL and service_role key."
        )
    return create_client(SUPABASE_URL, SUPABASE_KEY)

"""
groq_client.py
---------------
Optional LLM client for the AI voice assistant, using Groq — chosen because
it has a genuinely free tier (no credit card, ~30 requests/min, plenty for
a voice assistant prototype) and an OpenAI-compatible tool-calling API.

Get a free key: https://console.groq.com/keys

If GROQ_API_KEY isn't set, get_groq_client() returns None and
services/ai_parser.py automatically falls back to simple keyword matching —
the app still works end to end, just with less flexible phrasing.
"""
import os
from functools import lru_cache
from typing import Optional

from dotenv import load_dotenv
from groq import AsyncGroq

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")


@lru_cache
def get_groq_client() -> Optional[AsyncGroq]:
    if not GROQ_API_KEY:
        return None
    return AsyncGroq(api_key=GROQ_API_KEY)

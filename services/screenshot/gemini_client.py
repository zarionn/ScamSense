"""Gemini configuration for the Screenshot GenAI component."""

import os
import threading

from dotenv import load_dotenv
from google import genai


load_dotenv()

MODEL_ID = "gemini-3.5-flash"
AUDITOR_MAX_TOKENS = 2048
EXPLAINER_MAX_TOKENS = 1000

client = None
_client_lock = threading.Lock()


def get_client():
    """Return the lazily initialized Screenshot GenAI client."""
    global client

    if client is not None:
        return client

    with _client_lock:
        if client is not None:
            return client

        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. Put it in a local .env file or in the Render "
                "environment variables before starting the server."
            )

        client = genai.Client(api_key=api_key)
        return client

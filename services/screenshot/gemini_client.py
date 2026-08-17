"""Gemini configuration for the Screenshot GenAI component."""

import os

from dotenv import load_dotenv
from google import genai


load_dotenv()

if "GEMINI_API_KEY" not in os.environ:
    raise RuntimeError(
        "GEMINI_API_KEY is not set. Put it in a local .env file or in the Render "
        "environment variables before starting the server."
    )

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
MODEL_ID = "gemini-3.5-flash"
AUDITOR_MAX_TOKENS = 2048
EXPLAINER_MAX_TOKENS = 1000

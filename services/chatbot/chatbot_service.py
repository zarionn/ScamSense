"""ScamSense Assistant service — a small, controlled Gemini role for free-text chat.

Fully isolated from gen_ai.py: this module creates its own Gemini client using
the same already-installed google-genai SDK and the same GEMINI_API_KEY, but
shares no code, prompt, or state with gen_ai.py's Screenshot pipeline. gen_ai.py
is not imported here and is not touched by this feature.

Scope is deliberately narrow — this service ONLY turns a free-text Assistant
message into a short, safe conversational reply (general scam-awareness talk,
answering "what is phishing?"-style questions). It never runs detector
analysis, never invents classifier/confidence/evidence output, and never
decides chat state, quick replies or detector routing — that all stays
deterministic in the frontend (see pages/assistant/assistant-flow.js).
"""
import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

if "GEMINI_API_KEY" not in os.environ:
    raise RuntimeError(
        "GEMINI_API_KEY is not set. Put it in a local .env file or in the Render "
        "environment variables before starting the server."
    )

# Same SDK/model family gen_ai.py already uses, wired up independently — no
# shared client, no shared import, so this feature can change or fail without
# touching the Screenshot pipeline at all.
_client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
_MODEL_ID = "gemini-3.5-flash"

_MAX_OUTPUT_TOKENS = 220
_MAX_REPLY_CHARS = 600

FALLBACK_REPLY = (
    "I'm having trouble generating a response right now, but I can still guide "
    "you using the options below."
)

ASSISTANT_SYSTEM_INSTRUCTION = """You are the conversational helper inside ScamSense.

You do not perform ScamSense detector analysis.

You do not have access to the Message, URL, Transaction or Screenshot detection models unless the application explicitly provides a detector result.

Never claim a detector has run when it has not.

Never invent scam probabilities, confidence scores, classifier outputs or detector evidence.

For a specific suspicious item, provide general safety guidance and recommend using the appropriate ScamSense detector rather than declaring the item legitimate or malicious.

Keep responses concise, practical and consumer-friendly.

Reply in plain conversational text only — no markdown, no headings, no bullet
lists, no asterisks. Two to four short sentences."""


def generate_assistant_reply(message: str, context: dict | None = None) -> dict:
    """Send one small, constrained Gemini request for a free-text Assistant message.

    `context` is accepted for the request contract but deliberately unused for
    now — this prototype keeps the Gemini call to the system instruction plus
    the user's own message only, per "keep context minimal".

    Returns {"reply": str, "source": "gemini" | "fallback"}. Never raises: any
    Gemini failure (timeout, error, empty/invalid content, quota) returns the
    deterministic FALLBACK_REPLY instead, so the Assistant keeps working.
    """
    message = (message or "").strip()
    if not message:
        return {"reply": FALLBACK_REPLY, "source": "fallback"}

    try:
        interaction = _client.interactions.create(
            model=_MODEL_ID,
            input=[{"type": "text", "text": message}],
            system_instruction=ASSISTANT_SYSTEM_INSTRUCTION,
            generation_config={
                "thinking_level": "minimal",
                "max_output_tokens": _MAX_OUTPUT_TOKENS,
                "temperature": 0.4,
            },
        )
        reply = (interaction.output_text or "").strip()
        if not reply:
            return {"reply": FALLBACK_REPLY, "source": "fallback"}
        if len(reply) > _MAX_REPLY_CHARS:
            reply = reply[:_MAX_REPLY_CHARS].rstrip() + "…"
        return {"reply": reply, "source": "gemini"}
    except Exception:
        return {"reply": FALLBACK_REPLY, "source": "fallback"}

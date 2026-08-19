"""ScamSense Assistant service — trusted advisories and controlled free-text chat.

The Assistant uses a deterministic adapter for natural-language searches over
the same validated corpus consumed by Screenshot. It does not import or invoke
Screenshot classification, audit, policy, signal retrieval, prompts, or state.
Non-advisory messages retain the independent Gemini client and prompt below.

This service never runs detector analysis, invents classifier/confidence/evidence
output, or decides chat state, quick replies or detector routing — that stays
deterministic in the frontend (see pages/assistant/assistant-flow.js).
"""
import logging
import os
from google import genai
from dotenv import load_dotenv

from . import advisory_assistant

load_dotenv()

logger = logging.getLogger(__name__)

if "GEMINI_API_KEY" not in os.environ:
    raise RuntimeError(
        "GEMINI_API_KEY is not set. Put it in a local .env file or in the Render "
        "environment variables before starting the server."
    )

# Same SDK/model family screenshot_genai.py already uses, wired up independently — no
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
    """Handle trusted-advisory searches or send a constrained Gemini request.

    `context` carries only `awaiting_advisory_topic`: true when the previous
    assistant turn asked the advisory clarification question, so this turn
    supplies the search topic. The Gemini call itself still sees nothing but
    the system instruction and the user's own message, per "keep context
    minimal".

    Advisory intent and retrieval are deterministic and local. Other messages
    retain the existing Gemini path. Never raises: retrieval or Gemini failures
    return a bounded fallback response so the Assistant keeps working.
    """
    message = (message or "").strip()
    if not message:
        return {"reply": FALLBACK_REPLY, "source": "fallback"}

    awaiting_topic = bool(
        isinstance(context, dict) and context.get("awaiting_advisory_topic")
    )
    try:
        advisory_response = advisory_assistant.handle_advisory_query(
            message,
            awaiting_topic=awaiting_topic,
        )
    except Exception as error:
        logger.warning(
            "Trusted advisory retrieval failed (%s).",
            type(error).__name__,
        )
        return advisory_assistant.build_assistant_response(
            advisory_assistant.unavailable_response()
        )
    if advisory_response is not None:
        return advisory_assistant.build_assistant_response(advisory_response)

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

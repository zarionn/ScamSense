"""Assistant routing classifier — decides only whether text is detector input.

Separate from chatbot_service.py on purpose: that module produces conversational
replies, this one produces a routing decision and nothing else. It never returns a
verdict, risk level, scam category or advice — those come from the detectors.

One request, one structured decision, no tools and no loop. Every failure mode
(missing key, API error, malformed output, schema mismatch, low confidence)
resolves to normal_chat, so an unavailable classifier can only ever mean "keep
this as ordinary conversation", never an unwanted detector call.
"""
import os
from typing import Literal

from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel

load_dotenv()

_MODEL_ID = "gemini-2.5-flash"

# Longer text is still classified, but only the leading part is sent — a routing
# decision does not need the whole paste, and this bounds what leaves the app.
MAX_CLASSIFIER_CHARS = 4000

NORMAL_CHAT = {"intent": "normal_chat", "confidence": "low"}

ROUTING_SYSTEM_INSTRUCTION = """Classify whether the user's current text is primarily suspicious message content that they are presenting for scam analysis.

Return scan_message only when the text itself is mainly the suspicious SMS, email, chat message, social-media message or similar content to be analysed.

Return normal_chat when the user is:
- asking a question
- asking for advice
- discussing scams generally
- asking how the application works
- giving instructions to the assistant
- describing a situation without primarily providing the suspicious message itself
- providing too little context to confidently treat the text as detector input

Do not determine whether the content is actually a scam.
Do not assess risk.
Do not infer a scam category.
Do not give safety advice.

Examples:
"Your DBS account has been suspended. Verify immediately." -> scan_message / high
"I received this: Your DBS account has been suspended. Verify immediately." -> scan_message / high
"Does this sound suspicious?" -> normal_chat
"How do banking scams work?" -> normal_chat
"What should I do if I clicked a phishing link?" -> normal_chat
"Can you explain what Message Scan does?" -> normal_chat"""


class RoutingDecision(BaseModel):
    """Response schema for the routing call, re-applied to the returned JSON."""

    intent: Literal["scan_message", "normal_chat"]
    confidence: Literal["high", "medium", "low"]


def _client():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    return genai.Client(api_key=api_key)


def classify_message_intent(message: str) -> dict:
    """Return {"intent": ..., "confidence": ...}. Never raises."""
    text = (message or "").strip()
    if not text:
        return dict(NORMAL_CHAT)

    client = _client()
    if client is None:
        return dict(NORMAL_CHAT)

    try:
        reply = client.models.generate_content(
            model=_MODEL_ID,
            contents=text[:MAX_CLASSIFIER_CHARS],
            config=types.GenerateContentConfig(
                system_instruction=ROUTING_SYSTEM_INSTRUCTION,
                temperature=0,
                max_output_tokens=200,
                response_mime_type="application/json",
                response_schema=RoutingDecision,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        # Validated again here: the schema constrains generation, it does not
        # guarantee the text that comes back.
        decision = RoutingDecision.model_validate_json(reply.text.strip())
        return decision.model_dump()
    except Exception:
        return dict(NORMAL_CHAT)


def should_scan_message(decision: dict) -> bool:
    """Only a high-confidence scan_message may route text to Message Scan."""
    return (
        isinstance(decision, dict)
        and decision.get("intent") == "scan_message"
        and decision.get("confidence") == "high"
    )

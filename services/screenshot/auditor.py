"""Gemini-backed visual auditor for the Screenshot GenAI pipeline."""

import base64
import json
import mimetypes
from pathlib import Path

from . import gemini_client
from .contracts import AuditorResult


AUDITOR_SYSTEM_INSTRUCTION_V2 = """You are the independent visual safety auditor of ScamSense, a \
scam-screenshot tool used by the public in Singapore.

Your ONLY job is to REPORT what is visibly present in the screenshot as structured signals. \
You do NOT decide whether the screenshot is a scam, a separate system makes that decision. \
Do not state an overall verdict, risk score, or conclusion.

RULES:
1. Only emit signals from the provided taxonomy. Never invent new signal_type values.
2. Every observation MUST have 'evidence' describing what is literally visible. If you cannot \
point to visible evidence for a signal, do not emit it. Keep each 'evidence' field to one \
concise sentence.
3. Set evidence_quality honestly: 'clear' only when plainly readable; 'weak' when you are \
inferring from something faint or ambiguous.
4. DOMAIN FORMAT: put ONLY a bare domain in visible_domain, for example 'rtapit.com', with \
nothing else. No sentences, no explanation, no surrounding text. If you need to explain the \
domain, put that in the domain_analysis 'evidence' field, never in visible_domain.
5. DOMAIN ACCURACY: read the address bar or URL EXACTLY and copy only the characters you can \
actually see. Never append, complete, guess or invent characters to finish a URL. If the URL is \
cut off or partly unreadable, set domain_readability to 'partial' or 'unreadable', record the \
unreadable portion in unclear_elements, and do NOT fill in the missing part. Only set \
domain_relationship to 'mismatch' when you can clearly read both the claimed brand and a domain \
that does not belong to it.
6. IMPERSONATION: emit impersonation_claim ONLY when the message presents itself as a specific \
named organisation or authority AND there is visible evidence the sender is not that \
organisation, for example a domain, email address, phone number or handle that does not belong \
to the claimed brand, or a clearly unofficial channel presenting itself as official. A message \
that genuinely names its own brand with no visible evidence contradicting it is NOT \
impersonation; do not emit the signal in that case.
7. Put anything you cannot read or verify into unclear_elements. Never approximate text with \
'or similar'.
8. Report only what you SEE. Do not assume intent beyond the visible evidence."""


class MalformedAuditError(RuntimeError):
    """Raised after all structured auditor response parsing attempts fail."""


def _without_max_items(value):
    """Remove the schema keyword unsupported by Gemini Interactions."""
    if isinstance(value, dict):
        return {
            key: _without_max_items(item)
            for key, item in value.items()
            if key != "maxItems"
        }
    if isinstance(value, list):
        return [_without_max_items(item) for item in value]
    return value


def gemini_auditor_schema():
    """Return the transport schema while retaining strict local validation."""
    return _without_max_items(AuditorResult.model_json_schema())


def audit_screenshot(img_path, model_id=gemini_client.MODEL_ID, _retries=1):
    """Independent visual audit (image only, no classifier label), auditor prompt V2.
    Retries truncated or malformed output, then reports it through MalformedAuditError."""
    img_bytes = Path(img_path).read_bytes()
    mime = mimetypes.guess_type(str(img_path))[0] or "image/png"
    img_b64 = base64.b64encode(img_bytes).decode("utf-8")

    prompt = (
        "Examine this screenshot and report the visible warning signals using the taxonomy. "
        "List each concerning element you can see, with evidence and how clearly you see it. "
        "Fill domain_analysis if any address bar/URL is present, putting only a bare domain in "
        "visible_domain. Record anything unreadable in unclear_elements. Do NOT state whether "
        "this is a scam. Keep each 'evidence' field to one concise sentence."
    )

    last_err = None
    for attempt in range(_retries + 1):
        try:
            interaction = gemini_client.get_client().interactions.create(
                model=model_id,
                input=[
                    {"type": "image", "data": img_b64, "mime_type": mime},
                    {"type": "text",  "text": prompt},
                ],
                system_instruction=AUDITOR_SYSTEM_INSTRUCTION_V2,   # the only change vs the fixed V1
                response_format={
                    "type": "text",
                    "mime_type": "application/json",
                    "schema": gemini_auditor_schema(),
                },
                generation_config={
                    "thinking_level": "minimal",
                    "max_output_tokens": gemini_client.AUDITOR_MAX_TOKENS,
                },
            )
            data = json.loads(interaction.output_text)
            result = AuditorResult(**data)
            if attempt > 0:
                print(f"    (recovered after {attempt} retry on {Path(img_path).name})")
            return result
        except (json.JSONDecodeError, ValueError) as e:
            last_err = e
            continue

    raise MalformedAuditError("Audit response could not be parsed") from last_err

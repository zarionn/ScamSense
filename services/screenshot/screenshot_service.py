"""Screenshot Scan detector service — classification + Gemini audit pipeline.

Extracted from app.py as-is (Phase 1 service-layer split): same classifier,
same preprocessing, same Gemini auditor call via screenshot_genai, same behaviour.
Nothing about the algorithms below was changed, only where it lives.
"""
import os
import io
import base64
import binascii
import hashlib
import hmac
import json
import logging
import tempfile
import threading
import time
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError
from ai_edge_litert.interpreter import Interpreter
from services.screenshot import screenshot_genai
from services.screenshot.contracts import (
    AnalysisContext,
    RelatedOfficialAdvisory,
    SignedAnalysisPayload,
)
from pydantic import ValidationError


logger = logging.getLogger(__name__)

# --- classifier loaded ONCE at import, not per request --------------------
MODEL_PATH = Path(__file__).resolve().parent / "model" / "screenshot_model.tflite"
interpreter = Interpreter(model_path=str(MODEL_PATH))
interpreter.allocate_tensors()
input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()
_interpreter_lock = threading.Lock()

# VERIFY BEFORE DEPLOY: this must print float32. If it prints uint8 your TFLite
# export is quantised and expects uint8 input, and feeding float32 0-255 will
# silently mangle every score. If uint8, cast arr to uint8 below instead.
print("TFLite input dtype:", input_details[0]["dtype"])

IMG_SIZE = (224, 224)
LOW_THRESHOLD = 0.35     # provisional (A3 sweep); replace after full retrain
HIGH_THRESHOLD = 0.65
MAX_IMAGE_DIMENSION = 8192
MAX_IMAGE_PIXELS = 16_000_000
MAX_NORMALIZED_BYTES = 20 * 1024 * 1024
ANALYSIS_TOKEN_VERSION = 1
ANALYSIS_TOKEN_TTL_SECONDS = 15 * 60
ANALYSIS_TOKEN_CLOCK_SKEW_SECONDS = 30
MAX_ANALYSIS_TOKEN_LENGTH = 65_536
MIN_SIGNING_KEY_BYTES = 32


class ImageValidationError(ValueError):
    """Raised when an uploaded screenshot cannot be safely prepared."""


class AnalysisTokenError(ValueError):
    """Raised for every invalid or expired client analysis token."""


def _analysis_signing_key() -> bytes:
    value = os.environ.get("SCREENSHOT_CONTEXT_SIGNING_KEY")
    if value is None or len(value.encode("utf-8")) < MIN_SIGNING_KEY_BYTES:
        raise RuntimeError(
            "SCREENSHOT_CONTEXT_SIGNING_KEY must be set to at least 32 UTF-8 bytes"
        )
    return value.encode("utf-8")


def _urlsafe_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _urlsafe_decode(value: str) -> bytes:
    try:
        encoded = value.encode("ascii")
        padding = b"=" * (-len(encoded) % 4)
        return base64.b64decode(encoded + padding, altchars=b"-_", validate=True)
    except (UnicodeEncodeError, binascii.Error, ValueError) as error:
        raise AnalysisTokenError("Invalid or expired analysis token") from error


def _temporary_signing_key_identifier(key: bytes) -> str:
    """TEMPORARY: return a non-secret identifier for Render diagnostics."""
    return hashlib.sha256(b"screenshot-token-diagnostic\0" + key).hexdigest()[:12]


def _temporary_signing_key_diagnostics() -> tuple[int, str]:
    """TEMPORARY: inspect key identity without affecting signing-key validation."""
    try:
        value = os.environ.get("SCREENSHOT_CONTEXT_SIGNING_KEY")
        if value is None:
            return 0, "unavailable"
        key = value.encode("utf-8")
        return len(key), _temporary_signing_key_identifier(key)
    except Exception:
        return 0, "unavailable"


def _temporary_current_utc_epoch() -> Optional[int]:
    """TEMPORARY: obtain diagnostic wall-clock time without changing behaviour."""
    try:
        return int(time.time())
    except Exception:
        return None


def _temporary_token_length(token) -> Optional[int]:
    return len(token) if isinstance(token, str) else None


def _temporary_parsed_token_version(token) -> Optional[int]:
    if not isinstance(token, str) or len(token) > MAX_ANALYSIS_TOKEN_LENGTH:
        return None
    parts = token.split(".")
    if len(parts) != 3:
        return None
    prefix = parts[0]
    if not prefix.startswith("v") or not prefix[1:].isdigit():
        return None
    if not 1 <= len(prefix[1:]) <= 10:
        return None
    return int(prefix[1:])


def _temporary_schema_error_details(error: ValidationError) -> list[dict]:
    try:
        return [
            {
                "location": ".".join(str(part) for part in item["loc"]),
                "error_type": item["type"],
            }
            for item in error.errors(include_url=False, include_context=False)
        ]
    except Exception:
        return []


def _temporary_log_token_issue(
    *,
    issued_at: int,
    key: bytes,
    token_length: int,
) -> None:
    try:
        logger.warning(
            "event=token_issue pid=%s current_utc_epoch=%s issued_at=%s "
            "configured_ttl_seconds=%s key_byte_length=%s key_id=%s "
            "token_length=%s",
            os.getpid(),
            _temporary_current_utc_epoch(),
            issued_at,
            ANALYSIS_TOKEN_TTL_SECONDS,
            len(key),
            _temporary_signing_key_identifier(key),
            token_length,
        )
    except Exception:
        pass


def _temporary_log_token_verify_start(token) -> None:
    key_byte_length, key_id = _temporary_signing_key_diagnostics()
    try:
        logger.warning(
            "event=token_verify_start pid=%s current_utc_epoch=%s "
            "configured_ttl_seconds=%s key_byte_length=%s key_id=%s "
            "token_length=%s parsed_version_if_available=%s",
            os.getpid(),
            _temporary_current_utc_epoch(),
            ANALYSIS_TOKEN_TTL_SECONDS,
            key_byte_length,
            key_id,
            _temporary_token_length(token),
            _temporary_parsed_token_version(token),
        )
    except Exception:
        pass


def _temporary_log_token_verify_result(
    *,
    signature_valid: bool,
    issued_at: Optional[int],
    token_age_seconds: Optional[int],
    outcome: str,
    failure_category: str,
    exception_class: str,
    schema_errors: list[dict],
) -> None:
    try:
        logger.warning(
            "event=token_verify_result pid=%s signature_valid=%s "
            "issued_at_after_signature_validation=%s token_age_seconds=%s "
            "configured_ttl_seconds=%s outcome=%s failure_category=%s "
            "exception_class=%s schema_error_locations_and_types_only=%s",
            os.getpid(),
            str(signature_valid).lower(),
            issued_at,
            token_age_seconds,
            ANALYSIS_TOKEN_TTL_SECONDS,
            outcome,
            failure_category,
            exception_class,
            json.dumps(schema_errors, separators=(",", ":")),
        )
    except Exception:
        pass


def issue_analysis_token(analysis_context: dict, now: Optional[int] = None) -> str:
    """Validate and sign a fixed-version canonical analysis payload.

    Tokens are signed but not encrypted and may be replayed during their 15-minute
    lifetime. Replay prevention requires server-side state and is intentionally deferred.
    """
    try:
        context = AnalysisContext.model_validate(analysis_context)
    except ValidationError as error:
        raise RuntimeError("Server produced an invalid analysis context") from error

    payload = SignedAnalysisPayload(
        version=ANALYSIS_TOKEN_VERSION,
        issued_at=int(time.time()) if now is None else now,
        context=context,
    )
    payload_bytes = json.dumps(
        payload.model_dump(mode="json"),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    signing_key = _analysis_signing_key()
    signature = hmac.new(
        signing_key,
        payload_bytes,
        hashlib.sha256,
    ).digest()
    token = (
        f"v{ANALYSIS_TOKEN_VERSION}."
        f"{_urlsafe_encode(payload_bytes)}."
        f"{_urlsafe_encode(signature)}"
    )
    if len(token) > MAX_ANALYSIS_TOKEN_LENGTH:
        raise RuntimeError("Server analysis context is too large to sign")
    _temporary_log_token_issue(
        issued_at=payload.issued_at,
        key=signing_key,
        token_length=len(token),
    )
    return token


def verify_analysis_token(token: str, now: Optional[int] = None) -> dict:
    """Authenticate before parsing, then strictly validate and expire a token."""
    invalid_message = "Invalid or expired analysis token"
    signature_valid = False
    issued_at = None
    token_age_seconds = None
    schema_errors = []
    result_logged = False

    def log_result(
        outcome: str,
        failure_category: str,
        exception_class: str,
    ) -> None:
        nonlocal result_logged
        _temporary_log_token_verify_result(
            signature_valid=signature_valid,
            issued_at=issued_at,
            token_age_seconds=token_age_seconds,
            outcome=outcome,
            failure_category=failure_category,
            exception_class=exception_class,
            schema_errors=schema_errors,
        )
        result_logged = True

    _temporary_log_token_verify_start(token)
    try:
        if (
            not isinstance(token, str)
            or not token
            or len(token) > MAX_ANALYSIS_TOKEN_LENGTH
        ):
            log_result("failure", "invalid_format", "AnalysisTokenError")
            raise AnalysisTokenError(invalid_message)

        parts = token.split(".")
        if len(parts) != 3:
            log_result("failure", "invalid_format", "AnalysisTokenError")
            raise AnalysisTokenError(invalid_message)
        if _temporary_parsed_token_version(token) is None:
            log_result("failure", "invalid_format", "AnalysisTokenError")
            raise AnalysisTokenError(invalid_message)
        if parts[0] != f"v{ANALYSIS_TOKEN_VERSION}":
            log_result("failure", "unsupported_version", "AnalysisTokenError")
            raise AnalysisTokenError(invalid_message)

        try:
            payload_bytes = _urlsafe_decode(parts[1])
        except AnalysisTokenError:
            log_result(
                "failure",
                "payload_base64_decode_failed",
                "AnalysisTokenError",
            )
            raise

        try:
            supplied_signature = _urlsafe_decode(parts[2])
        except AnalysisTokenError:
            log_result("failure", "signature_mismatch", "AnalysisTokenError")
            raise

        try:
            signing_key = _analysis_signing_key()
        except Exception as error:
            log_result("failure", "configuration_error", type(error).__name__)
            raise

        expected_signature = hmac.new(
            signing_key,
            payload_bytes,
            hashlib.sha256,
        ).digest()
        if not hmac.compare_digest(supplied_signature, expected_signature):
            log_result("failure", "signature_mismatch", "AnalysisTokenError")
            raise AnalysisTokenError(invalid_message)
        signature_valid = True

        try:
            payload_data = json.loads(payload_bytes.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            log_result(
                "failure",
                "payload_json_decode_failed",
                "AnalysisTokenError",
            )
            raise AnalysisTokenError(invalid_message) from error

        try:
            payload = SignedAnalysisPayload.model_validate(payload_data)
        except ValidationError as error:
            schema_errors = _temporary_schema_error_details(error)
            issued_at_error = any(
                item["location"] == "issued_at"
                or item["location"].startswith("issued_at.")
                for item in schema_errors
            )
            failure_category = (
                "issued_at_invalid"
                if issued_at_error
                else "payload_schema_failed"
            )
            log_result("failure", failure_category, "AnalysisTokenError")
            raise AnalysisTokenError(invalid_message) from error

        issued_at = payload.issued_at
        current_time = int(time.time()) if now is None else now
        token_age_seconds = current_time - issued_at
        if issued_at > current_time + ANALYSIS_TOKEN_CLOCK_SKEW_SECONDS:
            log_result("failure", "issued_in_future", "AnalysisTokenError")
            raise AnalysisTokenError(invalid_message)
        if (
            token_age_seconds
            > ANALYSIS_TOKEN_TTL_SECONDS + ANALYSIS_TOKEN_CLOCK_SKEW_SECONDS
        ):
            log_result("failure", "expired", "AnalysisTokenError")
            raise AnalysisTokenError(invalid_message)

        log_result("success", "none", "none")
        return payload.context.model_dump(mode="json")
    except Exception as error:
        if not result_logged:
            log_result(
                "failure",
                "unexpected_verification_error",
                type(error).__name__,
            )
        raise


@dataclass(frozen=True)
class PreparedImage:
    data: bytes
    format: str
    mime_type: str
    suffix: str
    width: int
    height: int


def prepare_image(image_bytes: bytes) -> PreparedImage:
    """Validate, orient and strip metadata from a JPEG or PNG exactly once."""
    if not isinstance(image_bytes, bytes) or not image_bytes:
        raise ImageValidationError("Could not read that image")

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(image_bytes), formats=("JPEG", "PNG")) as source:
                source_format = source.format
                width, height = source.size

                if (
                    width <= 0
                    or height <= 0
                    or width > MAX_IMAGE_DIMENSION
                    or height > MAX_IMAGE_DIMENSION
                    or width * height > MAX_IMAGE_PIXELS
                ):
                    raise ImageValidationError(
                        "That image's dimensions are too large to analyse"
                    )

                source.load()
                oriented = ImageOps.exif_transpose(source)

                if source_format == "JPEG":
                    normalized = oriented.convert("RGB")
                    save_format = "JPEG"
                    mime_type = "image/jpeg"
                    suffix = ".jpg"
                    save_options = {"quality": 95, "subsampling": 0}
                elif source_format == "PNG":
                    has_alpha = oriented.mode in {"RGBA", "LA"} or (
                        oriented.mode == "P" and "transparency" in oriented.info
                    )
                    normalized = oriented.convert("RGBA" if has_alpha else "RGB")
                    save_format = "PNG"
                    mime_type = "image/png"
                    suffix = ".png"
                    save_options = {"compress_level": 6}
                else:
                    raise ImageValidationError("Please choose a JPG or PNG image")

                normalized.info.clear()
                output = io.BytesIO()
                normalized.save(output, format=save_format, **save_options)
                normalized_bytes = output.getvalue()

    except ImageValidationError:
        raise
    except (
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
        UnidentifiedImageError,
        OSError,
        SyntaxError,
        ValueError,
    ) as error:
        raise ImageValidationError("Could not read that image") from error

    if len(normalized_bytes) > MAX_NORMALIZED_BYTES:
        raise ImageValidationError(
            "That image becomes too large to analyse after safe preparation"
        )

    return PreparedImage(
        data=normalized_bytes,
        format=save_format,
        mime_type=mime_type,
        suffix=suffix,
        width=normalized.width,
        height=normalized.height,
    )


def classify(image: PreparedImage) -> dict:
    """TFLite classification. RAW 0-255 — preprocess_input is baked into the model."""
    img = Image.open(io.BytesIO(image.data)).convert("RGB").resize(IMG_SIZE)
    arr = np.expand_dims(np.array(img, dtype=np.float32), axis=0)

    with _interpreter_lock:
        interpreter.set_tensor(input_details[0]["index"], arr)
        interpreter.invoke()
        scam_probability = float(interpreter.get_tensor(output_details[0]["index"])[0][0])

    if scam_probability >= HIGH_THRESHOLD:
        label = "scam"
    elif scam_probability <= LOW_THRESHOLD:
        label = "legitimate"
    else:
        label = "suspicious"

    return {
        "label": label,
        "scam_probability": scam_probability,
        "confidence_pct": max(scam_probability, 1 - scam_probability) * 100,
    }


def run_stage1_audit(classification: dict, image: PreparedImage) -> dict:
    """STAGE 1: write the image to a temp file and run the Gemini auditor pipeline.
    Mirrors the exact temp-file lifecycle previously inline in app.py's /api/analyse —
    auditor needs the image on disk (path-based, matches the notebook); the temp file
    is always deleted after this stage completes."""
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=image.suffix) as tmp:
            tmp.write(image.data)
            tmp_path = tmp.name
        # screenshot_genai.analyse runs auditor -> policy -> exposure and degrades gracefully
        # if the auditor is unavailable (classifier result is preserved regardless).
        return screenshot_genai.analyse(classification, tmp_path)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


def _retrieve_related_official_advisories(
    analysis_context: dict,
) -> list[dict]:
    if analysis_context.get("audit_status") != "available":
        return []

    audit = analysis_context.get("audit")
    signals = analysis_context.get("audit_signals")
    if not isinstance(audit, dict):
        return []
    domain = audit.get("domain_analysis")
    if not isinstance(signals, list) or not isinstance(domain, dict):
        return []

    from services.screenshot import advisory_retrieval

    retrieval_context = advisory_retrieval.RetrievalContext(
        signal_tags=tuple(signals),
        content_type=audit["content_type"],
        claimed_entity=domain.get("claimed_entity"),
        domain_readability=domain.get("domain_readability"),
        domain_relationship=domain.get("domain_relationship"),
    )
    retrieval = advisory_retrieval.retrieve_advisories(
        retrieval_context,
        max_results=1,
    )
    if not retrieval["results"]:
        return []

    top = retrieval["results"][0]
    advisory = RelatedOfficialAdvisory(
        advisory_id=top["corpus_id"],
        title=top["official_title"],
        authority=top["authorities"][0],
        publication_date=top["publication_date"],
        summary=top["summary"],
        source_url=top["official_url"],
    )
    return [advisory.model_dump(mode="json")]


def respond(analysis_token: str, answers: dict) -> dict:
    """STAGE 2: user answers exposure questions, return the guarded response.
    Thin passthrough to screenshot_genai.respond, kept here so app.py only talks to the
    service layer. Raises ValueError on missing/invalid answers exactly as
    screenshot_genai.respond -> resolve_exposure_answers already did — app.py converts
    that into the existing 400 response."""
    analysis_context = verify_analysis_token(analysis_token)
    response = screenshot_genai.respond(analysis_context, answers)
    try:
        related_advisories = _retrieve_related_official_advisories(
            analysis_context
        )
    except Exception as error:
        logger.warning(
            "Optional official advisory retrieval failed (%s).",
            type(error).__name__,
        )
        related_advisories = []
    return {
        **response,
        "related_official_advisories": related_advisories,
    }

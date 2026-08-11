"""Screenshot Scan detector service — classification + Gemini audit pipeline.

Extracted from app.py as-is (Phase 1 service-layer split): same classifier,
same preprocessing, same Gemini auditor call via screenshot_genai, same behaviour.
Nothing about the algorithms below was changed, only where it lives.
"""
import os
import io
import tempfile
import numpy as np
from PIL import Image
from ai_edge_litert.interpreter import Interpreter
from services.screenshot import screenshot_genai

# --- classifier loaded ONCE at import, not per request --------------------
interpreter = Interpreter(model_path="model.tflite")
interpreter.allocate_tensors()
input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

# VERIFY BEFORE DEPLOY: this must print float32. If it prints uint8 your TFLite
# export is quantised and expects uint8 input, and feeding float32 0-255 will
# silently mangle every score. If uint8, cast arr to uint8 below instead.
print("TFLite input dtype:", input_details[0]["dtype"])

IMG_SIZE = (224, 224)
LOW_THRESHOLD = 0.35     # provisional (A3 sweep); replace after full retrain
HIGH_THRESHOLD = 0.65
ALLOWED_MIMES = {"image/png", "image/jpeg", "image/jpg"}


def classify(image_bytes: bytes) -> dict:
    """TFLite classification. RAW 0-255 — preprocess_input is baked into the model."""
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB").resize(IMG_SIZE)
    arr = np.expand_dims(np.array(img, dtype=np.float32), axis=0)

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


def run_stage1_audit(classification: dict, image_bytes: bytes) -> dict:
    """STAGE 1: write the image to a temp file and run the Gemini auditor pipeline.
    Mirrors the exact temp-file lifecycle previously inline in app.py's /api/analyse —
    auditor needs the image on disk (path-based, matches the notebook); the temp file
    is always deleted after this stage completes."""
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".img") as tmp:
            tmp.write(image_bytes)
            tmp_path = tmp.name
        # screenshot_genai.analyse runs auditor -> policy -> exposure and degrades gracefully
        # if the auditor is unavailable (classifier result is preserved regardless).
        return screenshot_genai.analyse(classification, tmp_path)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


def respond(analysis_context: dict, answers: dict) -> dict:
    """STAGE 2: user answers exposure questions, return the guarded response.
    Thin passthrough to screenshot_genai.respond, kept here so app.py only talks to the
    service layer. Raises ValueError on missing/invalid answers exactly as
    screenshot_genai.respond -> resolve_exposure_answers already did — app.py converts
    that into the existing 400 response."""
    return screenshot_genai.respond(analysis_context, answers)

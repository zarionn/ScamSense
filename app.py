"""Flask API for the ScamSense Scam Screenshot Detector — two-stage pipeline."""
import os
import io
import tempfile
import numpy as np
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from PIL import Image
from ai_edge_litert.interpreter import Interpreter
import gen_ai

app = Flask(__name__, static_folder="frontend/dist", static_url_path="")
CORS(app)

# read() loads the whole file into memory and the auditor base64-encodes it (~1.33x)
# on top, so cap uploads to avoid OOM on the 512MB host.
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024   # 10MB

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


# ── STAGE 1: analyse the screenshot, return questions (no actions yet) ─────
@app.route("/api/analyse", methods=["POST"])
def analyse():
    if "file" not in request.files or request.files["file"].filename == "":
        return jsonify({"error": "No file uploaded"}), 400

    upload = request.files["file"]
    image_bytes = upload.read()
    mime_type = upload.mimetype if upload.mimetype in ALLOWED_MIMES else "image/png"

    try:
        classification = classify(image_bytes)
    except Exception:
        return jsonify({"error": "Could not read that image"}), 400

    # Auditor needs the image on disk (path-based, matches the notebook). Temp file,
    # deleted after Stage 1 completes.
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".img") as tmp:
            tmp.write(image_bytes)
            tmp_path = tmp.name
        # gen_ai.analyse runs auditor -> policy -> exposure and degrades gracefully
        # if the auditor is unavailable (classifier result is preserved regardless).
        analysis_context = gen_ai.analyse(classification, tmp_path)
    except Exception:
        app.logger.exception("Stage 1 analysis failed")
        return jsonify({"error": "Analysis failed"}), 500
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

    # The client holds analysis_context and posts it back to /api/respond with answers.
    return jsonify(analysis_context)


# ── STAGE 2: user answers exposure questions, return the guarded response ──
@app.route("/api/respond", methods=["POST"])
def respond():
    body = request.get_json(silent=True) or {}
    analysis_context = body.get("analysis_context")
    answers = body.get("answers")

    if not isinstance(analysis_context, dict) or not isinstance(answers, dict):
        return jsonify({"error": "Expected JSON with 'analysis_context' and 'answers'"}), 400

    try:
        result = gen_ai.respond(analysis_context, answers)
    except ValueError as ve:
        # resolve_exposure_answers raises ValueError on missing/invalid answers
        return jsonify({"error": str(ve)}), 400
    except Exception:
        app.logger.exception("Stage 2 response failed")
        return jsonify({"error": "Response generation failed"}), 500

    return jsonify(result)


@app.errorhandler(413)
def too_large(e):
    return jsonify({"error": "That image is too large. Maximum size is 10MB."}), 413


@app.route("/")
def index():
    try:
        return send_from_directory(app.static_folder, "index.html")
    except Exception:
        return jsonify({"status": "API running",
                        "endpoints": ["POST /api/analyse", "POST /api/respond"]})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
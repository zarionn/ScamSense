"""Flask API for ScamSense — HTTP routing only.

Detector/application logic lives in services/, one feature folder per detector
(see services/screenshot/screenshot_service.py, services/chatbot/chatbot_service.py).
This file should stay limited to: app setup, route definitions, reading request
inputs, calling the right service function, and converting the result into the
existing HTTP response — never large detector/model workflows.
"""
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

from services.screenshot import screenshot_service
from services.chatbot import chatbot_service

app = Flask(__name__, static_folder="frontend/dist", static_url_path="")
CORS(app)

# read() loads the whole file into memory and the auditor base64-encodes it (~1.33x)
# on top, so cap uploads to avoid OOM on the 512MB host.
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024   # 10MB


# ── STAGE 1: analyse the screenshot, return questions (no actions yet) ─────
@app.route("/api/analyse", methods=["POST"])
def analyse():
    if "file" not in request.files or request.files["file"].filename == "":
        return jsonify({"error": "No file uploaded"}), 400

    upload = request.files["file"]
    image_bytes = upload.read()
    mime_type = upload.mimetype if upload.mimetype in screenshot_service.ALLOWED_MIMES else "image/png"

    try:
        classification = screenshot_service.classify(image_bytes)
    except Exception:
        return jsonify({"error": "Could not read that image"}), 400

    try:
        analysis_context = screenshot_service.run_stage1_audit(classification, image_bytes)
    except Exception:
        app.logger.exception("Stage 1 analysis failed")
        return jsonify({"error": "Analysis failed"}), 500

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
        result = screenshot_service.respond(analysis_context, answers)
    except ValueError as ve:
        # resolve_exposure_answers raises ValueError on missing/invalid answers
        return jsonify({"error": str(ve)}), 400
    except Exception:
        app.logger.exception("Stage 2 response failed")
        return jsonify({"error": "Response generation failed"}), 500

    return jsonify(result)


# ── ASSISTANT: small, controlled conversational endpoint (isolated from the
# Screenshot detector — see services/chatbot/chatbot_service.py) ───────────
@app.route("/api/assistant/message", methods=["POST"])
def assistant_message():
    body = request.get_json(silent=True) or {}
    message = body.get("message")
    context = body.get("context") if isinstance(body.get("context"), dict) else {}

    if not isinstance(message, str) or not message.strip():
        return jsonify({"error": "Expected JSON with a non-empty 'message' string"}), 400

    result = chatbot_service.generate_assistant_reply(message, context)
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

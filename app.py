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
from services.url import url_service
from services.transaction import transaction_service
import pandas as pd
from services.transaction.feature_engineering import engineer_features_from_transcript

#for transaction PDF print
import io
from flask import send_file
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

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

    try:
        prepared_image = screenshot_service.prepare_image(image_bytes)
        classification = screenshot_service.classify(prepared_image)
    except screenshot_service.ImageValidationError as error:
        return jsonify({"error": str(error)}), 400
    except Exception:
        return jsonify({"error": "Could not read that image"}), 400

    try:
        analysis_context = screenshot_service.run_stage1_audit(
            classification,
            prepared_image,
        )
        analysis_token = screenshot_service.issue_analysis_token(
            analysis_context
        )
    except Exception:
        app.logger.exception("Stage 1 analysis failed")
        return jsonify({"error": "Analysis failed"}), 500

    return jsonify({
        **analysis_context,
        "analysis_token": analysis_token,
    })


# ── STAGE 2: user answers exposure questions, return the guarded response ──
@app.route("/api/respond", methods=["POST"])
def respond():
    body = request.get_json(silent=True) or {}
    analysis_token = body.get("analysis_token")
    answers = body.get("answers")

    if not isinstance(analysis_token, str) or not isinstance(answers, dict):
        return jsonify({"error": "Invalid or expired analysis token"}), 400

    try:
        result = screenshot_service.respond(analysis_token, answers)
    except screenshot_service.AnalysisTokenError:
        return jsonify({"error": "Invalid or expired analysis token"}), 400
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


# URL PHISHING DETECTOR: HTTP validation stays here; model and Gemini logic
# remain isolated in services/url/url_service.py.
@app.route("/api/url/predict", methods=["POST"])
def predict_url():
    body = request.get_json(silent=True) or {}
    url = body.get("url")

    if not isinstance(url, str) or not url.strip():
        return jsonify({"error": "Please provide a URL to check."}), 400

    url = url.strip()
    if len(url) > 2000:
        return jsonify({"error": "That URL is too long to check."}), 400

    try:
        result = url_service.predict_url(url)
    except Exception:
        app.logger.exception("URL prediction failed")
        return jsonify({"error": "Could not check that URL. Please try again."}), 500

    return jsonify(result)

#Transaction Scam Scanner
@app.route("/api/transaction/upload", methods=["POST"])
def upload_transaction_batch():
    if "file" not in request.files or request.files["file"].filename == "":
        return jsonify({"error": "No file uploaded"}), 400

    uploaded = request.files["file"]
    filename = uploaded.filename.lower()
    language = request.form.get("language", "en")

    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(uploaded)
        else:
            df = pd.read_excel(uploaded)
    except Exception:
        return jsonify({"error": "Could not read that file. Please upload a CSV or Excel file."}), 400

    try:
        results = transaction_service.score_upload_rows(df)
        results = transaction_service.enrich_flagged_rows(results, language=language)
        statement_summary = transaction_service.summarize_statement(results, language=language)
    except Exception as exc:
        return jsonify({"error": f"Could not process file: {str(exc)}"}), 400

    return jsonify({
        "total_rows": len(results),
        "flagged_rows": sum(1 for item in results if item["is_fraud"]),
        "results": results,
        "statement_summary": statement_summary
    })

#transaction email draft endpoint
@app.route("/api/transaction/draft-email", methods=["POST"])
def draft_transaction_email():
    body = request.get_json(silent=True) or {}
    flagged_rows = body.get("flagged_rows")

    if not isinstance(flagged_rows, list) or not flagged_rows:
        return jsonify({"error": "No flagged transactions provided"}), 400

    try:
        email = transaction_service.draft_escalation_email(flagged_rows)
    except Exception as exc:
        return jsonify({"error": f"Could not draft email: {str(exc)}"}), 500

    return jsonify({"escalation_email": email})

#transaction pdf report generation
EXPORT_COLUMNS = [
    ("row_index", "Row"),
    ("timestamp", "Timestamp"),
    ("amount", "Amount"),
    ("merchant_category", "Merchant"),
    ("device_type", "Device"),
    ("is_foreign_transaction", "Foreign"),
    ("risk_score", "Risk Score"),
    ("verdict", "Verdict"),
    ("ai_explanation", "AI Explanation"),
]


@app.route("/api/transaction/export/pdf", methods=["POST"])
def export_transactions_pdf():
    body = request.get_json(silent=True) or {}
    results = body.get("results")
    statement_summary = body.get("statement_summary", "")
    if not isinstance(results, list) or not results:
        return jsonify({"error": "No results to export"}), 400

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(letter), title="ScamSense Transaction Results")
    styles = getSampleStyleSheet()
    elements = [Paragraph("ScamSense — Transaction Screening Results", styles["Title"]), Spacer(1, 12)]

    if statement_summary:
        elements.append(Paragraph("Executive Summary", styles["Heading2"]))
        elements.append(Paragraph(statement_summary, styles["BodyText"]))
        elements.append(Spacer(1, 16))

    headers = [label for _, label in EXPORT_COLUMNS]
    table_data = [headers]
    for row in results:
        table_data.append([
            str(row.get(key, "") if key != "is_foreign_transaction"
                else ("Yes" if row.get(key) else "No"))
            for key, _ in EXPORT_COLUMNS
        ])

    table = Table(table_data, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1F2937")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F4F6")]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    elements.append(table)
    doc.build(elements)
    buffer.seek(0)

    return send_file(
        buffer,
        as_attachment=True,
        download_name="scamsense_transaction_results.pdf",
        mimetype="application/pdf",
    )

@app.errorhandler(413)
def too_large(e):
    return jsonify({"error": "That image is too large. Maximum size is 10MB."}), 413


@app.route("/")
def index():
    try:
        return send_from_directory(app.static_folder, "index.html")
    except Exception:
        return jsonify({"status": "API running",
                        "endpoints": ["POST /api/analyse", "POST /api/respond",
                                      "POST /api/url/predict"]})


if __name__ == "__main__":
    app.run(debug=True, port=5000)

from flask import Blueprint, request, jsonify

from services.message_detector.services.message_service import analyze_single_message

message_bp = Blueprint(
    "message",
    __name__
)


@message_bp.route(
    "/analyze-message",
    methods=["POST"]
)
def analyze_message():

    try:

        data = request.get_json()

        if not data or "message" not in data:

            return jsonify({

                "error": "Message is required."

            }), 400

        message = data["message"]

        ai_result = analyze_single_message(message)

        return jsonify(ai_result), 200

    except Exception as e:

        return jsonify({

            "error": str(e)

        }), 500

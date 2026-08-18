from flask import Blueprint
from flask import request
from flask import jsonify
from flask import send_file

import os

from services.message_detector.services.batch_service import analyze_uploaded_dataset

batch_bp = Blueprint(
    "batch",
    __name__
)


# ==========================================
# Analyze Uploaded Dataset
# ==========================================

@batch_bp.route(
    "/analyze-dataset",
    methods=["POST"]
)
def analyze_dataset():

    try:

        if "file" not in request.files:

            return jsonify({

                "error": "No file uploaded."

            }), 400

        file = request.files["file"]

        if file.filename == "":

            return jsonify({

                "error": "No file selected."

            }), 400

        upload_folder = "uploads"

        os.makedirs(
            upload_folder,
            exist_ok=True
        )

        file_path = os.path.join(
            upload_folder,
            file.filename
        )

        file.save(file_path)

        result = analyze_uploaded_dataset(file_path)

        return jsonify({

            "file_name": result["file_name"],

            "total_messages": result["total_messages"],

            "successful_analyses": result["successful_analyses"],

            "results": result["results"],

            "download_file": "ScamSense_Analysis.xlsx"

        })

    except Exception as e:

        return jsonify({

            "error": str(e)

        }), 500


# ==========================================
# Download Generated Excel Report
# ==========================================

@batch_bp.route(
    "/download/<filename>",
    methods=["GET"]
)
def download_dataset(filename):

    output_folder = "outputs"

    file_path = os.path.join(
        output_folder,
        filename
    )

    if not os.path.exists(file_path):

        return jsonify({

            "error": "File not found."

        }), 404

    return send_file(

        file_path,

        as_attachment=True,

        download_name=filename

    )

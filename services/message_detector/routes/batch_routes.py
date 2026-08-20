from flask import Blueprint
from flask import request
from flask import jsonify
from flask import send_file

from werkzeug.utils import secure_filename

from pathlib import Path


from services.message_detector.services.batch_service import (
    analyze_uploaded_dataset
)


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

        # ==========================================
        # CHECK FILE UPLOAD
        # ==========================================

        if "file" not in request.files:

            return jsonify({

                "error":
                    "No file uploaded."

            }), 400


        file = request.files["file"]


        if file.filename == "":

            return jsonify({

                "error":
                    "No file selected."

            }), 400


        # ==========================================
        # SECURE UPLOADED FILENAME
        # ==========================================

        safe_filename = secure_filename(
            file.filename
        )


        if not safe_filename:

            return jsonify({

                "error":
                    "Invalid filename."

            }), 400


        # ==========================================
        # UPLOAD FOLDER
        # ==========================================

        upload_folder = (
            Path(__file__).resolve().parent.parent
            / "uploads"
        )


        upload_folder.mkdir(
            parents=True,
            exist_ok=True
        )


        file_path = (
            upload_folder
            / safe_filename
        )


        file.save(
            file_path
        )


        print(
            f"[BATCH] Uploaded file: {safe_filename}"
        )


        # ==========================================
        # RUN BATCH ANALYSIS
        # ==========================================

        result = analyze_uploaded_dataset(
            str(file_path)
        )


        # ==========================================
        # RETURN BATCH RESULT
        # ==========================================

        return jsonify({

            "file_name":
                result["file_name"],

            "total_messages":
                result["total_messages"],

            "successful_analyses":
                result["successful_analyses"],

            "results":
                result["results"],

            # ======================================
            # UNIQUE GENERATED EXCEL FILE
            # ======================================

            "download_file":
                result["download_file"],

            # ======================================
            # GENERATED CSV FILE
            # ======================================

            "csv_file":
                result.get(
                    "csv_file",
                    ""
                )

        })


    except Exception as e:

        print(
            "Batch analysis error:",
            e
        )

        return jsonify({

            "error":
                str(e)

        }), 500


# ==========================================
# Download Generated Excel Report
# ==========================================

@batch_bp.route(
    "/download/<path:filename>",
    methods=["GET"]
)
def download_dataset(filename):

    # ==========================================
    # OUTPUT FOLDER
    # ==========================================
    #
    # This MUST match the folder used by
    # batch_service.py when generating the
    # Excel files.
    #
    # Example:
    #
    # outputs/
    # ├── ScamSense_Batch_Message_Analysis_001.xlsx
    # ├── ScamSense_Batch_Message_Analysis_002.xlsx
    # └── ScamSense_Batch_Message_Analysis_003.xlsx
    #
    # ==========================================

    output_folder = (
        Path(__file__).resolve().parent.parent
        / "outputs"
    )


    # ==========================================
    # SECURE REQUESTED FILENAME
    # ==========================================

    safe_filename = secure_filename(
        filename
    )


    # ==========================================
    # INVALID FILENAME
    # ==========================================

    if not safe_filename:

        print(
            "[DOWNLOAD] Invalid filename."
        )

        return jsonify({

            "error":
                "Invalid batch filename.",

            "message":
                "The requested batch file is invalid. "
                "Please upload and analyse the Excel "
                "or CSV file again."

        }), 400


    # ==========================================
    # BUILD EXACT FILE PATH
    # ==========================================

    file_path = (
        output_folder
        / safe_filename
    )


    print(
        f"[DOWNLOAD] Requested file: "
        f"{safe_filename}"
    )

    print(
        f"[DOWNLOAD] Looking for file: "
        f"{file_path}"
    )


    # ==========================================
    # CHECK OUTPUT FOLDER
    # ==========================================

    if not output_folder.exists():

        print(
            "[DOWNLOAD] Output folder does not exist."
        )

        return jsonify({

            "error":
                "Output folder not found.",

            "message":
                "The batch output folder could not "
                "be found. Please upload and analyse "
                "the Excel or CSV file again."

        }), 404


    # ==========================================
    # CHECK SPECIFIC FILE
    # ==========================================

    if not file_path.is_file():

        print(
            "[DOWNLOAD] Specific batch file "
            "was not found."
        )

        return jsonify({

            "error":
                "Batch file not found.",

            "message":
                "The requested batch analysis file "
                "could not be found in the output folder. "
                "Please upload and analyse the Excel "
                "or CSV file again before downloading."

        }), 404


    # ==========================================
    # FILE FOUND
    # ==========================================

    print(
        "[DOWNLOAD] Specific batch file found."
    )

    print(
        "[DOWNLOAD] Sending file..."
    )


    # ==========================================
    # SEND EXACT FILE
    # ==========================================

    return send_file(

        str(file_path),

        as_attachment=True,

        download_name=safe_filename

    )
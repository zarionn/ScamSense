# ====================================================
# STEP 44: BATCH DATASET VALIDATION
# ====================================================

import os

import pandas as pd
from pathlib import Path

from openpyxl import load_workbook

from openpyxl.styles import (
    Alignment,
    Font,
    PatternFill,
    Border,
    Side
)

from services.message_detector.services.message_service import (
    analyze_single_message
)


def format_numbered_list(items):

    if not items:
        return ""

    # ---------------------------------------------
    # If Gemini returns a string
    # ---------------------------------------------

    if isinstance(items, str):

        items = (
            items
            .splitlines()
        )

        items = [
            item.strip()
            for item in items
            if item.strip()
        ]

    # ---------------------------------------------
    # Add numbering
    # ---------------------------------------------

    return "\n".join(
        f"{index}. {item}"
        for index, item in enumerate(
            items,
            start=1
        )
    )


def validate_uploaded_file(file_path):

    # ---------------------------------------------
    # Check if file exists
    # ---------------------------------------------

    if not os.path.exists(file_path):

        raise FileNotFoundError(
            "The selected file does not exist."
        )


    # ---------------------------------------------
    # Read uploaded file
    # ---------------------------------------------

    if file_path.lower().endswith(".csv"):

        df = pd.read_csv(
            file_path
        )

    elif file_path.lower().endswith(
        (".xlsx", ".xls")
    ):

        df = pd.read_excel(
            file_path
        )

    else:

        raise ValueError(
            "Unsupported file format."
        )


    # ---------------------------------------------
    # Validate required column
    # ---------------------------------------------

    if "Text" not in df.columns:

        raise ValueError(
            "Uploaded dataset must contain "
            "a column named 'Text'."
        )


    # ---------------------------------------------
    # Validate dataset is not empty
    # ---------------------------------------------

    if df.empty:

        raise ValueError(
            "The uploaded dataset does not "
            "contain any messages."
        )


    # ---------------------------------------------
    # Remove empty messages
    # ---------------------------------------------

    df = df.dropna(
        subset=["Text"]
    )

    df["Text"] = (
        df["Text"]
        .astype(str)
        .str.strip()
    )

    df = df[
        df["Text"] != ""
    ]


    # ---------------------------------------------
    # Validate remaining messages
    # ---------------------------------------------

    if df.empty:

        raise ValueError(
            "The 'Text' column does not contain "
            "any valid messages to analyse."
        )


    return df


# ====================================================
# STEP 45: BATCH SCAM DETECTION SERVICE
# ====================================================

def analyze_uploaded_dataset(file_path):

    print("=" * 60)

    print(
        "ScamSense Batch Scam Detection Service"
    )

    print("=" * 60)


    # ====================================================
    # 1. VALIDATE DATASET
    # ====================================================

    print(
        "\n[1/4] Validating uploaded dataset..."
    )

    df = validate_uploaded_file(
        file_path
    )

    print(
        "✓ Dataset loaded successfully."
    )

    print(
        f"✓ Total messages found: "
        f"{len(df)}"
    )


    # ====================================================
    # RESULT LISTS
    # ====================================================

    scam_type = []

    confidence = []

    confidence_level = []
    
    confidence_gap = []

    risk_level = []

    cross_verification = []

    summary = []

    why_suspicious = []

    scam_indicators = []

    safety_advice = []

    recommended_actions = []

    prevention_tips = []


    # ====================================================
    # 2. ANALYSE EVERY MESSAGE
    # ====================================================

    print(
        "\n[2/4] Starting batch analysis...\n"
    )

    total_messages = len(df)


    for index, message in enumerate(
        df["Text"],
        start=1
    ):

        print("-" * 60)

        print(
            f"Processing message "
            f"{index} of "
            f"{total_messages}..."
        )

        print("-" * 60)


        # ---------------------------------------------
        # Run complete single-message pipeline
        # ---------------------------------------------

        ai_result = analyze_single_message(
            str(message)
        )
        
        confidence_gap.append(
            ai_result.get(
                "confidence_gap",
                "N/A"
            )
        )

        # ====================================================
        # DISPLAY PROGRESS
        # ====================================================

        print(
            f"✓ Prediction: "
            f"{ai_result['predicted_scam_type']}"
        )

        print(
            f"✓ Confidence: "
            f"{ai_result['confidence_score']}"
        )

        print(
            f"✓ Confidence Level: "
            f"{ai_result['confidence_level']}"
        )

        print(
            f"✓ Risk Level: "
            f"{ai_result['risk_level']}"
        )


        # ====================================================
        # CROSS-VERIFICATION
        # ====================================================

        verification = ai_result.get(
            "verification",
            {}
        )


        if verification.get(
            "performed",
            False
        ):

            agreeing = verification.get(
                "models_agreeing",
                0
            )

            available = verification.get(
                "models_available",
                0
            )

            agreement = verification.get(
                "agreement_percentage",
                0
            )

            cross_verification.append(

                f"Yes - {agreeing}/{available} "
                f"models agreed "
                f"({agreement:.2f}%)"

            )

            print(
                f"✓ Cross-Verification: "
                f"{agreeing}/{available} "
                f"models agreed "
                f"({agreement:.2f}%)"
            )

        else:

            cross_verification.append(
                "No - Not required"
            )

            print(
                "✓ Cross-Verification: "
                "Not required"
            )


        print(
            "✓ AI analysis completed.\n"
        )


        # ====================================================
        # STORE PREDICTION RESULTS
        # ====================================================

        scam_type.append(
            ai_result[
                "predicted_scam_type"
            ]
        )

        confidence.append(
            ai_result[
                "confidence_score"
            ]
        )

        confidence_level.append(
            ai_result[
                "confidence_level"
            ]
        )

        risk_level.append(
            ai_result[
                "risk_level"
            ]
        )


        # ====================================================
        # STORE AI EXPLANATION
        # ====================================================

        summary.append(
            ai_result.get(
                "summary",
                ""
            )
        )

        why_suspicious.append(
            ai_result.get(
                "why_suspicious",
                ""
            )
        )

        if ai_result.get("predicted_scam_type") == "Legitimate":

            scam_indicators.append(
                "No scam indicators were identified because "
                "this message appears likely to be legitimate."
            )

        else:

            scam_indicators.append(
                format_numbered_list(
                    ai_result.get(
                        "scam_indicators",
                        []
                    )
                )
            )
        

        safety_advice.append(
            format_numbered_list(
                ai_result.get(
                    "safety_advice",
                    []
                )
            )
        )

        recommended_actions.append(
            format_numbered_list(
                ai_result.get(
                    "recommended_actions",
                    []
                )
            )
        )

        prevention_tips.append(
            format_numbered_list(
                ai_result.get(
                    "prevention_tips",
                    []
                )
            )
        )


        print(
            f"Completed "
            f"{index}/{total_messages} messages.\n"
        )


    # ====================================================
    # 3. APPEND RESULTS TO DATAFRAME
    # ====================================================

    print(
        "[3/4] Appending analysis results..."
    )


    df[
        "Predicted Scam Type"
    ] = scam_type


    df[
        "Confidence Score (ML Model)"
    ] = confidence


    df[
        "Confidence Level (ML Model Certainty)"
    ] = confidence_level
    
    
    df[
        "Confidence Gap (Top 1 vs Top 2 Model Prediction Score Difference)"
    ] = confidence_gap


    df[
        "Risk Level (Final ScamSense Assessment)"
    ] = risk_level


    df[
        "Cross-Verification (Model Agreement)"
    ] = cross_verification


    df[
        "AI Summary"
    ] = summary


    df[
        "Why Suspicious / Legitimate Explanation"
    ] = why_suspicious


    df[
        "Scam Indicators"
    ] = scam_indicators


    df[
        "Safety Advice"
    ] = safety_advice


    df[
        "Recommended Actions"
    ] = recommended_actions


    df[
        "Prevention Tips"
    ] = prevention_tips


    print(
        "✓ Results appended successfully."
    )


    # ====================================================
    # 4. EXPORT RESULTS
    # ====================================================

    print(
        "\n[4/4] Batch analysis completed successfully!"
    )

    print("=" * 60)



    # ----------------------------------------------------
    # Message detector output folder
    # ----------------------------------------------------

    MESSAGE_DETECTOR_DIR = Path(__file__).resolve().parent.parent

    output_folder = MESSAGE_DETECTOR_DIR / "outputs"

    output_folder.mkdir(
        parents=True,
        exist_ok=True
    )

    # ---------------------------------------------
    # Output files
    # ---------------------------------------------

    excel_file = os.path.join(
        output_folder,
        "ScamSense_Batch_Message_Analysis.xlsx"
    )

    csv_file = os.path.join(
        output_folder,
        "ScamSense_Batch_Message_Analysis.csv"
    )


    # ====================================================
    # EXPORT EXCEL
    # ====================================================

    df.to_excel(
        excel_file,
        index=False
    )


    # ---------------------------------------------
    # Load workbook
    # ---------------------------------------------

    wb = load_workbook(
        excel_file
    )

    ws = wb.active


    # ====================================================
    # EXCEL STYLE
    #
    # Match the Single Message Excel style:
    #
    # Blue header
    # White bold text
    # Centered header
    # Wrapped body text
    # Top-left alignment
    # ====================================================

    header_fill = PatternFill(
    fill_type="solid",
    fgColor="6C3BFF"
    )


    header_font = Font(
        bold=True,
        color="FFFFFF"
    )


    # ====================================================
    # STYLE ALL BODY CELLS
    # ====================================================

    for row in ws.iter_rows():

        for cell in row:

            cell.alignment = Alignment(

                vertical="top",

                horizontal="left",

                wrap_text=True

            )


    # ====================================================
    # STYLE HEADER
    # ====================================================

    for cell in ws[1]:

        cell.fill = header_fill

        cell.font = header_font

        cell.alignment = Alignment(

            horizontal="center",

            vertical="center",

            wrap_text=True

        )


    # ====================================================
    # COLUMN WIDTHS
    #
    # Match the proportions used by the
    # Single Message Excel export.
    # ====================================================

    column_widths = {

        "A": 55,   # Text

        "B": 24,   # Predicted Scam Type

        "C": 24,   # Confidence Score

        "D": 32,   # Confidence Level

        "E": 55,   # Confidence Gap

        "F": 35,   # Risk Level

        "G": 40,   # Cross Verification

        "H": 65,   # AI Summary

        "I": 65,   # Why Suspicious / Legitimate

        "J": 60,   # Scam Indicators

        "K": 60,   # Safety Advice

        "L": 60,   # Recommended Actions

        "M": 60    # Prevention Tips

    }


    for column, width in column_widths.items():

        ws.column_dimensions[
            column
        ].width = width


    # ====================================================
    # ROW HEIGHTS
    #
    # Give each result row enough space for the
    # wrapped AI-generated content.
    # ====================================================

    ws.row_dimensions[1].height = 35


    for row_index in range(
        2,
        ws.max_row + 1
    ):

        ws.row_dimensions[
            row_index
        ].height = 300


    # ====================================================
    # FREEZE HEADER
    # ====================================================

    ws.freeze_panes = "A2"


    # ====================================================
    # ENABLE FILTERING
    # ====================================================

    ws.auto_filter.ref = ws.dimensions


    # ====================================================
    # SAVE EXCEL
    # ====================================================

    wb.save(
        excel_file
    )


    # ====================================================
    # EXPORT CSV
    # ====================================================

    df.to_csv(
        csv_file,
        index=False
    )


    # ====================================================
    # RETURN BATCH RESULT
    # ====================================================

    return {

        "file_name":
            os.path.basename(file_path),

        "total_messages":
            len(df),

        "successful_analyses":
            len(df),

        "results":
            df.to_dict(
                orient="records"
            ),

        "download_file":
            os.path.basename(
                excel_file
            ),

        "csv_file":
            os.path.basename(
                csv_file
            )

    }

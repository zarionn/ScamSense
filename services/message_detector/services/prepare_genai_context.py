# ====================================================
# STEP 42G: REUSABLE GENERATIVE AI CONTEXT FUNCTION
# ====================================================
# This function prepares the information required by
# the Generative AI explanation layer.
#
# It includes:
# 1. Final ScamSense classification
# 2. Original ML prediction
# 3. ML confidence
# 4. Confidence level
# 5. Risk level
# 6. Top 3 ML predictions
# 7. Explainable AI keywords
# 8. Cross-validation status
# 9. Verification summary
# 10. Original user message
# ====================================================

def prepare_genai_context(
    final_prediction,
    ml_prediction,
    ml_confidence,
    top_3,
    top_keywords,
    message,
    cross_validated,
    confidence_level,
    risk_level,
    verification_summary
):

    # ---------------------------------------------
    # Convert confidence score into percentage
    # ---------------------------------------------

    confidence_score = round(
        ml_confidence * 100,
        2
    )

    # ---------------------------------------------
    # Retrieve top contributing keywords
    # ---------------------------------------------

    keyword_list = (
        top_keywords["Keyword"]
        .tolist()
    )

    # ---------------------------------------------
    # Create Generative AI context
    # ---------------------------------------------

    genai_context = {

        "Final Prediction":
            final_prediction,

        "ML Prediction":
            ml_prediction,

        "ML Confidence (%)":
            confidence_score,

        "Confidence Level":
            confidence_level,

        "Risk Level":
            risk_level,

        "Top 3 Predictions":
            top_3,

        "Top Contributing Keywords":
            keyword_list,

        "Original Message":
            message.strip(),

        "Cross Validated":
            cross_validated,

        "Verification Summary":
            verification_summary

    }

    return genai_context
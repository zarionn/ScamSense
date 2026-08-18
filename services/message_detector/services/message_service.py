# ====================================================
# STEP 43A: SINGLE MESSAGE DETECTION SERVICE
# ====================================================
# Execute the complete ScamSense detection pipeline.
#
# Pipeline:
#
# ML Prediction
#       ↓
# Confidence Assessment
#       ↓
# Internal Cross-Validation (if required)
#       ↓
# Final Classification
#       ↓
# Risk Level
#       ↓
# Explainable AI
#       ↓
# Embedding-Based RAG
#       ↓
# Gemini Explanation
#       ↓
# Final JSON
# ====================================================


from services.message_detector.services.cross_validation import (
    validated_prediction
)

from services.message_detector.services.explainability import (
    explain_prediction
)

from services.message_detector.services.rag import (
    retrieve_knowledge,
    format_retrieved_knowledge
)

from services.message_detector.services.prepare_genai_context import (
    prepare_genai_context
)

from services.message_detector.services.prompt_builder import (
    build_prompt
)

from services.message_detector.services.gemini_service import (
    generate_ai_report
)


def analyze_single_message(message):

    # ====================================================
    # 1. ML PREDICTION + INTERNAL CROSS-VALIDATION
    # ====================================================

    validation_result = validated_prediction(
        message
    )


    # ====================================================
    # 2. EXTRACT VALIDATION RESULTS
    # ====================================================

    final_prediction = validation_result[
        "final_prediction"
    ]

    ml_prediction = validation_result[
        "ml_prediction"
    ]

    ml_confidence = validation_result[
        "ml_confidence"
    ]

    confidence_level = validation_result[
        "confidence_level"
    ]

    confidence_gap = validation_result[
        "confidence_gap"
    ]

    top_3 = validation_result[
        "top_3"
    ]

    vector = validation_result[
        "vector"
    ]

    cross_validated = validation_result[
        "cross_validated"
    ]

    risk_level = validation_result[
        "risk_level"
    ]

    verification_summary = validation_result.get(
        "verification_summary",
        {}
    )


    # ====================================================
    # 3. FORMAT ML CONFIDENCE VALUES
    #
    # Keep Python responsible for formatting these
    # values. Gemini must not calculate them.
    # ====================================================

    confidence_percentage = (
        ml_confidence * 100
    )

    confidence_gap_percentage = (
        confidence_gap * 100
    )

    formatted_confidence = (
        f"{confidence_percentage:.2f}%"
    )

    formatted_confidence_gap = (
        f"{confidence_gap_percentage:.2f}%"
    )


    # ====================================================
    # 4. EXPLAINABLE AI
    #
    # XAI explains the ORIGINAL ML prediction.
    # ====================================================

    top_keywords = explain_prediction(

        ml_prediction,

        vector

    )


    # ====================================================
    # 5. PREPARE GENERATIVE AI CONTEXT
    # ====================================================

    genai_context = prepare_genai_context(

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

    )


    # ====================================================
    # 6. EMBEDDING-BASED RAG
    #
    # IMPORTANT:
    # Use FINAL prediction for category-aware
    # knowledge retrieval.
    # ====================================================

    retrieved_chunks = retrieve_knowledge(

        message,

        final_prediction,

        top_k=5

    )


    retrieved_knowledge = (
        format_retrieved_knowledge(
            retrieved_chunks
        )
    )


    # ====================================================
    # 7. BUILD FINAL GEMINI PROMPT
    # ====================================================

    prompt = build_prompt(

        genai_context,

        retrieved_knowledge

    )


    # ====================================================
    # 8. GENERATE AI EXPLANATION
    # ====================================================

    ai_result = generate_ai_report(
        prompt
    )
    
    # ====================================================
    # 9. ENSURE WHY-SUSPICIOUS / WHY-LEGITIMATE
    # ====================================================
    #
    # Gemini may occasionally return an empty
    # why_suspicious field, especially for Legitimate
    # classifications.
    #
    # ScamSense therefore provides a deterministic
    # fallback explanation so that the UI and Excel
    # export never contain an empty explanation.
    # ====================================================

    why_explanation = (
        ai_result.get(
            "why_suspicious",
            ""
        )
        or ""
    ).strip()


    if not why_explanation:

        if final_prediction == "Legitimate":

            ai_result["why_suspicious"] = (
                "This message appears likely to be legitimate "
                "based on the ScamSense classification. The "
                "message does not show sufficient characteristics "
                "associated with the scam categories detected by "
                "the system. However, users should still verify "
                "unexpected messages independently through "
                "official channels when necessary."
            )

        else:

            ai_result["why_suspicious"] = (
                f"The message was classified as {final_prediction}. "
                "The ScamSense assessment indicates that the "
                "message contains characteristics associated "
                "with this scam category. Users should review "
                "the scam indicators and safety advice provided "
                "by the system before taking any action."
            )


    # ====================================================
    # 10. PYTHON-OWNED RESULTS
    #
    # These values must NOT be calculated or changed
    # by Gemini.
    # ====================================================

    ai_result["predicted_scam_type"] = (
        final_prediction
    )

    ai_result["confidence_score"] = (
        formatted_confidence
    )

    ai_result["confidence_gap"] = (
        formatted_confidence_gap
    )

    ai_result["confidence_level"] = (
        confidence_level
    )

    ai_result["risk_level"] = (
        risk_level
    )


    # ====================================================
    # 11. CONFIDENCE ASSESSMENT
    #
    # Explain why the ML prediction was considered
    # high / medium / low confidence.
    # ====================================================

    if confidence_level == "High":

        confidence_assessment = (

            f"The ML model has high confidence "
            f"({formatted_confidence}) and the confidence "
            f"gap between the top two model predictions "
            f"is {formatted_confidence_gap}. "

            f"The ML model confidence meets the "
            f"80.00% threshold required for a high-confidence "
            f"classification, and the confidence gap meets "
            f"the 15.00% threshold required to provide "
            f"sufficient separation between the top two "
            f"predicted scam categories."

        )


    elif confidence_level == "Medium":

        confidence_assessment = (

            f"The ML model has medium confidence "
            f"({formatted_confidence}). "

            f"The confidence gap between the top two "
            f"model predictions is {formatted_confidence_gap}. "

            f"The prediction does not satisfy all of the "
            f"criteria required for a high-confidence "
            f"classification, where the ML model confidence "
            f"must be at least 80.00% and the confidence gap "
            f"must be at least 15.00%."

        )


    elif confidence_level == "Low":

        confidence_assessment = (

            f"The ML model has low confidence "
            f"({formatted_confidence}). "

            f"The confidence gap between the top two "
            f"model predictions is {formatted_confidence_gap}. "

            f"The ML model confidence is below the "
            f"60.00% low-confidence threshold. "
            f"Additional internal cross-verification is "
            f"therefore required to provide further support "
            f"for the final classification."

        )


    else:

        confidence_assessment = (

            f"The ML model confidence is "
            f"{formatted_confidence}, with a confidence "
            f"gap of {formatted_confidence_gap} between "
            f"the top two model predictions."

        )


    ai_result["confidence_assessment"] = (
        confidence_assessment
    )


    # ====================================================
    # 12. BUILD VERIFICATION RESPONSE
    #
    # Convert the internal verification summary into
    # the user-facing API structure.
    # ====================================================

    if cross_validated:

        vote_count = verification_summary.get(
            "vote_count",
            0
        )

        total_models = verification_summary.get(
            "total_models",
            0
        )

        agreement_percentage = verification_summary.get(
            "agreement_percentage",
            0
        )

        ai_result["verification"] = {

            "performed":
                True,

            "models_agreeing":
                vote_count,

            "models_available":
                total_models,

            "agreement_percentage":
                round(
                    agreement_percentage,
                    2
                ),

            "message":
                f"{vote_count}/{total_models} "
                f"models agreed "
                f"({agreement_percentage:.2f}%) "
                f"on the final classification of "
                f"'{final_prediction}'.",

            "reason":
                "Additional internal cross-validation "
                "was performed because the ML prediction "
                "did not satisfy the required confidence "
                "criteria.",

            "status":
                "Yes - Performed"

        }


    else:

        ai_result["verification"] = {

            "performed":
                False,

            "models_agreeing":
                0,

            "models_available":
                0,

            "agreement_percentage":
                0.00,

            "message":
                "Cross-verification was not required.",

            "reason":
                "Additional internal cross-validation "
                "was not required because the ML prediction "
                "satisfied the confidence criteria.",

            "status":
                "No - Not required"

        }


    # ====================================================
    # 13. RISK ASSESSMENT
    # ====================================================

    ai_result["risk_assessment"] = (

        f"The final ScamSense risk level is "
        f"{risk_level}. This represents the final "
        f"risk assessment produced by the ScamSense "
        f"detection pipeline."

    )


    # ====================================================
    # 14. RETURN FINAL SCAMSENSE RESULT
    # ====================================================

    return ai_result

from collections import Counter

from services.message_detector.services.prediction import predict_message
from services.message_detector.services.confidence import (
    get_confidence_level,
    get_risk_level
)
from services.message_detector.services.groq_service import classify_with_groq_models
from services.message_detector.services.gemini_service import client

from services.message_detector.services.classification_config import (
    SCAM_CATEGORIES,
    build_cross_validation_prompt
)


# ====================================================
# GEMINI INTERNAL CROSS-VALIDATION
# ====================================================

def classify_with_gemini(message):

    try:

        prompt = build_cross_validation_prompt(
            message
        )

        response = client.models.generate_content(

            model="gemini-2.5-flash",

            contents=prompt

        )

        prediction = response.text.strip()

        # ---------------------------------------------
        # Clean Gemini response
        # ---------------------------------------------

        prediction = (
            prediction
            .replace("**", "")
            .replace("`", "")
            .replace('"', "")
            .strip()
        )

        # ---------------------------------------------
        # Validate classification
        # ---------------------------------------------

        if prediction in SCAM_CATEGORIES:

            return prediction

        print(
            f"[Gemini] Invalid classification: "
            f"{prediction}"
        )

        return None

    except Exception as e:

        print(
            f"[Gemini] API unavailable: {e}"
        )

        return None
    

# ====================================================
# STEP 42F-2: INTERNAL CONSENSUS FUNCTION
# ====================================================
# Combines predictions from:
#
# 1. ScamSense Logistic Regression
# 2. Gemini
# 3. Groq GPT-OSS
# 4. Groq Qwen
#
# Models that are unavailable are ignored.
# ====================================================

def determine_consensus(
    ml_prediction,
    gemini_prediction=None,
    groq_gpt_oss_prediction=None,
    groq_qwen_prediction=None
):

    # ---------------------------------------------
    # Collect available predictions
    # ---------------------------------------------

    predictions = [
        ml_prediction
    ]

    if gemini_prediction is not None:

        predictions.append(
            gemini_prediction
        )

    if groq_gpt_oss_prediction is not None:

        predictions.append(
            groq_gpt_oss_prediction
        )

    if groq_qwen_prediction is not None:

        predictions.append(
            groq_qwen_prediction
        )

    # ---------------------------------------------
    # Count votes
    # ---------------------------------------------

    vote_counts = Counter(
        predictions
    )

    # ---------------------------------------------
    # Find majority prediction
    # ---------------------------------------------

    final_prediction, vote_count = (
        vote_counts.most_common(1)[0]
    )

    # ---------------------------------------------
    # Calculate consensus strength
    #
    # Example:
    #
    # 3 out of 4 models agree
    #
    # 3 / 4 = 0.75
    # ---------------------------------------------

    total_models = len(predictions)

    consensus_strength = (
        vote_count / total_models
    )

    return {

        "final_prediction":
            final_prediction,

        "vote_count":
            vote_count,

        "total_models":
            total_models,

        "consensus_strength":
            consensus_strength,

        "vote_counts":
            dict(vote_counts)

    }
    


# ====================================================
# STEP 42F-5: VALIDATED PREDICTION PIPELINE
# ====================================================
# Complete prediction pipeline:
#
# ML Prediction
#       ↓
# Confidence Level
#       ↓
# Cross-Verification if required
#       ↓
# Model Consensus
#       ↓
# Final Classification
#       ↓
# Risk Level
#       ↓
# Verification Summary
# ====================================================

def validated_prediction(message):

    # =============================================
    # 1. Original ScamSense ML prediction
    # =============================================

    ml_result = predict_message(
        message
    )

    ml_prediction = (
        ml_result["prediction"]
    )

    ml_confidence = (
        ml_result["confidence"]
    )

    confidence_gap = (
        ml_result["confidence_gap"]
    )

    # =============================================
    # 2. Determine confidence level
    # =============================================

    confidence_level = get_confidence_level(

        ml_confidence,

        confidence_gap

    )

    # =============================================
    # 3. Determine whether validation is needed
    # =============================================

    cross_validate = (
        confidence_level != "High"
    )

    # =============================================
    # Display confidence reasoning
    # =============================================

    if confidence_level == "High":
    
        print(
            f"[ScamSense] High confidence prediction. "
            f"Model confidence is {ml_confidence * 100:.2f}% which is >= 80.00% threshold"
            f"and the confidence gap from the second-highest "
            f"prediction is {confidence_gap * 100:.2f}%. which is >= 15.00% threshold"
            f"No additional verification required."
        
        )
    
    elif confidence_level == "Medium":
    
        print(
            f"[ScamSense] Medium confidence prediction. "
            f"Model confidence is {ml_confidence * 100:.2f}%, "
            f"which is between the 60% low-confidence and 80% high-confidence threshold . "
            f"Additional verification will be performed."
        )
    
    else:

        print(
            f"[ScamSense] Low confidence prediction. "
            f"Model confidence is {ml_confidence * 100:.2f}%, "
            f"which is below the 60% low-confidence threshold. "
            f"Additional verification will be performed."
        )

    # =============================================
    # 4. HIGH-CONFIDENCE ML PREDICTION
    # =============================================
    # No cross-validation required.
    # =============================================

    if not cross_validate:

        # -----------------------------------------
        # Final prediction = original ML prediction
        # -----------------------------------------

        final_prediction = ml_prediction

        # -----------------------------------------
        # Determine risk level
        # -----------------------------------------

        risk_level = get_risk_level(

            final_prediction,

            ml_confidence,

            vote_count=1,

            total_models=1,

            cross_validated=False

        )

        print(
            f"[ScamSense] Risk level: "
            f"{risk_level}"
        )

        # -----------------------------------------
        # Verification summary
        # -----------------------------------------

        verification_summary = {

            "verification_performed":
                False,

            "vote_count":
                1,

            "total_models":
                1,

            "agreement_percentage":
                None,

            "final_classification":
                final_prediction

        }

        # -----------------------------------------
        # Return high-confidence result
        # -----------------------------------------

        return {

            "final_prediction":
                final_prediction,

            "ml_prediction":
                ml_prediction,

            "ml_confidence":
                ml_confidence,

            "top_3":
                ml_result["top_3"],

            "confidence_gap":
                confidence_gap,

            "confidence_level":
                confidence_level,

            "cross_validated":
                False,

            "gemini_prediction":
                None,

            "groq_gpt_oss_prediction":
                None,

            "groq_qwen_prediction":
                None,

            "consensus_strength":
                1.0,

            "vote_count":
                1,

            "total_models":
                1,

            "vote_counts":
                {
                    ml_prediction: 1
                },

            "risk_level":
                risk_level,

            "verification_summary":
                verification_summary,

            "vector":
                ml_result["vector"],

            "results_df":
                ml_result["results_df"]

        }

    # =============================================
    # 5. INTERNAL CROSS-VALIDATION
    # =============================================

    print(
        "[ScamSense] Starting internal "
        "cross-validation..."
    )

    # ---------------------------------------------
    # Gemini
    # ---------------------------------------------

    gemini_prediction = (
        classify_with_gemini(
            message
        )
    )

    # ---------------------------------------------
    # Groq models
    # ---------------------------------------------

    groq_results = (
        classify_with_groq_models(
            message
        )
    )

    groq_gpt_oss_prediction = (
        groq_results["gpt_oss"]
    )

    groq_qwen_prediction = (
        groq_results["qwen"]
    )

    # =============================================
    # 6. Determine consensus
    # =============================================

    consensus = determine_consensus(

        ml_prediction,

        gemini_prediction,

        groq_gpt_oss_prediction,

        groq_qwen_prediction

    )

    # =============================================
    # 7. Final classification
    # =============================================

    final_prediction = (
        consensus[
            "final_prediction"
        ]
    )

    print(
        f"[ScamSense] Final classification: "
        f"{final_prediction}"
    )

    print(
        f"[ScamSense] Vote counts: "
        f"{consensus['vote_counts']}"
    )

    # =============================================
    # 8. Determine Risk Level
    # =============================================

    risk_level = get_risk_level(

        final_prediction,

        ml_confidence,

        vote_count=consensus[
            "vote_count"
        ],

        total_models=consensus[
            "total_models"
        ],

        cross_validated=True

    )

    # =============================================
    # Display risk-level reasoning
    # =============================================

    if final_prediction == "Legitimate":
    
        print(
            f"[ScamSense] Risk level: Low. "
            f"The final classification is Legitimate, "
            f"so the message is assessed as low risk."
        )
    
    elif (
        consensus["vote_count"] >= 2
        and
        consensus["total_models"] >= 2
    ):
    
        print(
            f"[ScamSense] Risk level: High. "
            f"{consensus['vote_count']} out of "
            f"{consensus['total_models']} available models "
            f"agree on the final classification "
            f"'{final_prediction}'."
        )
    
    elif ml_confidence >= 0.80:
    
        print(
            f"[ScamSense] Risk level: High. "
            f"The ML model has a confidence of "
            f"{ml_confidence * 100:.2f}%, "
            f"which meets the 80% high-risk confidence "
            f"threshold."
        )
    
    else:
    
        print(
            f"[ScamSense] Risk level: Medium. "
            f"The final classification is '{final_prediction}', "
            f"but the available evidence does not meet the "
            f"criteria for High Risk."
        )

    # =============================================
    # 9. Create verification summary
    # =============================================

    verification_percentage = round(

        consensus[
            "consensus_strength"
        ] * 100,

        2

    )

    verification_summary = {

        "verification_performed":
            True,

        "vote_count":
            consensus[
                "vote_count"
            ],

        "total_models":
            consensus[
                "total_models"
            ],

        "agreement_percentage":
            verification_percentage,

        "final_classification":
            final_prediction

    }

    # =============================================
    # 10. Return complete validation result
    # =============================================

    return {

        "final_prediction":
            final_prediction,

        "ml_prediction":
            ml_prediction,

        "ml_confidence":
            ml_confidence,

        "top_3":
            ml_result["top_3"],

        "confidence_gap":
            confidence_gap,

        "confidence_level":
            confidence_level,

        "cross_validated":
            True,

        "gemini_prediction":
            gemini_prediction,

        "groq_gpt_oss_prediction":
            groq_gpt_oss_prediction,

        "groq_qwen_prediction":
            groq_qwen_prediction,

        "consensus_strength":
            consensus[
                "consensus_strength"
            ],

        "vote_count":
            consensus[
                "vote_count"
            ],

        "total_models":
            consensus[
                "total_models"
            ],

        "vote_counts":
            consensus[
                "vote_counts"
            ],

        "risk_level":
            risk_level,

        "verification_summary":
            verification_summary,

        "vector":
            ml_result["vector"],

        "results_df":
            ml_result["results_df"]

    }

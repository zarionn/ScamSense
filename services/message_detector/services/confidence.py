# ====================================================
# STEP 42E: INTERNAL CROSS-VALIDATION
# ====================================================
# This component determines whether the ML prediction
# requires additional validation.
#
# Cross-validation is performed internally and is NOT
# directly exposed to the user.
# ====================================================

def should_cross_validate(
    confidence,
    confidence_gap
):

    # Starting thresholds.
    #
    # These values should later be evaluated using
    # validation/test-set results.

    CONFIDENCE_THRESHOLD = 0.80

    CONFIDENCE_GAP_THRESHOLD = 0.15

    # Low ML confidence
    if confidence < CONFIDENCE_THRESHOLD:

        return True

    # Small difference between Top 1 and Top 2
    if confidence_gap < CONFIDENCE_GAP_THRESHOLD:

        return True

    return False


# ====================================================
# STEP 42E: CONFIDENCE LEVEL
# ====================================================

def get_confidence_level(
    confidence,
    confidence_gap
):

    # ---------------------------------------------
    # HIGH CONFIDENCE
    #
    # Model is confident AND clearly ahead
    # of the second prediction.
    # ---------------------------------------------

    if (

        confidence >= 0.80

        and

        confidence_gap >= 0.15

    ):

        return "High"

    # ---------------------------------------------
    # LOW CONFIDENCE
    #
    # Model confidence is below 60%.
    # ---------------------------------------------

    if confidence < 0.60:

        return "Low"

    # ---------------------------------------------
    # MEDIUM CONFIDENCE
    # ---------------------------------------------

    return "Medium"


# ====================================================
# STEP 42F: RISK LEVEL
# ====================================================
# Determines the user-facing risk level based on:
#
# 1. Final ScamSense classification
# 2. ML confidence
# 3. Internal model consensus
#
# Risk Level is separate from ML Confidence Level.
# ====================================================

# ====================================================
# STEP 42F: RISK LEVEL
# ====================================================

def get_risk_level(
    final_prediction,
    ml_confidence,
    vote_count=1,
    total_models=1,
    cross_validated=False
):

    # ---------------------------------------------
    # Legitimate messages
    # ---------------------------------------------

    if final_prediction == "Legitimate":
        return "Low"

    # ---------------------------------------------
    # Strong multi-model agreement
    # ---------------------------------------------

    if (
        cross_validated
        and total_models >= 2
        and vote_count >= 2
    ):
        return "High"

    # ---------------------------------------------
    # High ML confidence
    # ---------------------------------------------

    if ml_confidence >= 0.80:
        return "High"

    # ---------------------------------------------
    # Uncertain scam classification
    # ---------------------------------------------

    return "Medium"


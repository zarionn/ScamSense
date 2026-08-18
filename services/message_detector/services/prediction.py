# ====================================================
# STEP 42A: REUSABLE PREDICTION FUNCTION
# ====================================================
# This function performs the complete machine learning
# prediction pipeline for a single message.
#
# It returns:
# - ML prediction
# - ML confidence
# - All class probabilities
# - Top 3 predictions
# - Confidence gap between Top 1 and Top 2
# - TF-IDF vector
# - Complete confidence table
# ====================================================

import pandas as pd
from services.message_detector.services.preprocessing import clean_text
from services.message_detector.services.model_loader import best_model
from services.message_detector.services.model_loader import vectorizer


def predict_message(message):

    """
    Predict the scam category of a message using the
    trained Logistic Regression model.
    """

    # ---------------------------------------------
    # Clean message
    # ---------------------------------------------

    cleaned = clean_text(message)

    # ---------------------------------------------
    # Convert to TF-IDF vector
    # ---------------------------------------------

    vector = vectorizer.transform([cleaned])

    # ---------------------------------------------
    # Predict scam category
    # ---------------------------------------------

    prediction = best_model.predict(vector)[0]

    # ---------------------------------------------
    # Predict probabilities
    # ---------------------------------------------

    probabilities = best_model.predict_proba(vector)[0]

    classes = best_model.classes_

    # ---------------------------------------------
    # Find sorted prediction indices
    # Highest probability → Lowest probability
    # ---------------------------------------------

    sorted_indices = probabilities.argsort()[::-1]

    # ---------------------------------------------
    # Highest confidence
    # ---------------------------------------------

    confidence = float(
        probabilities[sorted_indices[0]]
    )

    # ---------------------------------------------
    # Top 3 predictions
    # ---------------------------------------------

    top_3 = []

    for index in sorted_indices[:3]:

        top_3.append({

            "scam_type":
                classes[index],

            "confidence":
                float(probabilities[index])

        })

    # ---------------------------------------------
    # Confidence gap
    #
    # Difference between Top 1 and Top 2
    # ---------------------------------------------

    confidence_gap = (
        top_3[0]["confidence"]
        -
        top_3[1]["confidence"]
    )

    # ---------------------------------------------
    # Create complete confidence score table
    # ---------------------------------------------

    results_df = pd.DataFrame({

        "Scam Type":
            classes,

        "Confidence Score (%)":
            probabilities * 100

    })

    results_df = results_df.sort_values(

        by="Confidence Score (%)",

        ascending=False

    )

    results_df["Confidence Score (%)"] = (

        results_df["Confidence Score (%)"]

        .round(4)

    )

    results_df = results_df.reset_index(
        drop=True
    )

    results_df.insert(

        0,

        "Rank",

        range(
            1,
            len(results_df) + 1
        )

    )

    return {

        "prediction":
            prediction,

        "confidence":
            confidence,

        "probabilities":
            probabilities,

        "vector":
            vector,

        "results_df":
            results_df,

        "top_3":
            top_3,

        "confidence_gap":
            confidence_gap

    }

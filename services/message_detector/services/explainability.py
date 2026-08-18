# ====================================================
# STEP 42C: REUSABLE EXPLAINABLE AI FUNCTION
# ====================================================
# This function identifies the most influential
# keywords that contributed to the predicted scam
# category.
# ====================================================

import pandas as pd
from services.message_detector.services.model_loader import best_model
from services.message_detector.services.model_loader import vectorizer


def explain_prediction(prediction, vector):

    # Get TF-IDF feature names
    feature_names = vectorizer.get_feature_names_out()

    # Get predicted class index
    predicted_index = list(best_model.classes_).index(prediction)

    # Get Logistic Regression coefficients
    coefficients = best_model.coef_[predicted_index]

    # TF-IDF values of current message
    tfidf_values = vector.toarray()[0]

    # Calculate contribution scores
    contributions = tfidf_values * coefficients

    # Keep only words that appear in the message
    non_zero_indices = tfidf_values.nonzero()[0]

    # Create DataFrame
    local_df = pd.DataFrame({

        "Keyword": [
            feature_names[i]
            for i in non_zero_indices
        ],

        "Contribution": [
            contributions[i]
            for i in non_zero_indices
        ]

    })

    # Sort by contribution
    local_df = local_df.sort_values(
        by="Contribution",
        ascending=False
    )

    # Keep only positive contributions
    local_df = local_df[
        local_df["Contribution"] > 0
    ]

    # Top 5 keywords
    top_keywords = local_df.head(5)

    return top_keywords

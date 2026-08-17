from pathlib import Path
import joblib
import numpy as np
import pandas as pd

MODEL_DIR = Path(__file__).resolve().parent / "model"

model = joblib.load(MODEL_DIR / "fraud_xgb_model.joblib")
onehot_encoder = joblib.load(MODEL_DIR / "onehot_encoder.joblib")
feature_config = joblib.load(MODEL_DIR / "feature_config.joblib")

cat_cols = feature_config["cat_cols"]
model_features = list(model.feature_names_in_)

# These are the fields the model expects
# Keep this list exactly as the model was trained with.
# Your saved config and model verified this contract.
encoded_feature_names = list(onehot_encoder.get_feature_names_out(cat_cols))

def to_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)

def safe_category(value, column_name):
    if value is None:
        value = "Other"
    text = str(value).strip()
    if not text:
        text = "Other"

    allowed = set(onehot_encoder.categories_[cat_cols.index(column_name)])
    return text if text in allowed else "Other"

def build_feature_frame(payload):
    if not isinstance(payload, dict):
        raise ValueError("Expected a JSON object with transaction fields")

    # Start with numeric fields only
    numeric_fields = [c for c in model_features if c not in encoded_feature_names]
    numeric_row = {c: to_float(payload.get(c, 0.0), 0.0) for c in numeric_fields}

    # Add categorical values and encode them
    cat_row = {}
    for c in cat_cols:
        cat_row[c] = safe_category(payload.get(c, "Other"), c)

    cat_df = pd.DataFrame([cat_row])
    encoded = onehot_encoder.transform(cat_df)
    encoded_array = encoded.toarray() if hasattr(encoded, "toarray") else np.asarray(encoded)
    encoded_df = pd.DataFrame(
        encoded_array,
        columns=onehot_encoder.get_feature_names_out(cat_cols),
    )

    final_df = pd.DataFrame([numeric_row])
    final_df = pd.concat([final_df, encoded_df], axis=1)

    for column in model_features:
        if column not in final_df.columns:
            final_df[column] = 0.0

    return final_df[model_features]

def predict_transaction(payload):
    df = build_feature_frame(payload)
    proba = model.predict_proba(df)[0]
    fraud_probability = float(proba[1])
    verdict = "Likely fraud" if fraud_probability >= 0.5 else "Low risk"

    return {
        "risk_score": round(fraud_probability, 4),
        "probability": round(fraud_probability, 4),
        "verdict": verdict,
        "is_fraud": fraud_probability >= 0.5,
        "label": "fraud" if fraud_probability >= 0.5 else "safe",
    }
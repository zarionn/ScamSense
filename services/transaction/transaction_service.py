from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from services.transaction import feature_engineering

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

def build_feature_frame_for_model(df):
    if not isinstance(df, pd.DataFrame):
        raise ValueError("Expected a pandas DataFrame")

    frame = df.copy()

    # 1) numeric columns expected by the model
    numeric_cols = [c for c in model_features if c not in encoded_feature_names]
    for col in numeric_cols:
        if col not in frame.columns:
            frame[col] = 0.0
        frame[col] = pd.to_numeric(frame[col], errors="coerce").fillna(0.0)

    # 2) categorical columns expected by the model
    for col in cat_cols:
        if col not in frame.columns:
            frame[col] = "Other"
        frame[col] = frame[col].fillna("Other").astype(str)

    cat_df = frame[cat_cols].copy()
    for col in cat_cols:
        allowed = set(onehot_encoder.categories_[cat_cols.index(col)])
        cat_df[col] = cat_df[col].map(
            lambda value: str(value).strip() if str(value).strip() in allowed else "Other"
        ).fillna("Other")

    # 3) one-hot encode categorical features
    encoded = onehot_encoder.transform(cat_df)
    encoded_array = encoded.toarray() if hasattr(encoded, "toarray") else np.asarray(encoded)
    encoded_df = pd.DataFrame(
        encoded_array,
        columns=onehot_encoder.get_feature_names_out(cat_cols),
    )

    # 4) combine numeric + encoded columns
    model_df = frame[numeric_cols].copy()
    model_df = pd.concat([model_df, encoded_df], axis=1)

    # 5) add any missing training columns and preserve exact order
    for col in model_features:
        if col not in model_df.columns:
            model_df[col] = 0.0

    return model_df[model_features]

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

def score_upload_rows(df):
    cleaned = feature_engineering.engineer_features_from_transcript(df)
    model_frame = build_feature_frame_for_model(cleaned)
    probs = model.predict_proba(model_frame)[:, 1]

    results = []
    for i, p in enumerate(probs):
        risk = float(p)
        results.append({
            "row_index": i,
            "risk_score": round(risk, 4),
            "probability": round(risk, 4),
            "verdict": "Likely fraud" if risk >= 0.5 else "Low risk",
            "is_fraud": bool(risk >= 0.5),
            "label": "fraud" if risk >= 0.5 else "safe",
        })

    return results
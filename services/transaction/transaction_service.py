import os
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from google import genai
from google.genai import types
from services.transaction import feature_engineering

load_dotenv()

MODEL_DIR = Path(__file__).resolve().parent / "model"

model = joblib.load(MODEL_DIR / "fraud_xgb_model.joblib")
onehot_encoder = joblib.load(MODEL_DIR / "onehot_encoder.joblib")
feature_config = joblib.load(MODEL_DIR / "feature_config.joblib")
# The URL detector and the existing services share the repo's GEMINI_API_KEY,
# but use separate clients and prompts so their behavior stays isolated.
genai_client = genai.Client()
GENAI_MODEL = "gemini-2.5-flash"

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

    numeric_cols = feature_config["numeric_cols"]
    cat_cols = feature_config["cat_cols"]

    for col in numeric_cols:
        if col not in frame.columns:
            frame[col] = 0.0
        frame[col] = pd.to_numeric(frame[col], errors="coerce").fillna(0.0)

    for col in cat_cols:
        if col not in frame.columns:
            frame[col] = "Other"
        frame[col] = frame[col].fillna("Other").astype(str)

    cat_df = frame[cat_cols].copy()
    encoded = onehot_encoder.transform(cat_df)
    encoded_array = encoded.toarray() if hasattr(encoded, "toarray") else np.asarray(encoded)
    encoded_df = pd.DataFrame(
        encoded_array,
        columns=onehot_encoder.get_feature_names_out(cat_cols)
    )

    model_df = frame[numeric_cols].copy()
    model_df = pd.concat([model_df, encoded_df], axis=1)

    for col in model.feature_names_in_:
        if col not in model_df.columns:
            model_df[col] = 0.0

    return model_df[list(model.feature_names_in_)]

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

def infer_flag_reasons(row: dict) -> list:
    reasons = []
    if row.get('is_off_hours'):
        reasons.append("it occurred during unusual/off-peak hours")
    if row.get('is_foreign_transaction'):
        reasons.append("it originated from a foreign location")
    if (row.get('transaction_count_24h') or 0) >= 5:
        reasons.append("there was an unusually high number of transactions in the last 24 hours")
    if (row.get('amount_zscore') or 0) > 2:
        reasons.append("the amount is significantly higher than this account's typical spending")
    if not reasons:
        reasons.append("the transaction pattern deviates from the account's typical behaviour")
    return reasons

SUPPORTED_LANGUAGES = {
    "en": "English",
    "zh": "Simplified Chinese",
    "ms": "Malay",
    "ta": "Tamil",
}

def summarize_statement(results: list, language: str = "en") -> str:
    language_name = SUPPORTED_LANGUAGES.get(language, "English")

    total = len(results)
    flagged = [r for r in results if r.get('is_fraud')]

    if not flagged:
        prompt = f"""
        A bank statement with {total} transactions was screened for fraud. None
        were flagged as suspicious.

        Write a short 1-2 sentence summary in {language_name} telling the account
        holder their statement was reviewed and nothing unusual was found. Warm,
        reassuring tone. No technical jargon.
        """
    else:
        lines = [
            f"- ${r.get('amount')} at {r.get('merchant_category')} "
            f"({r.get('timestamp')}, foreign={'Yes' if r.get('is_foreign_transaction') else 'No'}, "
            f"risk {r.get('risk_score')})"
            for r in flagged
        ]
        prompt = f"""
        A bank statement with {total} transactions was screened for fraud.
        {len(flagged)} were flagged as potentially fraudulent:

        {chr(10).join(lines)}

        Write a short executive summary in {language_name}, 3-4 sentences, for the
        account holder. Structure it like: how many transactions were reviewed,
        how many were flagged (briefly describe the most notable one — amount,
        merchant, and anything unusual like time or foreign origin), and a closing
        line reassuring them the rest of their spending looked normal. Plain
        language, no technical ML jargon. Do not invent details not listed above.
        """

    try:
        reply = genai_client.models.generate_content(
            model=GENAI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=(
                    "You are ScamSense's statement-summary assistant. Be concise, "
                    "factual, and only use the details given — never invent "
                    "transaction details. Always respond in the language specified "
                    "in the instructions."
                ),
                temperature=0,
                max_output_tokens=300,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        return reply.text.strip()
    except Exception:
        return None

def explain_flagged_transaction(row: dict, language: str = "en") -> str:
    language_name = SUPPORTED_LANGUAGES.get(language, "English")
    if genai_client is None:
        return "AI explanation unavailable (GEMINI_API_KEY not set)."

    reasons = infer_flag_reasons(row)
    prompt = f"""
    Transaction flagged as potentially fraudulent:
    - Timestamp: {row.get('timestamp')}
    - Amount: ${row.get('amount')}
    - Merchant category: {row.get('merchant_category')}
    - Device: {row.get('device_type')}
    - Foreign transaction: {'Yes' if row.get('is_foreign_transaction') else 'No'}
    - Risk score: {row.get('risk_score')}
    
    Reasons the system flagged it: {', '.join(reasons)}

    Explain in {language_name} why this transaction looks
    risky, based only on the details above. No technical ML jargon.
    This explaination should be simple enough for people of all ages to undestand
    including elderlies. have it around 2 to 3 sentences long. Do not 
    invent any details about the transaction.
    """
    try:
        reply = genai_client.models.generate_content(
            model=GENAI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=(
                    "You are ScamSense's fraud-explanation assistant. Be concise, "
                    "factual, and only use the details given — never invent "
                    "transaction details.Always respond in the language specified "
                    "in the user's instructions, regardless of the language used in "
                    "the transaction data itself."
                ),
                temperature=0,
                max_output_tokens=300,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        return reply.text.strip()
    except Exception:
        return None


def draft_escalation_email(flagged_rows: list, language: str = "en"):
    if not flagged_rows:
        return None

    lines = [
        f"- Row {r.get('row_index')}: ${r.get('amount')} at {r.get('timestamp')} at {r.get('merchant_category')} "
        f"(risk {r.get('risk_score')}, foreign={'Y' if r.get('is_foreign_transaction') else 'N'})"
        for r in flagged_rows
    ]
    prompt = f"""
    The following {len(flagged_rows)} transactions were flagged as potentially fraudulent
    by our detection system:

    {chr(10).join(lines)}

    Draft a concise, professional escalation email to the bank's fraud investigation
    team summarizing these transactions and requesting review. Keep it under 300 words,
    formal tone suitable for internal bank communication.
    Have a placeholder after the details paragraph for users to replace with their name, last 4 digits 
    of the user's account number,and their contact information: 
    My Information:
    [Replace with your name, last 4 digits of account number, and contact info].
    """
    try:
        reply = genai_client.models.generate_content(
            model=GENAI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=(
                    "You are a fraud analyst assistant drafting internal escalation "
                    "emails. Be factual and concise, and only use the details provided."
                ),
                temperature=0,
                max_output_tokens=600,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        return reply.text.strip()
    except Exception:
        return None


def enrich_flagged_rows(results: list, language: str = "en"):
    flagged = [r for r in results if r.get('is_fraud')]
    for r in flagged:
        explanation = explain_flagged_transaction(r, language=language)
        if explanation is None:
            r['ai_explanation'] = None
            r['ai_error'] = "AI explanation could not be generated."
        else:
            r['ai_explanation'] = explanation

    return results

def format_timestamp(ts) -> str:
    """e.g. 1/6/2026 8:05:00 am — no leading zeros, lowercase am/pm."""
    if pd.isna(ts):
        return None
    formatted = ts.strftime("%m/%d/%Y %I:%M:%S %p")
    # strip leading zeros from month/day/hour, since %-m isn't portable on Windows
    month, rest = formatted.split("/", 1)
    day, rest = rest.split("/", 1)
    year, rest = rest.split(" ", 1)
    hour, rest = rest.split(":", 1)
    return f"{int(month)}/{int(day)}/{year} {int(hour)}:{rest.lower()}"

def score_upload_rows(df):
    cleaned = feature_engineering.engineer_features_from_transcript(df)
    model_frame = build_feature_frame_for_model(cleaned)
    probs = model.predict_proba(model_frame)[:, 1]

    results = []
    for i, p in enumerate(probs):
        risk = float(p)
        ts = cleaned.iloc[i]["timestamp"] if "timestamp" in cleaned.columns else None
        results.append({
            "row_index": i,
            "risk_score": round(risk, 4),
            "probability": round(risk, 4),
            "verdict": "Likely fraud" if risk >= 0.5 else "Low risk",
            "is_fraud": bool(risk >= 0.5),
            "label": "fraud" if risk >= 0.5 else "safe",
            "amount": float(cleaned.iloc[i]["amount"]) if "amount" in cleaned.columns else None,
            "merchant_category": str(cleaned.iloc[i]["merchant_category"]) if "merchant_category" in cleaned.columns else None,
            "device_type": str(cleaned.iloc[i]["device_type"]) if "device_type" in cleaned.columns else None,
            "is_foreign_transaction": int(cleaned.iloc[i]["is_foreign_transaction"]) if "is_foreign_transaction" in cleaned.columns else None,
            "timestamp": format_timestamp(ts) if ts is not None else None,
        })

    return results
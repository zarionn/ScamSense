import os

from dotenv import load_dotenv
from groq import Groq

from services.message_detector.services.classification_config import (
    SCAM_CATEGORIES,
    build_cross_validation_prompt
)

# ====================================================
# STEP 42F-1: GROQ API CONFIGURATION
# ====================================================

load_dotenv()

groq_client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)

# Groq models used for internal cross-validation
GROQ_MODELS = [

    "openai/gpt-oss-120b",

    "qwen/qwen3.6-27b"

]

print("✓ Groq client configured.")
print("✓ Groq Cross-validation models:")

for model in GROQ_MODELS:
    print(f"  - {model}")
    
    
# ====================================================
# STEP 42F-2: GROQ INTERNAL CLASSIFIER
# ====================================================

def classify_with_groq(
    message,
    model
):

    prompt = build_cross_validation_prompt(
        message
    )

    try:

        response = groq_client.chat.completions.create(

            model=model,

            messages=[

                {
                    "role": "system",
                    "content":
                        "You are an independent scam classification system."
                },

                {
                    "role": "user",
                    "content": prompt
                }

            ],

            temperature=0,

            reasoning_format="hidden"

        )

        prediction = (
            response
            .choices[0]
            .message
            .content
            .strip()
        )

        # -----------------------------------------
        # Clean response
        # -----------------------------------------

        prediction = (
            prediction
            .replace("**", "")
            .replace("`", "")
            .replace('"', "")
            .strip()
        )

        # -----------------------------------------
        # Validate classification
        # -----------------------------------------

        if prediction in SCAM_CATEGORIES:

            print(
                f"[Groq:{model}] "
                f"Classification: {prediction}"
            )

            return prediction

        print(
            f"[Groq:{model}] Invalid classification: "
            f"{prediction}"
        )

        return None

    except Exception as e:

        print(
            f"[Groq:{model}] API unavailable: {e}"
        )

        return None
    

# ====================================================
# STEP 42F-3: GROQ MULTI-MODEL CROSS-VALIDATION
# ====================================================

def classify_with_groq_models(message):

    results = {}

    # ---------------------------------------------
    # GPT-OSS 120B
    # ---------------------------------------------

    results["gpt_oss"] = classify_with_groq(

        message,

        "openai/gpt-oss-120b"

    )

    # ---------------------------------------------
    # Qwen 3.6 27B
    # ---------------------------------------------

    results["qwen"] = classify_with_groq(

        message,

        "qwen/qwen3.6-27b"

    )

    return results

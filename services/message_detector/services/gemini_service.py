# ====================================================
# STEP 42K: GEMINI AI REPORT GENERATION SERVICE
# ====================================================
# Submit the constructed prompt to Google's Gemini API
# and return the structured JSON response.
#
# Gemini is used as the Generative AI explanation layer
# after:
#
# ML Prediction
#       ↓
# Explainable AI
#       ↓
# Embedding-Based RAG
#       ↓
# Gemini
#       ↓
# Human-readable AI Report
# ====================================================


# ====================================================
# IMPORTS
# ====================================================

import os
import json

from dotenv import load_dotenv
from google import genai


# ====================================================
# GEMINI API CONFIGURATION
# ====================================================

load_dotenv()


GEMINI_MODEL = "gemini-2.5-flash"


gemini_api_key = os.getenv(
    "GEMINI_API_KEY"
)

# ====================================================
# CREATE GEMINI CLIENT
# ====================================================

if not gemini_api_key:

    raise RuntimeError(
        "GEMINI_API_KEY was not found in the environment."
    )


client = genai.Client(
    api_key=gemini_api_key
)


# ====================================================
# GEMINI STARTUP INFORMATION
# ====================================================

print("✓ Gemini client configured.")
print("✓ Gemini Generative AI model:")
print(f"  - {GEMINI_MODEL}")


# ====================================================
# GENERATE AI REPORT
# ====================================================

def generate_ai_report(prompt):

    try:

        # ---------------------------------------------
        # Submit prompt to Gemini
        # ---------------------------------------------

        response = client.models.generate_content(

            model=GEMINI_MODEL,

            contents=prompt,

            config={

                "response_mime_type":
                    "application/json"

            }

        )


        # ---------------------------------------------
        # Get Gemini response
        # ---------------------------------------------

        response_text = (
            response.text.strip()
        )


        # ---------------------------------------------
        # Convert JSON response into Python dictionary
        # ---------------------------------------------

        try:

            ai_result = json.loads(
                response_text
            )

        except json.JSONDecodeError as error:

            print(
                "[Gemini] Invalid JSON response."
            )

            print(
                f"[Gemini] JSON error: {error}"
            )

            print(
                "[Gemini] Raw response:"
            )

            print(response_text)

            raise


        # ---------------------------------------------
        # Successful Gemini generation
        # ---------------------------------------------

        print(
            f"[Gemini:{GEMINI_MODEL}] "
            f"AI report generated successfully."
        )


        return ai_result


    except Exception as e:

        print(
            f"[Gemini:{GEMINI_MODEL}] "
            f"API unavailable or generation failed: {e}"
        )

        raise
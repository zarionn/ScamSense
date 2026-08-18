SCAM_CATEGORIES = [

    "Banking Scam",
    "E-commerce Scam",
    "General Scam",
    "Government Scam",
    "Investment Scam",
    "Job Scam",
    "Legitimate",
    "Loan Scam",
    "Lottery Scam",
    "Parcel Scam",
    "Romance Scam",
    "Subscription Scam"

]

# ====================================================
# STEP 42F: GEMINI INTERNAL CROSS-VALIDATION
# ====================================================
# Gemini acts as an independent secondary classifier.
#
# This classification is used internally by ScamSense
# and is NOT directly shown to the user.
# ====================================================

def build_cross_validation_prompt(message):

    categories = "\n".join(

        f"- {category}"

        for category in SCAM_CATEGORIES

    )

    prompt = f"""
You are an independent scam classification system
for a Singapore-focused scam detection application.

Classify the following message into EXACTLY ONE
of these 12 categories:

{categories}

IMPORTANT CLASSIFICATION RULES:

1. Analyse the complete meaning and context of
   the message.

2. Do not classify a message as a scam simply because
   it contains words such as:
   payment, order, delivery, OTP, account,
   verification, reward, link or app.

3. Legitimate organisations can send genuine messages
   containing these words.

4. Consider whether the message is a normal:
   - service notification
   - transaction notification
   - OTP or verification message
   - delivery update
   - appointment reminder
   - billing notification
   - account notification
   - customer service message

5. Scammers can impersonate legitimate companies,
   so the company name alone does not prove legitimacy.

6. Consider the actual purpose of the message when
   choosing the scam category.

7. Return ONLY the category name.

8. Do NOT provide an explanation.

9. Do NOT return JSON.

MESSAGE:

{message}
"""

    return prompt
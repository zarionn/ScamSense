# ====================================================
# STEP 15: TEXT PREPROCESSING (From Jupyter Notebook)
# ====================================================
# This function:
# 1. Converts text to lowercase
# 2. Removes URLs
# 3. Removes email addresses
# 4. Removes special characters
# 5. Removes extra spaces
# ====================================================

import re

def clean_text(text):

    text = str(text)

    text = text.lower()

    text = re.sub(r'http\S+', '', text)

    text = re.sub(r'\S+@\S+', '', text)

    text = re.sub(r'[^a-zA-Z0-9\s]', ' ', text)

    text = re.sub(r'\s+', ' ', text)

    return text.strip()
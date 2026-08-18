import joblib
from pathlib import Path

MODEL_DIRECTORY = Path(__file__).resolve().parents[1] / "models"

best_model = joblib.load(MODEL_DIRECTORY / "scam_detector.pkl")
vectorizer = joblib.load(MODEL_DIRECTORY / "tfidf_vectorizer.pkl")

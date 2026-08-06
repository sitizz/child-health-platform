"""Machine learning components for Child Guard.

The deterministic risk engine remains the decision-maker.
ML augments it with triage predictions and caregiver-friendly text.
"""

from app.ml.symptom_classifier import (
    MLPrediction,
    SymptomTriageClassifier,
    get_classifier,
    predict_triage,
)
from app.ml.text_simplifier import SimplifiedText, simplify_recommendation_bundle

__all__ = [
    "MLPrediction",
    "SymptomTriageClassifier",
    "get_classifier",
    "predict_triage",
    "SimplifiedText",
    "simplify_recommendation_bundle",
]

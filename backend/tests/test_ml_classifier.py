"""Tests for symptom triage classifier and text simplifier."""

from pathlib import Path

import pytest

from app.ml.i18n import parse_accept_language, translate_key
from app.ml.symptom_classifier import (
    MODEL_VERSION,
    SymptomTriageClassifier,
    get_classifier,
    predict_triage,
)
from app.ml.text_simplifier import (
    flesch_kincaid_grade,
    simplify_recommendation_bundle,
    simplify_text,
)
from app.ml.training_data import FEATURE_NAMES, RISK_DOMAINS, generate_training_data


@pytest.fixture(scope="module")
def classifier() -> SymptomTriageClassifier:
    get_classifier.cache_clear()
    return get_classifier()


def test_training_data_shape():
    X, y = generate_training_data(n_samples=200, seed=1)
    assert X.shape == (200, len(FEATURE_NAMES))
    assert y.shape == (200,)
    assert set(y).issubset(set(RISK_DOMAINS))


def test_classifier_loads_and_predicts(classifier: SymptomTriageClassifier):
    result = classifier.predict(
        age_group="under5",
        dehydration=True,
        temperature=39.0,
        humidity=50.0,
        rainfall=0.0,
        aqi=20.0,
        pm2_5=8.0,
        pm10=15.0,
    )
    assert result.predicted_domain == "heat_stress"
    assert 0.0 <= result.confidence <= 1.0
    assert result.model_version == MODEL_VERSION
    assert result.agrees_with_engine is True


def test_classifier_respiratory(classifier: SymptomTriageClassifier):
    result = predict_triage(
        age_group="child",
        asthma=True,
        cough=True,
        temperature=25.0,
        humidity=50.0,
        rainfall=0.0,
        aqi=150.0,
        pm2_5=60.0,
        pm10=120.0,
    )
    assert result.predicted_domain == "respiratory"
    assert result.agrees_with_engine is True


def test_classifier_covers_all_domains(classifier: SymptomTriageClassifier):
    assert set(RISK_DOMAINS).issubset(set(classifier.classes_))


def test_classifier_accuracy_above_threshold():
    _, metrics = SymptomTriageClassifier.train(
        n_samples=1500,
        seed=7,
        persist=False,
    )
    assert metrics["accuracy"] >= 0.85


def test_model_file_exists():
    path = (
        Path(__file__).resolve().parents[1]
        / "app"
        / "ml"
        / "models"
        / "symptom_triage_rf.joblib"
    )
    assert path.exists()


def test_text_simplifier_replaces_technical_terms():
    result = simplify_text("Begin oral hydration and monitor dehydration closely")
    assert "drinking fluids" in result.simplified.lower()
    assert "not drinking enough water" in result.simplified.lower()
    assert result.flesch_kincaid_grade >= 0


def test_flesch_kincaid_simple_text_lower_grade():
    simple = "Give the child water. Keep the child cool."
    complex_text = (
        "Initiate immediate oral hydration protocols whilst monitoring "
        "persistent dehydration symptomatology and environmental risk factors."
    )
    assert flesch_kincaid_grade(simple) < flesch_kincaid_grade(complex_text)


def test_simplify_recommendation_bundle():
    bundle = simplify_recommendation_bundle(
        why="Overall environmental health risk is high based on Heat Stress.",
        priority_actions=[
            "Reduce outdoor heat exposure and encourage regular fluid intake."
        ],
        secondary_actions=[
            "Limit strenuous outdoor activity during peak afternoon heat."
        ],
        monitoring_advice=[
            "Watch for unusual tiredness, dizziness, or reduced urination."
        ],
        escalation_advice=["Seek urgent care if the child becomes drowsy."],
    )
    assert "summary" in bundle
    assert bundle["priority_actions"]
    assert "average_flesch_kincaid_grade" in bundle["readability"]


def test_parse_accept_language():
    assert parse_accept_language("ms-MY,ms;q=0.9,en;q=0.8") == "ms"
    assert parse_accept_language("ur") == "ur"
    assert parse_accept_language(None) == "en"
    assert parse_accept_language("fr-FR") == "en"


def test_translate_key_fallback():
    assert "deterministic" in translate_key("ml.disclaimer", "en").lower()
    # Urdu scaffold falls back to English for missing keys
    assert translate_key("ml.agrees", "ur") == translate_key("ml.agrees", "en")

#!/usr/bin/env python3
"""Train and persist the symptom triage Random Forest classifier."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.ml.symptom_classifier import (  # noqa: E402
    MODEL_PATH,
    SymptomTriageClassifier,
)


def main() -> None:
    classifier, metrics = SymptomTriageClassifier.train(
        n_samples=3000,
        seed=42,
        persist=True,
        model_path=MODEL_PATH,
    )
    print(json.dumps(metrics, indent=2))
    print(f"Saved model to {MODEL_PATH}")
    # Smoke prediction
    sample = classifier.predict(
        age_group="under5",
        asthma=True,
        cough=True,
        temperature=30.0,
        humidity=60.0,
        rainfall=0.0,
        aqi=150.0,
        pm2_5=55.0,
        pm10=90.0,
    )
    print(
        f"Smoke prediction: {sample.predicted_domain} (confidence={sample.confidence})"
    )


if __name__ == "__main__":
    main()

"""Symptom triage classifier (scikit-learn).

Augments — never overrides — the deterministic risk engine.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.domain.scoring import ChildFactors, EnvironmentObservation, assess_risks
from app.ml.training_data import (
    FEATURE_NAMES,
    RISK_DOMAINS,
    encode_features,
    generate_training_data,
)
from app.schemas.common import AgeGroup, RiskLevel

MODEL_PATH = Path(__file__).resolve().parent / "models" / "symptom_triage_rf.joblib"
MODEL_VERSION = "symptom-triage-rf-v1"

_DOMAIN_TO_ASSESSMENT = {
    "heat_stress": "heat",
    "respiratory": "respiratory",
    "dengue": "dengue",
    "flood": "flood",
}


@dataclass
class MLPrediction:
    predicted_domain: str
    confidence: float
    agrees_with_engine: bool
    engine_primary_domain: str
    probabilities: dict[str, float]
    model_version: str
    note: str


class SymptomTriageClassifier:
    def __init__(self, pipeline: Pipeline, classes_: list[str]) -> None:
        self.pipeline = pipeline
        self.classes_ = classes_

    @classmethod
    def train(
        cls,
        n_samples: int = 2500,
        seed: int = 42,
        *,
        persist: bool = True,
        model_path: Path | None = None,
    ) -> tuple["SymptomTriageClassifier", dict[str, Any]]:
        X, y = generate_training_data(n_samples=n_samples, seed=seed)
        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=0.2,
            random_state=seed,
            stratify=y,
        )
        pipeline = Pipeline(
            steps=[
                ("scaler", StandardScaler()),
                (
                    "clf",
                    RandomForestClassifier(
                        n_estimators=120,
                        max_depth=10,
                        random_state=seed,
                        class_weight="balanced_subsample",
                        n_jobs=-1,
                    ),
                ),
            ]
        )
        pipeline.fit(X_train, y_train)
        y_pred = pipeline.predict(X_test)
        metrics = {
            "accuracy": float(accuracy_score(y_test, y_pred)),
            "n_train": int(len(X_train)),
            "n_test": int(len(X_test)),
            "classes": sorted(set(y.tolist())),
            "feature_names": FEATURE_NAMES,
            "model_version": MODEL_VERSION,
        }
        classifier = cls(pipeline=pipeline, classes_=list(pipeline.classes_))
        if persist:
            classifier.save(model_path or MODEL_PATH)
        return classifier, metrics

    def save(self, path: Path | None = None) -> Path:
        target = path or MODEL_PATH
        target.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "pipeline": self.pipeline,
            "classes": self.classes_,
            "feature_names": FEATURE_NAMES,
            "model_version": MODEL_VERSION,
            "risk_domains": RISK_DOMAINS,
        }
        joblib.dump(payload, target)
        return target

    @classmethod
    def load(cls, path: Path | None = None) -> "SymptomTriageClassifier":
        target = path or MODEL_PATH
        if not target.exists():
            classifier, _ = cls.train(persist=True, model_path=target)
            return classifier
        payload = joblib.load(target)
        return cls(pipeline=payload["pipeline"], classes_=list(payload["classes"]))

    def predict_proba_row(self, features: list[float]) -> dict[str, float]:
        probs = self.pipeline.predict_proba(np.asarray([features], dtype=np.float64))[0]
        return {
            str(label): float(prob)
            for label, prob in zip(self.pipeline.classes_, probs, strict=True)
        }

    def predict(
        self,
        *,
        age_group: AgeGroup,
        asthma: bool = False,
        fever: bool = False,
        cough: bool = False,
        dehydration: bool = False,
        mosquito_exposure: bool = False,
        flood_exposure: bool = False,
        temperature: float,
        humidity: float,
        rainfall: float,
        aqi: float | None = None,
        pm2_5: float | None = None,
        pm10: float | None = None,
        engine_primary_domain: str | None = None,
    ) -> MLPrediction:
        features = encode_features(
            age_group=age_group,
            asthma=asthma,
            fever=fever,
            cough=cough,
            dehydration=dehydration,
            mosquito_exposure=mosquito_exposure,
            flood_exposure=flood_exposure,
            temperature=temperature,
            humidity=humidity,
            rainfall=rainfall,
            aqi=aqi,
            pm2_5=pm2_5,
            pm10=pm10,
        )
        probabilities = self.predict_proba_row(features)
        predicted_domain = max(probabilities, key=probabilities.get)
        confidence = probabilities[predicted_domain]

        if engine_primary_domain is None:
            obs = EnvironmentObservation(
                temperature=temperature,
                humidity=humidity,
                rainfall=rainfall,
                aqi=aqi,
                pm2_5=pm2_5,
                pm10=pm10,
                daily_temp_max=[temperature],
                daily_rain=[rainfall],
            )
            factors = ChildFactors(
                age_group=age_group,
                asthma=asthma,
                fever=fever,
                cough=cough,
                dehydration=dehydration,
                mosquito_exposure=mosquito_exposure,
                flood_exposure=flood_exposure,
            )
            assessment = assess_risks(obs, factors)
            engine_primary_domain = _engine_primary_domain(
                assessment, rainfall=rainfall
            )

        agrees = predicted_domain == engine_primary_domain or (
            predicted_domain == "low_risk" and engine_primary_domain == "low_risk"
        )
        # Boosted confidence signal when both agree on a non-low domain
        if agrees and predicted_domain != "low_risk":
            confidence = min(1.0, confidence + 0.05)

        note = (
            "ML triage agrees with the deterministic engine."
            if agrees
            else (
                "ML triage differs from the deterministic engine; "
                "engine remains the decision-maker."
            )
        )
        return MLPrediction(
            predicted_domain=predicted_domain,
            confidence=round(confidence, 4),
            agrees_with_engine=agrees,
            engine_primary_domain=engine_primary_domain,
            probabilities={k: round(v, 4) for k, v in probabilities.items()},
            model_version=MODEL_VERSION,
            note=note,
        )


def _engine_primary_domain(assessment: Any, *, rainfall: float = 0.0) -> str:
    mapping = {
        "heat_stress": [assessment.heat.level, float(assessment.heat.score)],
        "respiratory": [
            assessment.respiratory.level,
            float(assessment.respiratory.score),
        ],
        "dengue": [assessment.dengue.level, float(assessment.dengue.score)],
        "flood": [assessment.flood.level, float(assessment.flood.score)],
    }
    level_rank = {"low": 0, "moderate": 1, "high": 2}
    if (
        rainfall >= 30
        and level_rank[mapping["flood"][0]] >= level_rank[mapping["dengue"][0]]
    ):
        mapping["flood"][1] += 0.5
    best, (level, score) = max(
        mapping.items(),
        key=lambda item: (level_rank[item[1][0]], item[1][1]),
    )
    if level == "low" and score == 0:
        return "low_risk"
    return best


@lru_cache(maxsize=1)
def get_classifier() -> SymptomTriageClassifier:
    return SymptomTriageClassifier.load()


def predict_triage(
    *,
    age_group: AgeGroup,
    asthma: bool = False,
    fever: bool = False,
    cough: bool = False,
    dehydration: bool = False,
    mosquito_exposure: bool = False,
    flood_exposure: bool = False,
    temperature: float,
    humidity: float,
    rainfall: float,
    aqi: float | None = None,
    pm2_5: float | None = None,
    pm10: float | None = None,
    engine_primary_domain: str | None = None,
) -> MLPrediction:
    return get_classifier().predict(
        age_group=age_group,
        asthma=asthma,
        fever=fever,
        cough=cough,
        dehydration=dehydration,
        mosquito_exposure=mosquito_exposure,
        flood_exposure=flood_exposure,
        temperature=temperature,
        humidity=humidity,
        rainfall=rainfall,
        aqi=aqi,
        pm2_5=pm2_5,
        pm10=pm10,
        engine_primary_domain=engine_primary_domain,
    )


def primary_domain_from_risks(risks: dict[str, RiskLevel]) -> str:
    level_rank = {"low": 0, "moderate": 1, "high": 2}
    best = max(risks.items(), key=lambda item: level_rank[item[1]])
    if best[1] == "low":
        return "low_risk"
    return best[0]

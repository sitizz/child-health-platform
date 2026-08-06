"""Synthetic training data derived from the deterministic scoring rules.

Labels come from the existing heuristic engine thresholds, which encode
domain-expert climate-health knowledge already present in scoring.py.
"""

from __future__ import annotations

import random
from typing import Any

import numpy as np

from app.domain.scoring import ChildFactors, EnvironmentObservation, assess_risks
from app.schemas.common import AgeGroup

FEATURE_NAMES: list[str] = [
    "age_under5",
    "age_child",
    "age_adolescent",
    "asthma",
    "fever",
    "cough",
    "dehydration",
    "mosquito_exposure",
    "flood_exposure",
    "temperature",
    "humidity",
    "rainfall",
    "aqi",
    "pm2_5",
    "pm10",
]

RISK_DOMAINS: list[str] = [
    "heat_stress",
    "respiratory",
    "dengue",
    "flood",
    "low_risk",
]

AGE_GROUPS: list[AgeGroup] = ["under5", "child", "adolescent"]

_LEVEL_SCORE = {"low": 0, "moderate": 1, "high": 2}


def encode_features(
    *,
    age_group: AgeGroup,
    asthma: bool,
    fever: bool,
    cough: bool,
    dehydration: bool,
    mosquito_exposure: bool,
    flood_exposure: bool,
    temperature: float,
    humidity: float,
    rainfall: float,
    aqi: float | None,
    pm2_5: float | None,
    pm10: float | None,
) -> list[float]:
    return [
        1.0 if age_group == "under5" else 0.0,
        1.0 if age_group == "child" else 0.0,
        1.0 if age_group == "adolescent" else 0.0,
        1.0 if asthma else 0.0,
        1.0 if fever else 0.0,
        1.0 if cough else 0.0,
        1.0 if dehydration else 0.0,
        1.0 if mosquito_exposure else 0.0,
        1.0 if flood_exposure else 0.0,
        float(temperature),
        float(humidity),
        float(rainfall),
        float(aqi if aqi is not None else 0.0),
        float(pm2_5 if pm2_5 is not None else 0.0),
        float(pm10 if pm10 is not None else 0.0),
    ]


def _label_from_assessment(assessment: Any, *, rainfall: float = 0.0) -> str:
    domain_scores = {
        "heat_stress": (
            _LEVEL_SCORE[assessment.heat.level],
            assessment.heat.score,
        ),
        "respiratory": (
            _LEVEL_SCORE[assessment.respiratory.level],
            assessment.respiratory.score,
        ),
        "dengue": (
            _LEVEL_SCORE[assessment.dengue.level],
            assessment.dengue.score,
        ),
        "flood": (
            _LEVEL_SCORE[assessment.flood.level],
            assessment.flood.score,
        ),
    }
    # Heavy rainfall: prefer flood over dengue when scores tie (both use rain).
    if rainfall >= 30 and domain_scores["flood"][0] >= domain_scores["dengue"][0]:
        domain_scores["flood"] = (
            domain_scores["flood"][0],
            domain_scores["flood"][1] + 0.5,
        )

    best_domain, (level_score, raw_score) = max(
        domain_scores.items(),
        key=lambda item: (item[1][0], item[1][1]),
    )
    if level_score == 0 and raw_score == 0:
        return "low_risk"
    return best_domain


def _sample_row(rng: random.Random) -> tuple[list[float], str]:
    age_group = rng.choice(AGE_GROUPS)
    asthma = rng.random() < 0.25
    fever = rng.random() < 0.2
    cough = rng.random() < 0.25
    dehydration = rng.random() < 0.2
    mosquito_exposure = rng.random() < 0.3
    flood_exposure = rng.random() < 0.15

    # Balanced scenarios so every RISK_DOMAINS class appears in training
    scenario = rng.choice(
        [
            "heat",
            "heat",
            "respiratory",
            "respiratory",
            "dengue",
            "dengue",
            "flood",
            "flood",
            "low",
            "low",
            "low",
            "mixed",
        ]
    )
    if scenario == "heat":
        temperature = rng.uniform(36.0, 42.0)
        humidity = rng.uniform(40.0, 65.0)  # avoid dengue warm+humid combo
        rainfall = 0.0
        aqi = rng.uniform(10.0, 40.0)
        pm2_5 = rng.uniform(3.0, 12.0)
        pm10 = rng.uniform(5.0, 25.0)
        dehydration = True
    elif scenario == "respiratory":
        temperature = rng.uniform(18.0, 28.0)
        humidity = rng.uniform(35.0, 60.0)
        rainfall = 0.0
        aqi = rng.uniform(100.0, 200.0)
        pm2_5 = rng.uniform(40.0, 100.0)
        pm10 = rng.uniform(80.0, 180.0)
        asthma = True
        cough = True
    elif scenario == "dengue":
        temperature = rng.uniform(26.0, 32.0)
        humidity = rng.uniform(75.0, 95.0)
        rainfall = rng.uniform(5.0, 18.0)  # below severe flood threshold
        aqi = rng.uniform(10.0, 40.0)
        pm2_5 = rng.uniform(3.0, 12.0)
        pm10 = rng.uniform(5.0, 25.0)
        fever = True
        mosquito_exposure = True
    elif scenario == "flood":
        # Cool/dry air + heavy rain so flood outranks heat/respiratory/dengue
        temperature = rng.uniform(18.0, 24.0)
        humidity = rng.uniform(40.0, 65.0)
        rainfall = rng.uniform(35.0, 80.0)
        aqi = rng.uniform(10.0, 40.0)
        pm2_5 = rng.uniform(3.0, 12.0)
        pm10 = rng.uniform(5.0, 25.0)
        flood_exposure = True
        age_group = "child"  # avoid under5 age boost on other domains
    elif scenario == "mixed":
        temperature = rng.uniform(28.0, 40.0)
        humidity = rng.uniform(60.0, 95.0)
        rainfall = rng.uniform(5.0, 40.0)
        aqi = rng.uniform(40.0, 160.0)
        pm2_5 = rng.uniform(15.0, 70.0)
        pm10 = rng.uniform(30.0, 120.0)
    else:
        # Explicitly low-risk environmental + child profile
        temperature = rng.uniform(18.0, 28.0)
        humidity = rng.uniform(35.0, 60.0)
        rainfall = 0.0
        aqi = rng.uniform(5.0, 40.0)
        pm2_5 = rng.uniform(2.0, 10.0)
        pm10 = rng.uniform(5.0, 20.0)
        asthma = False
        fever = False
        cough = False
        dehydration = False
        mosquito_exposure = False
        flood_exposure = False
        age_group = "adolescent"

    obs = EnvironmentObservation(
        temperature=temperature,
        humidity=humidity,
        rainfall=rainfall,
        aqi=aqi,
        pm2_5=pm2_5,
        pm10=pm10,
        daily_temp_max=[temperature] * 7,
        daily_rain=[rainfall] * 7,
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
    label = _label_from_assessment(assessment, rainfall=rainfall)
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
    return features, label


def generate_training_data(
    n_samples: int = 2500,
    seed: int = 42,
) -> tuple[np.ndarray, np.ndarray]:
    """Generate labeled feature matrix and target vector."""
    rng = random.Random(seed)
    X: list[list[float]] = []
    y: list[str] = []
    for _ in range(n_samples):
        features, label = _sample_row(rng)
        X.append(features)
        y.append(label)
    return np.asarray(X, dtype=np.float64), np.asarray(y, dtype=object)

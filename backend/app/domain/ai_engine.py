"""Rules-based explainable recommendation engine (AI PDF compliant)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from app.domain.scoring import (
    ChildFactors,
    EnvironmentObservation,
    RiskAssessment,
    assess_risks,
)
from app.schemas.common import AgeGroup, RiskLevel


DOMAIN_DISPLAY_NAMES: dict[str, str] = {
    "heat_stress": "Heat Stress",
    "respiratory": "Respiratory",
    "dengue": "Dengue",
    "flood": "Flood",
}


def format_domain_name(name: str) -> str:
    """Convert a snake_case domain key to a human-readable display name."""
    return DOMAIN_DISPLAY_NAMES.get(name, name.replace("_", " ").title())


def age_to_group(age: int) -> AgeGroup:
    if age < 5:
        return "under5"
    if age < 13:
        return "child"
    return "adolescent"


def profile_to_child_factors(
    age: int,
    conditions: dict[str, Any],
    symptoms: dict[str, Any],
    exposures: dict[str, Any],
) -> ChildFactors:
    return ChildFactors(
        age_group=age_to_group(age),
        asthma=bool(conditions.get("asthma") or conditions.get("history_of_asthma")),
        fever=bool(symptoms.get("fever")),
        cough=bool(symptoms.get("cough") or symptoms.get("wheezing")),
        dehydration=bool(
            symptoms.get("dehydration")
            or symptoms.get("signs_of_dehydration")
            or symptoms.get("reduced_fluid_intake")
        ),
        mosquito_exposure=bool(exposures.get("mosquito_exposure")),
        flood_exposure=bool(exposures.get("floodwater") or exposures.get("flood_exposure")),
    )


def _truthy_keys(data: dict[str, Any]) -> list[str]:
    return [key for key, value in data.items() if value]


@dataclass
class ExplainableRecommendation:
    overall_risk: RiskLevel
    primary_hazards: list[str]
    why: str
    environmental_factors: list[str]
    child_factors: list[str]
    priority_actions: list[str]
    secondary_actions: list[str]
    monitoring_advice: list[str]
    escalation_advice: list[str]
    data_completeness: Literal["full", "limited"]
    assessment: RiskAssessment


def build_explainable_recommendation(
    obs: EnvironmentObservation,
    *,
    age: int,
    conditions: dict[str, Any] | None = None,
    allergies: dict[str, Any] | None = None,
    symptoms: dict[str, Any] | None = None,
    exposures: dict[str, Any] | None = None,
) -> ExplainableRecommendation:
    conditions = conditions or {}
    allergies = allergies or {}
    symptoms = symptoms or {}
    exposures = exposures or {}

    factors = profile_to_child_factors(age, conditions, symptoms, exposures)
    assessment = assess_risks(obs, factors)

    env_factors: list[str] = []
    child_factors: list[str] = []
    priority: list[str] = []
    secondary: list[str] = []
    monitoring: list[str] = []
    escalation: list[str] = []
    hazards: list[str] = []

    risk_map = {
        "heat_stress": assessment.heat.level,
        "respiratory": assessment.respiratory.level,
        "dengue": assessment.dengue.level,
        "flood": assessment.flood.level,
    }
    for name, level in risk_map.items():
        if level in ("moderate", "high"):
            hazards.append(format_domain_name(name))

    env_factors.extend(assessment.heat.reasons)
    env_factors.extend(assessment.respiratory.reasons)
    env_factors.extend(assessment.dengue.reasons)
    env_factors.extend(assessment.flood.reasons)

    if factors.age_group == "under5":
        child_factors.append("Child is under 5 and may deteriorate more quickly")
    if factors.asthma:
        child_factors.append("Asthma or respiratory vulnerability is present")
    if factors.cough:
        child_factors.append("Current cough or wheezing symptoms are present")
    if factors.dehydration:
        child_factors.append("Dehydration signs increase heat vulnerability")
    if factors.fever and factors.mosquito_exposure:
        child_factors.append("Fever with mosquito exposure increases dengue concern")
    if factors.flood_exposure:
        child_factors.append("Recent floodwater exposure increases infection risk")

    for key in _truthy_keys(conditions):
        label = key.replace("_", " ")
        if label not in " ".join(child_factors).lower():
            child_factors.append(f"Reported condition: {label}")
    for key in _truthy_keys(allergies):
        child_factors.append(f"Allergy consideration: {key.replace('_', ' ')}")
    for key in _truthy_keys(symptoms):
        if key not in {"fever", "cough", "wheezing", "dehydration", "signs_of_dehydration"}:
            child_factors.append(f"Current symptom: {key.replace('_', ' ')}")
    for key in _truthy_keys(exposures):
        if key not in {"mosquito_exposure", "flood_exposure", "floodwater"}:
            child_factors.append(f"Exposure: {key.replace('_', ' ')}")

    # Deduplicate while preserving order
    env_factors = list(dict.fromkeys(env_factors))
    child_factors = list(dict.fromkeys(child_factors))

    if assessment.heat.level in ("moderate", "high"):
        priority.append(
            "Reduce outdoor heat exposure and encourage regular fluid intake."
        )
        if factors.dehydration:
            priority.append(
                "Move the child to a cooler area and begin oral hydration immediately."
            )
            escalation.append(
                "Seek urgent care if the child becomes drowsy, confused, or unable to drink."
            )
        secondary.append("Limit strenuous outdoor activity during peak afternoon heat.")
        monitoring.append("Watch for unusual tiredness, dizziness, or reduced urination.")

    if assessment.respiratory.level in ("moderate", "high"):
        priority.append(
            "Reduce prolonged outdoor exposure while air quality is poor."
        )
        if factors.asthma or factors.cough:
            monitoring.append(
                "Monitor breathing, coughing, wheezing, or chest tightness closely."
            )
            escalation.append(
                "Seek urgent care if breathing difficulty, persistent wheezing, or bluish lips occur."
            )
        secondary.append("Prefer indoor activity until air quality improves.")

    if assessment.dengue.level in ("moderate", "high"):
        priority.append("Increase mosquito protection around the home and child.")
        secondary.append("Remove standing water and reduce mosquito breeding sites.")
        if factors.fever and factors.mosquito_exposure:
            monitoring.append(
                "Watch for persistent fever, vomiting, abdominal pain, or unusual weakness."
            )
            escalation.append(
                "Seek clinical advice urgently if dengue warning signs appear."
            )

    if assessment.flood.level in ("moderate", "high") or factors.flood_exposure:
        priority.append(
            "Avoid contact with contaminated floodwater and ensure drinking water is safe."
        )
        monitoring.append(
            "Watch for diarrhoea, fever, skin infection, or dehydration after flood exposure."
        )
        escalation.append(
            "Seek care if flood-related illness symptoms develop or worsen."
        )

    if not priority:
        priority.append(
            "Continue normal activities with routine environmental precautions."
        )
    if not secondary:
        secondary.append("Keep monitoring local weather and air quality updates.")
    if not monitoring:
        monitoring.append("Check the child regularly for new or worsening symptoms.")
    if not escalation:
        escalation.append(
            "Seek medical advice if symptoms worsen, persist, or the child appears unusually unwell."
        )

    # Deduplicate action lists
    priority = list(dict.fromkeys(priority))
    secondary = list(dict.fromkeys(secondary))
    monitoring = list(dict.fromkeys(monitoring))
    escalation = list(dict.fromkeys(escalation))

    completeness: Literal["full", "limited"] = (
        "full"
        if (conditions or allergies or symptoms or exposures)
        else "limited"
    )

    hazard_text = ", ".join(hazards) if hazards else "no elevated hazards"
    why = (
        f"Overall environmental health risk is {assessment.priority_alert} "
        f"based on {hazard_text}."
    )
    if completeness == "limited":
        why += " Recommendations use limited child profile data."

    if not child_factors:
        child_factors.append("No additional child-specific risk factors were provided")

    return ExplainableRecommendation(
        overall_risk=assessment.priority_alert,
        primary_hazards=hazards,
        why=why,
        environmental_factors=env_factors
        or ["Current environmental readings are within routine ranges"],
        child_factors=child_factors,
        priority_actions=priority,
        secondary_actions=secondary,
        monitoring_advice=monitoring,
        escalation_advice=escalation,
        data_completeness=completeness,
        assessment=assessment,
    )

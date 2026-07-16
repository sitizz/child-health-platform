from dataclasses import dataclass

from app.domain.scoring import ChildFactors, ForecastDayScore, RiskAssessment
from app.schemas.common import EscalationLevel, RiskLevel, TrendDirection


@dataclass
class RecommendedActions:
    immediate: list[str]
    caregiver: list[str]
    school: list[str]
    community: list[str]
    when_to_escalate: list[str]


@dataclass
class GuidanceBundle:
    summary: str
    key_points: list[str]
    caregiver: list[str]
    school: list[str]
    community: list[str]


@dataclass
class TrendInfo:
    direction: TrendDirection
    message: str


@dataclass
class EscalationInfo:
    level: EscalationLevel
    reason: str


def build_action_message(priority_alert: RiskLevel) -> str:
    if priority_alert == "high":
        return (
            "HIGH RISK: Immediately reduce outdoor exposure. Notify school staff, "
            "caregivers, or clinic. Monitor symptoms closely."
        )
    if priority_alert == "moderate":
        return (
            "MODERATE RISK: Limit outdoor activity, encourage hydration, "
            "monitor symptoms."
        )
    return "LOW RISK: Safe to continue normal activities with basic precautions."


def build_recommended_actions(
    assessment: RiskAssessment, factors: ChildFactors
) -> RecommendedActions:
    immediate: list[str] = []
    caregiver: list[str] = []
    school: list[str] = []
    community: list[str] = []
    escalation: list[str] = []

    heat = assessment.heat.level
    respiratory = assessment.respiratory.level
    dengue = assessment.dengue.level
    flood = assessment.flood.level

    if heat in ("moderate", "high") and factors.dehydration:
        immediate.append(
            "Move the child to a shaded or cooler area and begin oral hydration immediately."
        )
        caregiver.append(
            "Monitor for reduced urination, unusual tiredness, dizziness, or worsening weakness over the next few hours."
        )
        school.append(
            "Avoid outdoor activity and allow supervised rest in a cooler indoor area."
        )
        escalation.append(
            "Seek urgent care if dehydration symptoms worsen, the child becomes unusually drowsy, confused, or unable to drink."
        )
    elif heat in ("moderate", "high"):
        immediate.append(
            "Reduce outdoor heat exposure and encourage regular fluid intake."
        )
        caregiver.append(
            "Keep the child in shade or a cooler indoor space during peak heat periods."
        )
        school.append(
            "Reduce strenuous outdoor activity and increase hydration breaks."
        )

    if respiratory in ("moderate", "high") and (factors.asthma or factors.cough):
        immediate.append(
            "Reduce outdoor exposure and avoid strenuous activity until air quality improves."
        )
        caregiver.append(
            "Monitor breathing, coughing, wheezing, chest tightness, or unusual fatigue."
        )
        school.append(
            "Keep the child indoors where possible and reduce exposure to outdoor air pollution."
        )
        escalation.append(
            "Seek urgent care if breathing difficulty, persistent wheezing, bluish lips, or severe chest tightness occurs."
        )
    elif respiratory in ("moderate", "high"):
        caregiver.append(
            "Reduce prolonged outdoor exposure and monitor for new respiratory symptoms."
        )
        school.append(
            "Limit outdoor group activities during poor air quality periods."
        )

    if dengue in ("moderate", "high") and factors.fever and factors.mosquito_exposure:
        immediate.append(
            "Increase mosquito protection immediately and monitor fever progression closely."
        )
        caregiver.append(
            "Watch for dengue warning signs such as persistent fever, vomiting, abdominal pain, bleeding, unusual tiredness, or worsening weakness."
        )
        community.append(
            "Check nearby standing water and reduce mosquito breeding sites around the home, school, or community area."
        )
        escalation.append(
            "Seek clinical advice urgently if fever persists, warning signs appear, or the child becomes increasingly weak."
        )
    elif dengue in ("moderate", "high"):
        caregiver.append(
            "Use mosquito protection and reduce exposure to mosquito breeding areas."
        )
        community.append(
            "Remove standing water and monitor local mosquito exposure risk."
        )

    if flood in ("moderate", "high") or factors.flood_exposure:
        caregiver.append(
            "Avoid contact with contaminated floodwater and ensure drinking water is safe."
        )
        community.append(
            "Monitor for water contamination, blocked drainage, and local flood-related health risks."
        )
        escalation.append(
            "Seek care if diarrhoea, persistent fever, skin infection, or dehydration symptoms develop after flood exposure."
        )

    if not immediate:
        if assessment.priority_alert == "high":
            immediate.append(
                "Reduce exposure immediately and monitor the child closely."
            )
        elif assessment.priority_alert == "moderate":
            immediate.append(
                "Limit exposure and continue active symptom monitoring."
            )
        else:
            immediate.append(
                "Continue normal activities with routine environmental precautions."
            )

    if not caregiver:
        caregiver.append(
            "Continue routine monitoring and respond early if symptoms develop."
        )
    if not school:
        school.append(
            "Maintain routine supervision and ensure water access during school hours."
        )
    if not community:
        community.append(
            "Continue monitoring local environmental conditions and share updates when risk changes."
        )
    if not escalation:
        escalation.append(
            "Seek medical advice if symptoms worsen, persist, or the child appears unusually weak or unwell."
        )

    return RecommendedActions(
        immediate=immediate,
        caregiver=caregiver,
        school=school,
        community=community,
        when_to_escalate=escalation,
    )


def build_trend(forecast: list[ForecastDayScore]) -> TrendInfo:
    high_days = sum(1 for day in forecast if day.predicted_risk == "high")
    moderate_days = sum(1 for day in forecast if day.predicted_risk == "moderate")

    if high_days >= 2:
        return TrendInfo(
            direction="increasing",
            message="Environmental risk is increasing over the next 72 hours.",
        )
    if moderate_days >= 2:
        return TrendInfo(
            direction="stable",
            message="Moderate environmental risk is expected to persist.",
        )
    return TrendInfo(
        direction="decreasing",
        message="Environmental risk is expected to remain low or improve.",
    )


def build_escalation(forecast: list[ForecastDayScore]) -> EscalationInfo:
    high_days = sum(1 for day in forecast if day.predicted_risk == "high")
    moderate_days = sum(1 for day in forecast if day.predicted_risk == "moderate")

    if high_days >= 2:
        return EscalationInfo(
            level="urgent",
            reason="High-risk conditions are expected for multiple days.",
        )
    if moderate_days >= 2:
        return EscalationInfo(
            level="watch",
            reason="Moderate risk may worsen if conditions continue.",
        )
    return EscalationInfo(
        level="normal",
        reason="No major escalation risk detected.",
    )


def build_guidance(
    assessment: RiskAssessment, factors: ChildFactors
) -> GuidanceBundle:
    guidance_parts: list[str] = []

    if factors.age_group == "under5":
        guidance_parts.append(
            "Children under 5 can deteriorate more quickly during heat, dehydration, respiratory stress, and infectious disease exposure."
        )
    if assessment.heat.level in ("moderate", "high"):
        guidance_parts.append(
            "Heat exposure may increase dehydration risk, fatigue, and heat-related illness in vulnerable children."
        )
    if assessment.respiratory.level in ("moderate", "high"):
        guidance_parts.append(
            "Poor air quality may worsen coughing, wheezing, breathing discomfort, or asthma-related symptoms."
        )
    if assessment.dengue.level in ("moderate", "high"):
        guidance_parts.append(
            "Warm and humid conditions may increase mosquito activity and dengue exposure risk."
        )
    if factors.asthma:
        guidance_parts.append(
            "Children with asthma or respiratory vulnerability may require closer breathing monitoring during poor air quality conditions."
        )
    if factors.dehydration:
        guidance_parts.append(
            "Existing dehydration symptoms may worsen more rapidly during sustained heat exposure."
        )
    if factors.fever and factors.mosquito_exposure:
        guidance_parts.append(
            "Fever together with mosquito exposure should be monitored carefully for worsening infectious symptoms."
        )
    if factors.flood_exposure:
        guidance_parts.append(
            "Flood exposure may increase risk of contaminated water exposure, skin infection, and water-borne illness."
        )
    if not guidance_parts:
        guidance_parts.append(
            "Continue monitoring environmental conditions and maintain routine precautions."
        )

    caregiver: list[str] = []
    school: list[str] = []
    community: list[str] = []

    if assessment.heat.level in ("moderate", "high"):
        caregiver.append(
            "Increase hydration and reduce prolonged outdoor heat exposure."
        )
        school.append(
            "Limit prolonged outdoor activities during peak afternoon temperatures."
        )
    if assessment.respiratory.level in ("moderate", "high"):
        caregiver.append(
            "Monitor coughing, wheezing, or breathing difficulty in vulnerable children."
        )
        school.append(
            "Reduce outdoor group activities during periods of poor air quality."
        )
    if assessment.dengue.level in ("moderate", "high"):
        community.append(
            "Monitor standing water accumulation and mosquito exposure risk."
        )
    if assessment.flood.level in ("moderate", "high"):
        community.append(
            "Prepare for possible local flooding and water contamination exposure."
        )

    return GuidanceBundle(
        summary=guidance_parts[0],
        key_points=guidance_parts[1:],
        caregiver=caregiver,
        school=school,
        community=community,
    )

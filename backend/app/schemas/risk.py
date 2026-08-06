from pydantic import BaseModel, Field

from app.schemas.common import (
    AgeGroup,
    EscalationLevel,
    Location,
    RiskLevel,
    TrendDirection,
)


class RiskQueryParams(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lon: float = Field(..., ge=-180, le=180, description="Longitude")
    age_group: AgeGroup = "under5"
    asthma: bool = False
    fever: bool = False
    cough: bool = False
    dehydration: bool = False
    mosquito_exposure: bool = False
    flood_exposure: bool = False


class BatchLocation(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    id: str | None = Field(
        default=None,
        description="Optional client-provided id echoed in the response",
    )


class BatchRiskRequest(BaseModel):
    locations: list[BatchLocation] = Field(..., min_length=1, max_length=20)
    age_group: AgeGroup = "under5"
    asthma: bool = False
    fever: bool = False
    cough: bool = False
    dehydration: bool = False
    mosquito_exposure: bool = False
    flood_exposure: bool = False


class EnvironmentMetrics(BaseModel):
    temperature: float
    humidity: float
    rainfall: float
    aqi: float | None
    pm2_5: float | None
    pm10: float | None


class DomainRisks(BaseModel):
    heat_stress: RiskLevel
    respiratory: RiskLevel
    dengue: RiskLevel
    flood: RiskLevel


class RiskReasons(BaseModel):
    heat_stress: list[str]
    respiratory: list[str]
    dengue: list[str]
    flood: list[str]


class ChildVulnerability(BaseModel):
    level: RiskLevel
    reasons: list[str]


class PredictiveDomains(BaseModel):
    heat_stress: RiskLevel
    respiratory: RiskLevel
    dengue: RiskLevel
    flood: RiskLevel


class ForecastDay(BaseModel):
    day: int
    max_temperature: float
    rainfall: float
    predicted_risk: RiskLevel


class RecommendedAction(BaseModel):
    immediate: list[str]
    caregiver: list[str]
    school: list[str]
    community: list[str]
    when_to_escalate: list[str]


class Trend(BaseModel):
    direction: TrendDirection
    message: str


class Escalation(BaseModel):
    level: EscalationLevel
    reason: str


class Guidance(BaseModel):
    group: AgeGroup
    summary: str
    key_points: list[str]


class StakeholderGuidance(BaseModel):
    caregiver: list[str]
    school: list[str]
    community: list[str]


class DomainLabels(BaseModel):
    heat_stress: str = "Heat Stress"
    respiratory: str = "Respiratory"
    dengue: str = "Dengue"
    flood: str = "Flood"


class MLPredictionSummary(BaseModel):
    predicted_domain: str
    confidence: float
    agrees_with_engine: bool
    engine_primary_domain: str
    model_version: str
    note: str


class SimplifiedActions(BaseModel):
    summary: str
    immediate: list[str]
    when_to_escalate: list[str]
    average_flesch_kincaid_grade: float | None = None
    source: str = "rules"
    llm_model: str | None = None


class EnvironmentRiskResponse(BaseModel):
    location: Location
    age_group: AgeGroup
    environment: EnvironmentMetrics
    risks: DomainRisks
    risk_reasons: RiskReasons
    child_vulnerability: ChildVulnerability
    predictive_domains: PredictiveDomains
    priority_alert: RiskLevel
    forecast: list[ForecastDay]
    action: str
    recommended_action: RecommendedAction
    trend: Trend
    escalation: Escalation
    guidance: Guidance
    stakeholder_guidance: StakeholderGuidance
    domain_labels: DomainLabels
    model_version: str
    disclaimer: str
    ml_prediction: MLPredictionSummary | None = None
    simplified: SimplifiedActions | None = None
    language: str = "en"


class BatchRiskItem(BaseModel):
    id: str | None = None
    result: EnvironmentRiskResponse | None = None
    error: str | None = None


class BatchRiskResponse(BaseModel):
    results: list[BatchRiskItem]
    model_version: str

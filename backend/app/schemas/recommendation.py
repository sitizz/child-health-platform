from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import RiskLevel
from app.schemas.ml import MLPredictionResult, SimplifiedRecommendation


class Explanation(BaseModel):
    why: str
    environmental_factors: list[str]
    child_factors: list[str]


class RecommendationResult(BaseModel):
    overall_risk: RiskLevel
    primary_hazards: list[str]
    explanation: Explanation
    priority_actions: list[str]
    secondary_actions: list[str]
    monitoring_advice: list[str]
    escalation_advice: list[str]
    disclaimer: str
    model_version: str
    data_completeness: Literal["full", "limited"]
    environment: dict[str, Any] | None = None
    risks: dict[str, Any] | None = None
    child_id: UUID | None = None
    assessment_id: UUID | None = None
    ml_prediction: MLPredictionResult | None = None
    simplified: SimplifiedRecommendation | None = None
    language: str = "en"


class RecommendationEvaluateRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    child_id: UUID | None = None
    age: int | None = Field(default=None, ge=0, le=18)
    conditions: dict[str, Any] = Field(default_factory=dict)
    allergies: dict[str, Any] = Field(default_factory=dict)
    symptoms: dict[str, Any] = Field(default_factory=dict)
    exposures: dict[str, Any] = Field(default_factory=dict)
    language: str | None = Field(
        default=None,
        description="Preferred response language (en, ms, ur, id)",
    )

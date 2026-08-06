from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.common import AgeGroup


class MLPredictionResult(BaseModel):
    predicted_domain: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    agrees_with_engine: bool
    engine_primary_domain: str
    probabilities: dict[str, float]
    model_version: str
    note: str


class SimplifiedRecommendation(BaseModel):
    summary: str
    why: str
    priority_actions: list[str]
    secondary_actions: list[str]
    monitoring_advice: list[str]
    escalation_advice: list[str]
    readability: dict[str, Any]
    source: Literal["gemini", "rules"] = "rules"
    llm_model: str | None = None


class MLPredictRequest(BaseModel):
    age_group: AgeGroup = "under5"
    asthma: bool = False
    fever: bool = False
    cough: bool = False
    dehydration: bool = False
    mosquito_exposure: bool = False
    flood_exposure: bool = False
    temperature: float = Field(..., ge=-50, le=60)
    humidity: float = Field(..., ge=0, le=100)
    rainfall: float = Field(..., ge=0, le=500)
    aqi: float | None = Field(default=None, ge=0)
    pm2_5: float | None = Field(default=None, ge=0)
    pm10: float | None = Field(default=None, ge=0)
    engine_primary_domain: str | None = None


class MLPredictResponse(BaseModel):
    prediction: MLPredictionResult
    disclaimer: str


class MLStatusResponse(BaseModel):
    classifier_loaded: bool
    classifier_version: str
    feature_names: list[str]
    risk_domains: list[str]
    vision_status: Literal["not_implemented"] = "not_implemented"
    audio_status: Literal["not_implemented"] = "not_implemented"
    supported_languages: list[str]
    llm_enabled: bool = False
    llm_provider: str = "gemini"
    llm_model: str | None = None

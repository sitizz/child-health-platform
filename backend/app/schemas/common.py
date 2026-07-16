from typing import Any, Literal

from pydantic import BaseModel, Field

RiskLevel = Literal["low", "moderate", "high"]
AgeGroup = Literal["under5", "child", "adolescent"]
TrendDirection = Literal["increasing", "stable", "decreasing"]
EscalationLevel = Literal["urgent", "watch", "normal"]


class ErrorDetail(BaseModel):
    code: str
    message: str
    request_id: str | None = None
    details: dict[str, Any] | None = None


class ErrorResponse(BaseModel):
    error: ErrorDetail


class Location(BaseModel):
    lat: float = Field(..., ge=-90, le=90, examples=[24.8607])
    lon: float = Field(..., ge=-180, le=180, examples=[67.0011])

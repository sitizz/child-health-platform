from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.schemas.child import ChildOut
from app.schemas.recommendation import RecommendationResult


class ChildRiskSummary(BaseModel):
    child: ChildOut
    latest_priority: str | None = None
    latest_assessment_at: datetime | None = None
    latest_hazards: list[str] = []


class PanelOverviewResponse(BaseModel):
    selected_child_id: UUID | None
    children: list[ChildRiskSummary]
    open_alerts_count: int
    consent_accepted: bool
    disclaimer_acknowledged: bool
    household_priority: str | None = None


class HistoryItem(BaseModel):
    id: UUID
    kind: str
    child_id: UUID | None = None
    priority: str | None = None
    title: str | None = None
    body: str | None = None
    summary: dict[str, Any] | None = None
    created_at: datetime


class PanelHistoryResponse(BaseModel):
    items: list[HistoryItem]


class PanelRecommendationsResponse(BaseModel):
    items: list[RecommendationResult]

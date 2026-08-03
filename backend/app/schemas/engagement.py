from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, model_validator

EngagementEventType = Literal["add_child", "share_summary", "risk_check"]


class EngagementEventCreate(BaseModel):
    event_type: EngagementEventType
    metadata: dict[str, Any] | None = None


class EngagementEventOut(BaseModel):
    id: UUID
    caregiver_id: UUID | None
    event_type: str
    metadata: dict[str, Any] | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="wrap")
    @classmethod
    def map_event_metadata(cls, data: Any, handler: Any) -> "EngagementEventOut":
        if hasattr(data, "event_metadata") and not isinstance(data, dict):
            return handler(
                {
                    "id": data.id,
                    "caregiver_id": data.caregiver_id,
                    "event_type": data.event_type,
                    "metadata": data.event_metadata,
                    "created_at": data.created_at,
                }
            )
        return handler(data)


class DailyEngagement(BaseModel):
    date: date
    add_child: int = 0
    share_summary: int = 0
    risk_check: int = 0


class EngagementMetrics(BaseModel):
    total_events: int
    by_type: dict[str, int]
    daily: list[DailyEngagement]

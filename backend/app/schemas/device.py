from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class DeviceRegisterRequest(BaseModel):
    expo_push_token: str = Field(min_length=8, max_length=255)
    platform: str | None = Field(default=None, max_length=32)


class DeviceOut(BaseModel):
    id: UUID
    expo_push_token: str
    platform: str | None
    active: bool
    last_seen_at: datetime

    model_config = {"from_attributes": True}


class NotificationTestRequest(BaseModel):
    title: str = "Child Guard test"
    body: str = "Push notifications are working."


class DispatchResponse(BaseModel):
    processed_children: int
    notifications_sent: int
    skipped: int

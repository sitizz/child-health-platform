from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class DisclaimerCurrentResponse(BaseModel):
    version: str
    text: str


class DisclaimerStatusResponse(BaseModel):
    acknowledged: bool
    version: str | None = None
    current_version: str
    acknowledged_at: datetime | None = None


class DisclaimerAckOut(BaseModel):
    id: UUID
    version: str
    acknowledged_at: datetime

    model_config = {"from_attributes": True}

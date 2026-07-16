from typing import Literal

from pydantic import BaseModel


class RootStatusResponse(BaseModel):
    status: str
    service: str
    version: str


class HealthResponse(BaseModel):
    status: Literal["ok"]


class ReadinessResponse(BaseModel):
    status: Literal["ready", "degraded", "not_ready"]
    checks: dict[str, str]

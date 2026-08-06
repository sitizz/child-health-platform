from typing import Literal

from pydantic import BaseModel, Field


class AudioAnalysisRequest(BaseModel):
    """Contract for future cough-sound classification."""

    audio_base64: str = Field(
        ...,
        min_length=1,
        description="Base64-encoded audio payload (WAV/M4A).",
    )
    duration_seconds: float | None = Field(default=None, ge=0.1, le=60)
    child_age: int | None = Field(default=None, ge=0, le=18)


class AudioAnalysisResponse(BaseModel):
    status: Literal["not_implemented"] = "not_implemented"
    message: str
    planned_capabilities: list[str]

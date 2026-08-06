from typing import Literal

from pydantic import BaseModel, Field


class ImageAnalysisRequest(BaseModel):
    """Contract for future camera-based wound/rash/nutrition analysis."""

    image_base64: str = Field(
        ...,
        min_length=1,
        description="Base64-encoded image payload (JPEG/PNG).",
    )
    analysis_type: Literal["wound", "rash", "nutrition", "other"] = "rash"
    child_age: int | None = Field(default=None, ge=0, le=18)


class ImageAnalysisResponse(BaseModel):
    status: Literal["not_implemented"] = "not_implemented"
    message: str
    analysis_type: str
    planned_capabilities: list[str]

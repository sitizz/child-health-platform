from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class ChildCreate(BaseModel):
    name: str | None = Field(default=None, max_length=150)
    age: int = Field(..., ge=0, le=18)
    sex: str | None = Field(default=None, max_length=32)
    conditions: dict[str, Any] = Field(default_factory=dict)
    allergies: dict[str, Any] = Field(default_factory=dict)
    symptoms: dict[str, Any] = Field(default_factory=dict)
    exposures: dict[str, Any] = Field(default_factory=dict)
    is_selected: bool = False


class ChildUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=150)
    age: int | None = Field(default=None, ge=0, le=18)
    sex: str | None = Field(default=None, max_length=32)
    conditions: dict[str, Any] | None = None
    allergies: dict[str, Any] | None = None
    symptoms: dict[str, Any] | None = None
    exposures: dict[str, Any] | None = None


class ChildOut(BaseModel):
    id: UUID
    caregiver_id: UUID
    name: str | None
    age: int
    sex: str | None
    is_selected: bool
    conditions: dict[str, Any]
    allergies: dict[str, Any]
    symptoms: dict[str, Any]
    exposures: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

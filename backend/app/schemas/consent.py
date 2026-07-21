from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class ConsentCheckboxes(BaseModel):
    caregiver_authority: bool
    read_understood: bool
    not_diagnostic: bool
    data_processing: bool
    location: bool
    notifications_opt_in: bool = False

    @model_validator(mode="after")
    def require_core_boxes(self) -> "ConsentCheckboxes":
        required = [
            self.caregiver_authority,
            self.read_understood,
            self.not_diagnostic,
            self.data_processing,
            self.location,
        ]
        if not all(required):
            raise ValueError(
                "All required consent checkboxes must be accepted "
                "(caregiver_authority, read_understood, not_diagnostic, "
                "data_processing, location)"
            )
        return self


class ConsentAcceptRequest(BaseModel):
    checkboxes: ConsentCheckboxes


class ConsentCurrentResponse(BaseModel):
    version: str
    title: str
    subtitle: str
    about: str
    information_we_collect: list[str]
    how_information_is_used: list[str]
    medical_disclaimer: str
    privacy: str
    required_checkboxes: list[str]
    optional_checkboxes: list[str]
    privacy_policy_url: str
    terms_url: str


class ConsentStatusResponse(BaseModel):
    accepted: bool
    version: str | None = None
    current_version: str
    notifications_opt_in: bool = False
    accepted_at: datetime | None = None
    withdrawn_at: datetime | None = None
    consent_id: UUID | None = None


class ConsentRecordOut(BaseModel):
    id: UUID
    version: str
    notifications_opt_in: bool
    accepted_at: datetime
    withdrawn_at: datetime | None

    model_config = {"from_attributes": True}

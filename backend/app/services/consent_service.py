from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.models.consent import Consent
from app.schemas.consent import (
    ConsentAcceptRequest,
    ConsentCurrentResponse,
    ConsentRecordOut,
    ConsentStatusResponse,
)


CONSENT_COPY = ConsentCurrentResponse(
    version="consent-v1",
    title="Welcome to Child Guard Health",
    subtitle="Smarter Signals. Safer Children.",
    about=(
        "Child Guard Health (CG Health) is an AI-powered environmental intelligence "
        "platform designed to help caregivers better understand climate-related "
        "environmental health risks affecting children."
    ),
    information_we_collect=[
        "Your account information (e.g. name and email address)",
        "Your child's profile (e.g. age, existing health conditions, and optional symptoms)",
        "Your location (with your permission) to provide local environmental information",
        "Device information required for notifications and app functionality",
    ],
    how_information_is_used=[
        "Generate personalised environmental health recommendations",
        "Deliver environmental alerts and notifications",
        "Improve platform performance and user experience",
        "Support future research using anonymised or aggregated data where appropriate",
    ],
    medical_disclaimer=(
        "Child Guard Health provides environmental health guidance and preventive "
        "recommendations only. The platform does not diagnose medical conditions, "
        "replace healthcare professionals, prescribe treatment or medication, or "
        "provide emergency medical services."
    ),
    privacy=(
        "You may access and update your information, delete your account, withdraw "
        "consent at any time, and manage location and notification permissions in Settings."
    ),
    required_checkboxes=[
        "caregiver_authority",
        "read_understood",
        "not_diagnostic",
        "data_processing",
        "location",
    ],
    optional_checkboxes=["notifications_opt_in"],
    privacy_policy_url="",
    terms_url="",
)


class ConsentService:
    def __init__(self, db: AsyncSession, settings: Settings) -> None:
        self.db = db
        self.settings = settings

    def current(self) -> ConsentCurrentResponse:
        copy = CONSENT_COPY.model_copy()
        copy.version = self.settings.consent_version
        copy.privacy_policy_url = self.settings.privacy_policy_url
        copy.terms_url = self.settings.terms_url
        copy.medical_disclaimer = self.settings.disclaimer
        return copy

    async def status(self, caregiver_id) -> ConsentStatusResponse:
        result = await self.db.execute(
            select(Consent)
            .where(Consent.caregiver_id == caregiver_id)
            .order_by(Consent.accepted_at.desc())
        )
        latest = result.scalars().first()
        if latest is None or latest.withdrawn_at is not None:
            return ConsentStatusResponse(
                accepted=False, current_version=self.settings.consent_version
            )
        accepted = (
            latest.version == self.settings.consent_version
            and latest.withdrawn_at is None
        )
        return ConsentStatusResponse(
            accepted=accepted,
            version=latest.version,
            current_version=self.settings.consent_version,
            notifications_opt_in=latest.notifications_opt_in,
            accepted_at=latest.accepted_at,
            withdrawn_at=latest.withdrawn_at,
            consent_id=latest.id,
        )

    async def accept(self, caregiver_id, payload: ConsentAcceptRequest) -> ConsentRecordOut:
        # Withdraw previous active consents
        result = await self.db.execute(
            select(Consent).where(
                Consent.caregiver_id == caregiver_id,
                Consent.withdrawn_at.is_(None),
            )
        )
        for row in result.scalars().all():
            row.withdrawn_at = datetime.now(timezone.utc)

        record = Consent(
            id=uuid4(),
            caregiver_id=caregiver_id,
            version=self.settings.consent_version,
            checkboxes=payload.checkboxes.model_dump(),
            notifications_opt_in=payload.checkboxes.notifications_opt_in,
        )
        self.db.add(record)
        await self.db.commit()
        await self.db.refresh(record)
        return ConsentRecordOut.model_validate(record)

    async def withdraw(self, caregiver_id) -> ConsentStatusResponse:
        result = await self.db.execute(
            select(Consent).where(
                Consent.caregiver_id == caregiver_id,
                Consent.withdrawn_at.is_(None),
            )
        )
        rows = result.scalars().all()
        if not rows:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active consent to withdraw",
            )
        now = datetime.now(timezone.utc)
        for row in rows:
            row.withdrawn_at = now
        await self.db.commit()
        return await self.status(caregiver_id)

    async def require_valid(self, caregiver_id) -> Consent:
        status_obj = await self.status(caregiver_id)
        if not status_obj.accepted:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="consent_required",
            )
        result = await self.db.execute(
            select(Consent).where(Consent.id == status_obj.consent_id)
        )
        return result.scalar_one()

from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.models.disclaimer import DisclaimerAck
from app.schemas.disclaimer import (
    DisclaimerAckOut,
    DisclaimerCurrentResponse,
    DisclaimerStatusResponse,
)


class DisclaimerService:
    def __init__(self, db: AsyncSession, settings: Settings) -> None:
        self.db = db
        self.settings = settings

    def current(self) -> DisclaimerCurrentResponse:
        return DisclaimerCurrentResponse(
            version=self.settings.disclaimer_version,
            text=self.settings.disclaimer,
        )

    async def status(self, caregiver_id) -> DisclaimerStatusResponse:
        result = await self.db.execute(
            select(DisclaimerAck).where(
                DisclaimerAck.caregiver_id == caregiver_id,
                DisclaimerAck.version == self.settings.disclaimer_version,
            )
        )
        row = result.scalar_one_or_none()
        return DisclaimerStatusResponse(
            acknowledged=row is not None,
            version=row.version if row else None,
            current_version=self.settings.disclaimer_version,
            acknowledged_at=row.acknowledged_at if row else None,
        )

    async def acknowledge(self, caregiver_id) -> DisclaimerAckOut:
        existing = await self.status(caregiver_id)
        if existing.acknowledged:
            result = await self.db.execute(
                select(DisclaimerAck).where(
                    DisclaimerAck.caregiver_id == caregiver_id,
                    DisclaimerAck.version == self.settings.disclaimer_version,
                )
            )
            return DisclaimerAckOut.model_validate(result.scalar_one())

        row = DisclaimerAck(
            id=uuid4(),
            caregiver_id=caregiver_id,
            version=self.settings.disclaimer_version,
        )
        self.db.add(row)
        await self.db.commit()
        await self.db.refresh(row)
        return DisclaimerAckOut.model_validate(row)

    async def require_ack(self, caregiver_id) -> None:
        status_obj = await self.status(caregiver_id)
        if not status_obj.acknowledged:
            from fastapi import HTTPException

            raise HTTPException(status_code=403, detail="disclaimer_required")

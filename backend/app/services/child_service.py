from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.models.child import Child
from app.schemas.child import ChildCreate, ChildOut, ChildUpdate


class ChildService:
    def __init__(self, db: AsyncSession, settings: Settings) -> None:
        self.db = db
        self.settings = settings

    async def list(self, caregiver_id: UUID) -> list[ChildOut]:
        result = await self.db.execute(
            select(Child)
            .where(Child.caregiver_id == caregiver_id)
            .order_by(Child.created_at.asc())
        )
        return [ChildOut.model_validate(c) for c in result.scalars().all()]

    async def get(self, caregiver_id: UUID, child_id: UUID) -> Child:
        result = await self.db.execute(
            select(Child).where(
                Child.id == child_id, Child.caregiver_id == caregiver_id
            )
        )
        child = result.scalar_one_or_none()
        if child is None:
            raise HTTPException(status_code=404, detail="Child not found")
        return child

    async def create(self, caregiver_id: UUID, payload: ChildCreate) -> ChildOut:
        count = await self.db.scalar(
            select(func.count()).select_from(Child).where(Child.caregiver_id == caregiver_id)
        )
        if (count or 0) >= self.settings.max_children_per_caregiver:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Maximum of {self.settings.max_children_per_caregiver} children allowed",
            )
        if payload.is_selected or (count or 0) == 0:
            await self.db.execute(
                update(Child)
                .where(Child.caregiver_id == caregiver_id)
                .values(is_selected=False)
            )
            is_selected = True
        else:
            is_selected = False

        child = Child(
            id=uuid4(),
            caregiver_id=caregiver_id,
            name=payload.name,
            age=payload.age,
            sex=payload.sex,
            is_selected=is_selected,
            conditions=payload.conditions,
            allergies=payload.allergies,
            symptoms=payload.symptoms,
            exposures=payload.exposures,
        )
        self.db.add(child)
        await self.db.commit()
        await self.db.refresh(child)
        return ChildOut.model_validate(child)

    async def update(
        self, caregiver_id: UUID, child_id: UUID, payload: ChildUpdate
    ) -> ChildOut:
        child = await self.get(caregiver_id, child_id)
        data = payload.model_dump(exclude_unset=True)
        for key, value in data.items():
            setattr(child, key, value)
        await self.db.commit()
        await self.db.refresh(child)
        return ChildOut.model_validate(child)

    async def delete(self, caregiver_id: UUID, child_id: UUID) -> None:
        child = await self.get(caregiver_id, child_id)
        was_selected = child.is_selected
        await self.db.delete(child)
        await self.db.flush()
        if was_selected:
            result = await self.db.execute(
                select(Child)
                .where(Child.caregiver_id == caregiver_id)
                .order_by(Child.created_at.asc())
                .limit(1)
            )
            nxt = result.scalar_one_or_none()
            if nxt:
                nxt.is_selected = True
        await self.db.commit()

    async def select(self, caregiver_id: UUID, child_id: UUID) -> ChildOut:
        child = await self.get(caregiver_id, child_id)
        await self.db.execute(
            update(Child)
            .where(Child.caregiver_id == caregiver_id)
            .values(is_selected=False)
        )
        child.is_selected = True
        await self.db.commit()
        await self.db.refresh(child)
        return ChildOut.model_validate(child)

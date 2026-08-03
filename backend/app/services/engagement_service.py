from datetime import date, datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import cast, Date, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.models.engagement import EngagementEvent
from app.schemas.engagement import (
    DailyEngagement,
    EngagementEventOut,
    EngagementEventType,
    EngagementMetrics,
)


class EngagementService:
    def __init__(self, db: AsyncSession, settings: Settings) -> None:
        self.db = db
        self.settings = settings

    async def log_event(
        self,
        event_type: EngagementEventType | str,
        caregiver_id: UUID | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> EngagementEventOut:
        event = EngagementEvent(
            id=uuid4(),
            caregiver_id=caregiver_id,
            event_type=event_type,
            event_metadata=metadata or {},
        )
        self.db.add(event)
        await self.db.commit()
        await self.db.refresh(event)
        return EngagementEventOut.model_validate(event)

    async def get_metrics(
        self,
        caregiver_id: UUID,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> EngagementMetrics:
        filters = [EngagementEvent.caregiver_id == caregiver_id]
        if from_date is not None:
            start = datetime.combine(from_date, datetime.min.time(), tzinfo=timezone.utc)
            filters.append(EngagementEvent.created_at >= start)
        if to_date is not None:
            end = datetime.combine(to_date, datetime.max.time(), tzinfo=timezone.utc)
            filters.append(EngagementEvent.created_at <= end)

        by_type_rows = await self.db.execute(
            select(EngagementEvent.event_type, func.count())
            .where(*filters)
            .group_by(EngagementEvent.event_type)
        )
        by_type: dict[str, int] = {
            "add_child": 0,
            "share_summary": 0,
            "risk_check": 0,
        }
        total_events = 0
        for event_type, count in by_type_rows.all():
            by_type[event_type] = count
            total_events += count

        day_col = cast(EngagementEvent.created_at, Date)
        daily_rows = await self.db.execute(
            select(
                day_col.label("day"),
                EngagementEvent.event_type,
                func.count(),
            )
            .where(*filters)
            .group_by(day_col, EngagementEvent.event_type)
            .order_by(day_col.asc())
        )

        daily_map: dict[date, DailyEngagement] = {}
        for day, event_type, count in daily_rows.all():
            if day not in daily_map:
                daily_map[day] = DailyEngagement(date=day)
            entry = daily_map[day]
            if event_type == "add_child":
                entry.add_child = count
            elif event_type == "share_summary":
                entry.share_summary = count
            elif event_type == "risk_check":
                entry.risk_check = count

        return EngagementMetrics(
            total_events=total_events,
            by_type=by_type,
            daily=list(daily_map.values()),
        )

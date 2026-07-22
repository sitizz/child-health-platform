from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.models.assessment import RiskAssessment
from app.models.notification import NotificationLog
from app.schemas.panel import (
    ChildRiskSummary,
    HistoryItem,
    PanelHistoryResponse,
    PanelOverviewResponse,
    PanelRecommendationsResponse,
)
from app.schemas.recommendation import Explanation, RecommendationResult
from app.services.child_service import ChildService
from app.services.consent_service import ConsentService
from app.services.disclaimer_service import DisclaimerService


class PanelService:
    def __init__(self, db: AsyncSession, settings: Settings) -> None:
        self.db = db
        self.settings = settings
        self.children = ChildService(db, settings)
        self.consent = ConsentService(db, settings)
        self.disclaimer = DisclaimerService(db, settings)

    async def _latest_assessments_by_child(
        self, child_ids: set[UUID]
    ) -> dict[UUID, RiskAssessment]:
        """Single query; keep newest assessment per child (no N+1)."""
        if not child_ids:
            return {}
        rows = await self.db.execute(
            select(RiskAssessment)
            .where(RiskAssessment.child_id.in_(child_ids))
            .order_by(
                RiskAssessment.child_id,
                RiskAssessment.created_at.desc(),
            )
        )
        latest: dict[UUID, RiskAssessment] = {}
        for row in rows.scalars().all():
            if row.child_id not in latest:
                latest[row.child_id] = row
        return latest

    async def overview(self, caregiver_id: UUID) -> PanelOverviewResponse:
        kids = await self.children.list(caregiver_id)
        child_ids = {k.id for k in kids}
        latest_map = await self._latest_assessments_by_child(child_ids)

        summaries: list[ChildRiskSummary] = []
        priorities: list[str] = []
        selected_id = None

        for kid in kids:
            if kid.is_selected:
                selected_id = kid.id
            latest = latest_map.get(kid.id)
            priority = latest.priority if latest else None
            if priority:
                priorities.append(priority)
            summaries.append(
                ChildRiskSummary(
                    child=kid,
                    latest_priority=priority,
                    latest_assessment_at=latest.created_at if latest else None,
                    latest_hazards=(latest.summary or {}).get("primary_hazards", [])
                    if latest
                    else [],
                )
            )

        consent = await self.consent.status(caregiver_id)
        disclaimer = await self.disclaimer.status(caregiver_id)
        alert_count = await self.db.scalar(
            select(func.count())
            .select_from(NotificationLog)
            .where(
                NotificationLog.caregiver_id == caregiver_id,
                NotificationLog.type == "high_risk",
            )
        )

        household = None
        if "high" in priorities:
            household = "high"
        elif "moderate" in priorities:
            household = "moderate"
        elif priorities:
            household = "low"

        return PanelOverviewResponse(
            selected_child_id=selected_id,
            children=summaries,
            open_alerts_count=int(alert_count or 0),
            consent_accepted=consent.accepted,
            disclaimer_acknowledged=disclaimer.acknowledged,
            household_priority=household,
        )

    async def history(
        self, caregiver_id: UUID, child_id: UUID | None, limit: int = 50
    ) -> PanelHistoryResponse:
        kids = await self.children.list(caregiver_id)
        child_ids = {k.id for k in kids}
        if child_id and child_id not in child_ids:
            from fastapi import HTTPException

            raise HTTPException(status_code=404, detail="Child not found")

        items: list[HistoryItem] = []
        if not child_ids:
            return PanelHistoryResponse(items=[])

        assess_q = select(RiskAssessment).order_by(RiskAssessment.created_at.desc())
        if child_id:
            assess_q = assess_q.where(RiskAssessment.child_id == child_id)
        else:
            assess_q = assess_q.where(RiskAssessment.child_id.in_(child_ids))
        assess_rows = await self.db.execute(assess_q.limit(limit))
        for row in assess_rows.scalars().all():
            items.append(
                HistoryItem(
                    id=row.id,
                    kind="assessment",
                    child_id=row.child_id,
                    priority=row.priority,
                    summary=row.summary,
                    created_at=row.created_at,
                )
            )

        notif_q = (
            select(NotificationLog)
            .where(NotificationLog.caregiver_id == caregiver_id)
            .order_by(NotificationLog.sent_at.desc())
            .limit(limit)
        )
        if child_id:
            notif_q = notif_q.where(NotificationLog.child_id == child_id)
        notif_rows = await self.db.execute(notif_q)
        for row in notif_rows.scalars().all():
            items.append(
                HistoryItem(
                    id=row.id,
                    kind="notification",
                    child_id=row.child_id,
                    title=row.title,
                    body=row.body,
                    created_at=row.sent_at,
                )
            )

        items.sort(key=lambda x: x.created_at, reverse=True)
        return PanelHistoryResponse(items=items[:limit])

    async def recommendations(
        self, caregiver_id: UUID, child_id: UUID | None = None
    ) -> PanelRecommendationsResponse:
        kids = await self.children.list(caregiver_id)
        if child_id:
            kids = [k for k in kids if k.id == child_id]
            if not kids:
                from fastapi import HTTPException

                raise HTTPException(status_code=404, detail="Child not found")

        latest_map = await self._latest_assessments_by_child({k.id for k in kids})
        items: list[RecommendationResult] = []
        for kid in kids:
            latest = latest_map.get(kid.id)
            if not latest:
                continue
            summary = latest.summary or {}
            items.append(
                RecommendationResult(
                    overall_risk=latest.priority,  # type: ignore[arg-type]
                    primary_hazards=summary.get("primary_hazards", []),
                    explanation=Explanation(
                        why=summary.get("why", ""),
                        environmental_factors=summary.get(
                            "environmental_factors", []
                        ),
                        child_factors=summary.get("child_factors", []),
                    ),
                    priority_actions=summary.get("priority_actions", []),
                    secondary_actions=summary.get("secondary_actions", []),
                    monitoring_advice=summary.get("monitoring_advice", []),
                    escalation_advice=summary.get("escalation_advice", []),
                    disclaimer=self.settings.disclaimer,
                    model_version=summary.get(
                        "model_version", self.settings.model_version
                    ),
                    data_completeness=summary.get("data_completeness", "limited"),
                    environment=summary.get("environment"),
                    risks=summary.get("risks"),
                    child_id=kid.id,
                    assessment_id=latest.id,
                )
            )
        return PanelRecommendationsResponse(items=items)

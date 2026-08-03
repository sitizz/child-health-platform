from datetime import date

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_caregiver, get_engagement_service, get_optional_caregiver
from app.models.caregiver import Caregiver
from app.schemas.engagement import EngagementEventCreate, EngagementEventOut, EngagementMetrics
from app.services.engagement_service import EngagementService

router = APIRouter(prefix="/engagement", tags=["Engagement"])


@router.post("/track", response_model=EngagementEventOut, status_code=201)
async def track_engagement(
    payload: EngagementEventCreate,
    caregiver: Caregiver | None = Depends(get_optional_caregiver),
    service: EngagementService = Depends(get_engagement_service),
) -> EngagementEventOut:
    return await service.log_event(
        event_type=payload.event_type,
        caregiver_id=caregiver.id if caregiver else None,
        metadata=payload.metadata,
    )


@router.get("/metrics", response_model=EngagementMetrics)
async def get_engagement_metrics(
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    caregiver: Caregiver = Depends(get_current_caregiver),
    service: EngagementService = Depends(get_engagement_service),
) -> EngagementMetrics:
    return await service.get_metrics(
        caregiver_id=caregiver.id,
        from_date=from_date,
        to_date=to_date,
    )

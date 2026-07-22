from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_panel_service, require_personalised_access
from app.models.caregiver import Caregiver
from app.schemas.panel import (
    PanelHistoryResponse,
    PanelOverviewResponse,
    PanelRecommendationsResponse,
)
from app.services.panel_service import PanelService

router = APIRouter(prefix="/panel", tags=["ParentPanel"])


@router.get("/overview", response_model=PanelOverviewResponse)
async def panel_overview(
    caregiver: Caregiver = Depends(require_personalised_access),
    service: PanelService = Depends(get_panel_service),
) -> PanelOverviewResponse:
    return await service.overview(caregiver.id)


@router.get("/history", response_model=PanelHistoryResponse)
async def panel_history(
    child_id: UUID | None = None,
    limit: int = Query(50, ge=1, le=200),
    caregiver: Caregiver = Depends(require_personalised_access),
    service: PanelService = Depends(get_panel_service),
) -> PanelHistoryResponse:
    return await service.history(caregiver.id, child_id, limit)


@router.get("/recommendations", response_model=PanelRecommendationsResponse)
async def panel_recommendations(
    child_id: UUID | None = None,
    caregiver: Caregiver = Depends(require_personalised_access),
    service: PanelService = Depends(get_panel_service),
) -> PanelRecommendationsResponse:
    return await service.recommendations(caregiver.id, child_id)

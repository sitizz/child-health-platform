from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_recommendation_service, require_personalised_access
from app.models.caregiver import Caregiver
from app.schemas.recommendation import (
    RecommendationEvaluateRequest,
    RecommendationResult,
)
from app.services.recommendation_service import RecommendationService

router = APIRouter(tags=["Recommendations"])


@router.post(
    "/recommendations/evaluate",
    response_model=RecommendationResult,
    summary="Evaluate explainable AI recommendations",
)
async def evaluate_recommendations(
    payload: RecommendationEvaluateRequest,
    caregiver: Caregiver = Depends(require_personalised_access),
    service: RecommendationService = Depends(get_recommendation_service),
) -> RecommendationResult:
    return await service.evaluate(caregiver.id, payload, persist=True)


@router.get(
    "/children/{child_id}/recommendations",
    response_model=RecommendationResult,
    summary="Recommendations for a child at a location",
)
async def child_recommendations(
    child_id: UUID,
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    caregiver: Caregiver = Depends(require_personalised_access),
    service: RecommendationService = Depends(get_recommendation_service),
) -> RecommendationResult:
    payload = RecommendationEvaluateRequest(lat=lat, lon=lon, child_id=child_id)
    return await service.evaluate(caregiver.id, payload, persist=True)

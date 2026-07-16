"""Backward-compatible unversioned routes for existing mobile clients."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request

from app.api.deps import get_risk_service
from app.api.v1.routes.risk import _dynamic_rate_limit, limiter
from app.core.security import require_api_key
from app.schemas.common import ErrorResponse
from app.schemas.risk import EnvironmentRiskResponse, RiskQueryParams
from app.services.risk_service import RiskService

router = APIRouter(tags=["Legacy"], dependencies=[Depends(require_api_key)])


@router.get(
    "/environment-risk",
    response_model=EnvironmentRiskResponse,
    deprecated=True,
    summary="[Deprecated] Evaluate environmental risk (use /api/v1/environment-risk)",
    responses={
        401: {"model": ErrorResponse, "description": "Missing or invalid API key"},
        422: {"model": ErrorResponse, "description": "Validation error"},
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
        503: {"model": ErrorResponse, "description": "Upstream unavailable"},
    },
)
@limiter.limit(_dynamic_rate_limit)
async def legacy_environment_risk(
    request: Request,
    lat: Annotated[float, Query(ge=-90, le=90)],
    lon: Annotated[float, Query(ge=-180, le=180)],
    age_group: Annotated[
        Literal["under5", "child", "adolescent"], Query()
    ] = "under5",
    asthma: bool = False,
    fever: bool = False,
    cough: bool = False,
    dehydration: bool = False,
    mosquito_exposure: bool = False,
    flood_exposure: bool = False,
    risk_service: RiskService = Depends(get_risk_service),
) -> EnvironmentRiskResponse:
    query = RiskQueryParams(
        lat=lat,
        lon=lon,
        age_group=age_group,
        asthma=asthma,
        fever=fever,
        cough=cough,
        dehydration=dehydration,
        mosquito_exposure=mosquito_exposure,
        flood_exposure=flood_exposure,
    )
    return await risk_service.evaluate(query)

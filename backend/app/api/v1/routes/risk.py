from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request

from app.api.deps import get_risk_service
from app.core.config import get_settings
from app.core.security import require_api_key
from app.schemas.common import ErrorResponse
from app.schemas.risk import (
    BatchRiskRequest,
    BatchRiskResponse,
    EnvironmentRiskResponse,
    RiskQueryParams,
)
from app.services.risk_service import RiskService
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter(
    prefix="/environment-risk",
    tags=["Environment Risk"],
    dependencies=[Depends(require_api_key)],
)

limiter = Limiter(key_func=get_remote_address)


def _dynamic_rate_limit() -> str:
    # slowapi invokes callable providers with no arguments
    return get_settings().rate_limit


@router.get(
    "",
    response_model=EnvironmentRiskResponse,
    responses={
        401: {"model": ErrorResponse, "description": "Missing or invalid API key"},
        422: {"model": ErrorResponse, "description": "Validation error"},
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
        503: {"model": ErrorResponse, "description": "Upstream unavailable"},
    },
    summary="Evaluate environmental risk for a location and child profile",
)
@limiter.limit(_dynamic_rate_limit)
async def get_environment_risk(
    request: Request,
    lat: Annotated[float, Query(ge=-90, le=90, description="Latitude")],
    lon: Annotated[float, Query(ge=-180, le=180, description="Longitude")],
    age_group: Annotated[
        Literal["under5", "child", "adolescent"],
        Query(description="Child age band used for vulnerability adjustments"),
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


@router.post(
    "/batch",
    response_model=BatchRiskResponse,
    responses={
        401: {"model": ErrorResponse, "description": "Missing or invalid API key"},
        422: {"model": ErrorResponse, "description": "Validation error"},
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
        503: {"model": ErrorResponse, "description": "Upstream unavailable"},
    },
    summary="Evaluate environmental risk for multiple locations",
)
@limiter.limit(_dynamic_rate_limit)
async def post_environment_risk_batch(
    request: Request,
    body: BatchRiskRequest,
    risk_service: RiskService = Depends(get_risk_service),
) -> BatchRiskResponse:
    return await risk_service.evaluate_batch(body)

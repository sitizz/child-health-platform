from fastapi import Request

from app.clients.open_meteo import OpenMeteoClient
from app.core.config import Settings, get_settings
from app.services.cache import CacheBackend
from app.services.risk_service import RiskService


def get_cache(request: Request) -> CacheBackend:
    return request.app.state.cache


def get_open_meteo(request: Request) -> OpenMeteoClient:
    return request.app.state.open_meteo


def get_risk_service(request: Request) -> RiskService:
    settings: Settings = get_settings()
    return RiskService(
        open_meteo=get_open_meteo(request),
        cache=get_cache(request),
        settings=settings,
    )

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.open_meteo import OpenMeteoClient
from app.core.config import Settings, get_settings
from app.core.security import get_current_caregiver, require_api_key
from app.db.session import get_db
from app.models.caregiver import Caregiver
from app.services.auth_service import AuthService
from app.services.cache import CacheBackend
from app.services.child_service import ChildService
from app.services.consent_service import ConsentService
from app.services.disclaimer_service import DisclaimerService
from app.services.panel_service import PanelService
from app.services.push_service import PushService
from app.services.recommendation_service import RecommendationService
from app.services.risk_service import RiskService


def get_cache(request: Request) -> CacheBackend:
    return request.app.state.cache


def get_open_meteo(request: Request) -> OpenMeteoClient:
    return request.app.state.open_meteo


def get_risk_service(request: Request) -> RiskService:
    settings = get_settings()
    return RiskService(
        open_meteo=get_open_meteo(request),
        cache=get_cache(request),
        settings=settings,
    )


def get_auth_service(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthService:
    return AuthService(db, settings)


def get_consent_service(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> ConsentService:
    return ConsentService(db, settings)


def get_disclaimer_service(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> DisclaimerService:
    return DisclaimerService(db, settings)


def get_child_service(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> ChildService:
    return ChildService(db, settings)


def get_recommendation_service(
    request: Request,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> RecommendationService:
    return RecommendationService(db, settings, get_open_meteo(request))


def get_panel_service(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> PanelService:
    return PanelService(db, settings)


def get_push_service(
    request: Request,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> PushService:
    return PushService(db, settings, request.app.state.http_client)


async def require_personalised_access(
    caregiver: Caregiver = Depends(get_current_caregiver),
    consent_service: ConsentService = Depends(get_consent_service),
    disclaimer_service: DisclaimerService = Depends(get_disclaimer_service),
) -> Caregiver:
    await consent_service.require_valid(caregiver.id)
    await disclaimer_service.require_ack(caregiver.id)
    return caregiver


# Re-export for route modules
__all__ = [
    "get_db",
    "get_settings",
    "require_api_key",
    "get_current_caregiver",
    "require_personalised_access",
    "get_auth_service",
    "get_consent_service",
    "get_disclaimer_service",
    "get_child_service",
    "get_recommendation_service",
    "get_panel_service",
    "get_push_service",
    "get_risk_service",
    "get_cache",
    "get_open_meteo",
]

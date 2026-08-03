from fastapi import APIRouter

from app.api.v1.routes import (
    auth,
    children,
    consent,
    devices,
    disclaimer,
    engagement,
    health,
    panel,
    recommendations,
    risk,
)

api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(auth.router)
api_v1_router.include_router(consent.router)
api_v1_router.include_router(disclaimer.router)
api_v1_router.include_router(children.router)
api_v1_router.include_router(recommendations.router)
api_v1_router.include_router(panel.router)
api_v1_router.include_router(devices.router)
api_v1_router.include_router(risk.router)
api_v1_router.include_router(engagement.router)
api_v1_router.include_router(health.router, prefix="/system")

from fastapi import APIRouter

from app.api.v1.routes import health, risk

api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(risk.router)

# Health probes are also mounted at root for orchestrators; include under v1 for Swagger completeness.
api_v1_router.include_router(health.router, prefix="/system")

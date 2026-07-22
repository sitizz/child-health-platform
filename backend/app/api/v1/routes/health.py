from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import engine
from app.schemas.health import HealthResponse, ReadinessResponse, RootStatusResponse

router = APIRouter(tags=["Health"])


@router.get(
    "/",
    response_model=RootStatusResponse,
    summary="Service root status",
)
async def root_status() -> RootStatusResponse:
    settings = get_settings()
    return RootStatusResponse(
        status="Child Health Platform backend is running",
        service=settings.app_name,
        version=settings.app_version,
    )


@router.get("/healthz", response_model=HealthResponse, summary="Liveness probe")
async def healthz() -> HealthResponse:
    return HealthResponse(status="ok")


@router.get("/readyz", response_model=ReadinessResponse, summary="Readiness probe")
async def readyz(request: Request) -> ReadinessResponse | JSONResponse:
    checks: dict[str, str] = {}

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
        db_ok = True
    except Exception:
        checks["database"] = "unavailable"
        db_ok = False

    cache_ok = await request.app.state.cache.ping()
    checks["cache"] = "ok" if cache_ok else "unavailable"

    upstream_ok = await request.app.state.open_meteo.ping()
    checks["open_meteo"] = "ok" if upstream_ok else "unavailable"

    if not db_ok:
        return JSONResponse(
            status_code=503,
            content=ReadinessResponse(status="not_ready", checks=checks).model_dump(),
        )

    status_value = "ready" if upstream_ok and cache_ok else "degraded"
    return ReadinessResponse(status=status_value, checks=checks)  # type: ignore[arg-type]

from contextlib import asynccontextmanager
from typing import AsyncIterator

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.legacy import router as legacy_router
from app.api.v1.router import api_v1_router
from app.api.v1.routes import health as health_routes
from app.api.v1.routes.risk import limiter
from app.clients.open_meteo import OpenMeteoClient
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging, get_logger
from app.middleware import RequestContextMiddleware
from app.services.cache import InMemoryCache, RedisCache

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    timeout = httpx.Timeout(settings.open_meteo_timeout_seconds, connect=2.0)
    http_client = httpx.AsyncClient(timeout=timeout, headers={"User-Agent": "ChildGuard/1.0"})
    app.state.http_client = http_client
    app.state.open_meteo = OpenMeteoClient(http_client, settings)

    if settings.redis_url:
        try:
            from redis.asyncio import Redis

            redis_client = Redis.from_url(settings.redis_url, decode_responses=True)
            app.state.redis = redis_client
            app.state.cache = RedisCache(redis_client)
            logger.info("cache_backend", backend="redis")
        except Exception:
            logger.exception("redis_init_failed_falling_back_to_memory")
            app.state.redis = None
            app.state.cache = InMemoryCache()
    else:
        app.state.redis = None
        app.state.cache = InMemoryCache()
        logger.info("cache_backend", backend="memory")

    logger.info("app_started", env=settings.app_env, version=settings.app_version)
    try:
        yield
    finally:
        await http_client.aclose()
        redis_client = getattr(app.state, "redis", None)
        if redis_client is not None:
            await redis_client.aclose()
        logger.info("app_stopped")


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings)

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "Child Guard environmental risk API. "
            "Location-based heat, respiratory, dengue, and flood guidance "
            "for caregivers. Not medical advice."
        ),
        lifespan=lifespan,
        docs_url="/docs" if settings.docs_enabled else None,
        redoc_url="/redoc" if settings.docs_enabled else None,
        openapi_url="/openapi.json" if settings.docs_enabled else None,
    )

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
    app.add_middleware(RequestContextMiddleware)

    cors_origins = settings.cors_origins
    allow_credentials = "*" not in cors_origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=allow_credentials,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-API-Key", "X-Request-ID"],
    )

    register_exception_handlers(app)

    # Root-level health for load balancers / Render
    app.include_router(health_routes.router)
    app.include_router(api_v1_router)
    app.include_router(legacy_router)

    def custom_openapi():
        if app.openapi_schema:
            return app.openapi_schema
        schema = get_openapi(
            title=settings.app_name,
            version=settings.app_version,
            description=app.description,
            routes=app.routes,
            tags=[
                {"name": "Health", "description": "Liveness and readiness"},
                {"name": "Auth", "description": "Caregiver registration and JWT"},
                {"name": "Consent", "description": "Informed consent management"},
                {"name": "Disclaimer", "description": "Medical disclaimer acknowledgements"},
                {"name": "Children", "description": "Multi-child profiles (max 10)"},
                {"name": "Recommendations", "description": "Explainable AI recommendations"},
                {"name": "ParentPanel", "description": "Household overview and history"},
                {"name": "Devices", "description": "Expo push token registry"},
                {"name": "Notifications", "description": "Push dispatch and tests"},
                {"name": "Environment Risk", "description": "Environmental risk scoring"},
                {"name": "Legacy", "description": "Deprecated unversioned routes"},
            ],
        )
        components = schema.setdefault("components", {}).setdefault("securitySchemes", {})
        components["ApiKeyAuth"] = {
            "type": "apiKey",
            "in": "header",
            "name": "X-API-Key",
            "description": "Service API key when configured",
        }
        components["BearerAuth"] = {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Caregiver access token from /api/v1/auth/login",
        }
        schema["security"] = [{"ApiKeyAuth": []}, {"BearerAuth": []}]
        app.openapi_schema = schema
        return app.openapi_schema

    app.openapi = custom_openapi  # type: ignore[method-assign]
    return app


app = create_app()

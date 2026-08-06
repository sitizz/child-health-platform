import os
from collections.abc import AsyncGenerator

import httpx
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Force test env (overrides compose .env) before app import
os.environ["DATABASE_URL"] = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://childguard:childguard@db:5432/childguard",
)
os.environ["REDIS_URL"] = os.environ.get("REDIS_URL", "redis://redis:6379/0")
os.environ["JWT_SECRET"] = "test-secret-key-for-pytest-32chars!"
os.environ["API_KEY"] = ""
os.environ["APP_ENV"] = "development"
os.environ["ENABLE_DOCS"] = "true"

from app.core.config import get_settings

get_settings.cache_clear()

from app.clients.open_meteo import OpenMeteoClient
from app.db.base import Base
from app.db.session import get_db
from app.domain.scoring import EnvironmentObservation
from app.main import create_app
from app.ml.llm_communicator import LLMCommunicator
from app.services.cache import InMemoryCache


@pytest.fixture
def sample_observation() -> EnvironmentObservation:
    return EnvironmentObservation(
        temperature=36.0,
        humidity=75.0,
        rainfall=5.0,
        aqi=80.0,
        pm2_5=40.0,
        pm10=60.0,
        daily_temp_max=[36.0] * 7,
        daily_rain=[5.0] * 7,
    )


@pytest_asyncio.fixture
async def engine():
    """Function-scoped so the engine binds to the same event loop as the test."""
    settings = get_settings()
    eng = create_async_engine(settings.database_url, pool_pre_ping=True)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def client(
    engine, sample_observation, monkeypatch: pytest.MonkeyPatch
) -> AsyncGenerator[AsyncClient, None]:
    get_settings.cache_clear()
    app = create_app()
    settings = get_settings()

    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async def override_get_db():
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db

    async def fake_fetch(self, lat: float, lon: float):
        return sample_observation

    async def fake_ping(self):
        return True

    monkeypatch.setattr(
        "app.clients.open_meteo.OpenMeteoClient.fetch_observation",
        fake_fetch,
    )
    monkeypatch.setattr(
        "app.clients.open_meteo.OpenMeteoClient.ping",
        fake_ping,
    )

    # Mimic lifespan (httpx ASGITransport does not run it)
    http_client = httpx.AsyncClient()
    app.state.http_client = http_client
    app.state.open_meteo = OpenMeteoClient(http_client, settings)
    app.state.redis = None
    app.state.cache = InMemoryCache()
    # Tests use rule-based fallback unless a case mocks Gemini HTTP
    app.state.llm = LLMCommunicator(
        http_client=http_client,
        settings=settings,
        cache=app.state.cache,
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    await http_client.aclose()
    app.dependency_overrides.clear()
    get_settings.cache_clear()

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import get_settings
from app.domain.scoring import EnvironmentObservation
from app.main import create_app


@pytest.fixture
def settings(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("API_KEY", "")
    monkeypatch.setenv("ENABLE_DOCS", "true")
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000")
    get_settings.cache_clear()
    yield get_settings()
    get_settings.cache_clear()


@pytest.fixture
def sample_observation() -> EnvironmentObservation:
    return EnvironmentObservation(
        temperature=36.0,
        humidity=75.0,
        rainfall=5.0,
        aqi=80.0,
        pm2_5=40.0,
        pm10=60.0,
        daily_temp_max=[36.0, 37.0, 34.0, 33.0, 32.0, 31.0, 30.0],
        daily_rain=[5.0, 2.0, 0.0, 0.0, 1.0, 0.0, 0.0],
    )


@pytest.fixture
async def client(settings, sample_observation, monkeypatch: pytest.MonkeyPatch):
    app = create_app()

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

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

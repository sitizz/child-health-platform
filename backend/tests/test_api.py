import pytest
from httpx import AsyncClient

from app.core.config import get_settings
from app.main import create_app


EXPECTED_OPENAPI_PATHS = {
    "/",
    "/healthz",
    "/readyz",
    "/environment-risk",
    "/api/v1/environment-risk",
    "/api/v1/environment-risk/batch",
    "/api/v1/system/",
    "/api/v1/system/healthz",
    "/api/v1/system/readyz",
    "/api/v1/auth/register",
    "/api/v1/auth/login",
    "/api/v1/auth/me",
    "/api/v1/consent/current",
    "/api/v1/disclaimer/current",
    "/api/v1/children",
    "/api/v1/panel/overview",
    "/api/v1/devices",
    "/api/v1/engagement/track",
    "/api/v1/engagement/metrics",
    "/api/v1/ml/status",
    "/api/v1/ml/predict",
    "/api/v1/ml/vision/analyze",
    "/api/v1/ml/audio/analyze",
    "/api/v1/ml/languages",
}


@pytest.mark.asyncio
async def test_openapi_includes_all_apis(client: AsyncClient):
    response = await client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    paths = set(schema["paths"].keys())
    missing = EXPECTED_OPENAPI_PATHS - paths
    assert not missing, f"Swagger/OpenAPI missing paths: {missing}"

    env_get = schema["paths"]["/api/v1/environment-risk"]["get"]
    assert "ApiKeyAuth" in schema["components"]["securitySchemes"]
    assert env_get.get("responses", {}).get("200")
    assert "EnvironmentRiskResponse" in str(schema) or env_get["responses"]["200"]

    batch = schema["paths"]["/api/v1/environment-risk/batch"]["post"]
    assert batch.get("requestBody") is not None


@pytest.mark.asyncio
async def test_health_endpoints(client: AsyncClient):
    assert (await client.get("/healthz")).status_code == 200
    root = await client.get("/")
    assert root.status_code == 200
    assert "running" in root.json()["status"].lower()
    ready = await client.get("/readyz")
    assert ready.status_code == 200
    assert ready.json()["status"] in {"ready", "degraded"}


@pytest.mark.asyncio
async def test_environment_risk_v1(client: AsyncClient):
    response = await client.get(
        "/api/v1/environment-risk",
        params={"lat": 24.86, "lon": 67.00, "age_group": "under5", "asthma": True},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["location"]["lat"] == 24.86
    assert "model_version" in data
    assert "disclaimer" in data
    assert data["risks"]["heat_stress"] in {"low", "moderate", "high"}


@pytest.mark.asyncio
async def test_legacy_environment_risk(client: AsyncClient):
    response = await client.get(
        "/environment-risk",
        params={"lat": 24.86, "lon": 67.00},
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_batch_endpoint(client: AsyncClient):
    response = await client.post(
        "/api/v1/environment-risk/batch",
        json={
            "locations": [
                {"lat": 24.86, "lon": 67.00, "id": "a"},
                {"lat": 24.90, "lon": 67.10, "id": "b"},
            ],
            "age_group": "child",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["results"]) == 2
    assert body["results"][0]["id"] == "a"
    assert body["results"][0]["result"] is not None


@pytest.mark.asyncio
async def test_validation_rejects_bad_coords(client: AsyncClient):
    response = await client.get(
        "/api/v1/environment-risk",
        params={"lat": 200, "lon": 67},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_api_key_required_when_configured(monkeypatch: pytest.MonkeyPatch):
    import httpx
    from httpx import ASGITransport

    from app.clients.open_meteo import OpenMeteoClient
    from app.domain.scoring import EnvironmentObservation
    from app.services.cache import InMemoryCache

    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("API_KEY", "secret-key")
    monkeypatch.setenv("ENABLE_DOCS", "true")
    get_settings.cache_clear()

    app = create_app()
    settings = get_settings()

    async def fake_fetch(self, lat: float, lon: float):
        return EnvironmentObservation(
            temperature=30,
            humidity=50,
            rainfall=0,
            aqi=20,
            pm2_5=10,
            pm10=10,
            daily_temp_max=[30] * 7,
            daily_rain=[0] * 7,
        )

    monkeypatch.setattr(
        "app.clients.open_meteo.OpenMeteoClient.fetch_observation",
        fake_fetch,
    )

    async def fake_ping(self):
        return True

    monkeypatch.setattr(
        "app.clients.open_meteo.OpenMeteoClient.ping",
        fake_ping,
    )

    http_client = httpx.AsyncClient()
    app.state.http_client = http_client
    app.state.open_meteo = OpenMeteoClient(http_client, settings)
    app.state.redis = None
    app.state.cache = InMemoryCache()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        denied = await ac.get(
            "/api/v1/environment-risk",
            params={"lat": 1, "lon": 1},
        )
        assert denied.status_code == 401

        ok = await ac.get(
            "/api/v1/environment-risk",
            params={"lat": 1, "lon": 1},
            headers={"X-API-Key": "secret-key"},
        )
        assert ok.status_code == 200

    await http_client.aclose()
    get_settings.cache_clear()

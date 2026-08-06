"""API integration tests for ML endpoints and ML-enriched risk responses."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_ml_status(client: AsyncClient):
    response = await client.get("/api/v1/ml/status")
    assert response.status_code == 200
    data = response.json()
    assert data["classifier_loaded"] is True
    assert data["classifier_version"]
    assert "temperature" in data["feature_names"]
    assert data["vision_status"] == "not_implemented"
    assert data["audio_status"] == "not_implemented"
    assert "en" in data["supported_languages"]
    assert "llm_enabled" in data
    assert data["llm_provider"] == "gemini"


@pytest.mark.asyncio
async def test_ml_predict(client: AsyncClient):
    response = await client.post(
        "/api/v1/ml/predict",
        json={
            "age_group": "under5",
            "dehydration": True,
            "temperature": 39.0,
            "humidity": 50.0,
            "rainfall": 0.0,
            "aqi": 20.0,
            "pm2_5": 8.0,
            "pm10": 15.0,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["prediction"]["predicted_domain"] == "heat_stress"
    assert 0.0 <= data["prediction"]["confidence"] <= 1.0
    assert "disclaimer" in data


@pytest.mark.asyncio
async def test_ml_predict_language_header(client: AsyncClient):
    response = await client.post(
        "/api/v1/ml/predict",
        headers={"Accept-Language": "ms-MY,en;q=0.8"},
        json={
            "age_group": "child",
            "temperature": 24.0,
            "humidity": 50.0,
            "rainfall": 0.0,
        },
    )
    assert response.status_code == 200
    assert "Content-Language" in response.headers


@pytest.mark.asyncio
async def test_vision_analyze_not_implemented(client: AsyncClient):
    response = await client.post(
        "/api/v1/ml/vision/analyze",
        json={"image_base64": "abc123", "analysis_type": "rash"},
    )
    assert response.status_code == 501
    data = response.json()
    assert data["status"] == "not_implemented"
    assert "wound classification" in data["planned_capabilities"]


@pytest.mark.asyncio
async def test_audio_analyze_not_implemented(client: AsyncClient):
    response = await client.post(
        "/api/v1/ml/audio/analyze",
        json={"audio_base64": "abc123"},
    )
    assert response.status_code == 501
    data = response.json()
    assert data["status"] == "not_implemented"


@pytest.mark.asyncio
async def test_environment_risk_includes_ml_fields(client: AsyncClient):
    response = await client.get(
        "/api/v1/environment-risk",
        params={"lat": 24.86, "lon": 67.00, "age_group": "under5", "asthma": True},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["ml_prediction"] is not None
    assert "predicted_domain" in data["ml_prediction"]
    assert "confidence" in data["ml_prediction"]
    assert data["simplified"] is not None
    assert data["simplified"]["immediate"]
    assert data["simplified"]["summary"]


@pytest.mark.asyncio
async def test_ml_languages_endpoint(client: AsyncClient):
    response = await client.get(
        "/api/v1/ml/languages",
        headers={"Accept-Language": "ur"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "en" in data["supported"]
    assert data["negotiated"] == "ur"

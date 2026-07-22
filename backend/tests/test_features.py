import pytest
from httpx import AsyncClient

from app.services.push_service import build_expo_messages


REQUIRED_CONSENT = {
    "caregiver_authority": True,
    "read_understood": True,
    "not_diagnostic": True,
    "data_processing": True,
    "location": True,
    "notifications_opt_in": True,
}


async def _register_and_gate(client: AsyncClient, email: str) -> str:
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password1!", "name": "Test Parent"},
    )
    assert reg.status_code == 200, reg.text
    token = reg.json()["access"]
    headers = {"Authorization": f"Bearer {token}"}

    accept = await client.post(
        "/api/v1/consent/accept",
        headers=headers,
        json={"checkboxes": REQUIRED_CONSENT},
    )
    assert accept.status_code == 200, accept.text

    ack = await client.post("/api/v1/disclaimer/acknowledge", headers=headers)
    assert ack.status_code == 200, ack.text
    return token


@pytest.mark.asyncio
async def test_auth_register_login_me(client: AsyncClient):
    email = "parent1@example.com"
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password1!", "name": "Ada"},
    )
    assert reg.status_code == 200
    body = reg.json()
    assert "access" in body and "refresh" in body

    login = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password1!"},
    )
    assert login.status_code == 200
    token = login.json()["access"]

    me = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert me.status_code == 200
    assert me.json()["email"] == email


@pytest.mark.asyncio
async def test_consent_requires_all_checkboxes(client: AsyncClient):
    token = (
        await client.post(
            "/api/v1/auth/register",
            json={
                "email": "consent@example.com",
                "password": "Password1!",
                "name": "C",
            },
        )
    ).json()["access"]
    headers = {"Authorization": f"Bearer {token}"}
    bad = await client.post(
        "/api/v1/consent/accept",
        headers=headers,
        json={
            "checkboxes": {
                **REQUIRED_CONSENT,
                "location": False,
            }
        },
    )
    assert bad.status_code == 422


@pytest.mark.asyncio
async def test_children_max_ten_and_panel(client: AsyncClient):
    token = await _register_and_gate(client, "kids@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # children blocked without consent already handled by gate
    for i in range(10):
        resp = await client.post(
            "/api/v1/children",
            headers=headers,
            json={"name": f"Child {i}", "age": 4 + (i % 5), "conditions": {"asthma": i == 0}},
        )
        assert resp.status_code == 201, resp.text

    overflow = await client.post(
        "/api/v1/children",
        headers=headers,
        json={"name": "Extra", "age": 2},
    )
    assert overflow.status_code == 400

    overview = await client.get("/api/v1/panel/overview", headers=headers)
    assert overview.status_code == 200
    body = overview.json()
    assert len(body["children"]) == 10
    assert body.get("consent_accepted", body.get("disclaimer_acknowledged")) is True


@pytest.mark.asyncio
async def test_recommendations_persist_and_history(client: AsyncClient):
    token = await _register_and_gate(client, "rec@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    child = await client.post(
        "/api/v1/children",
        headers=headers,
        json={
            "name": "Sam",
            "age": 3,
            "conditions": {"asthma": True},
            "symptoms": {"cough": True},
        },
    )
    child_id = child.json()["id"]

    rec = await client.get(
        f"/api/v1/children/{child_id}/recommendations?lat=24.86&lon=67.00",
        headers=headers,
    )
    assert rec.status_code == 200, rec.text
    data = rec.json()
    assert "explanation" in data
    assert "priority_actions" in data
    assert data["assessment_id"] is not None
    assert "disclaimer" in data

    history = await client.get("/api/v1/panel/history", headers=headers)
    assert history.status_code == 200
    assert any(i["kind"] == "assessment" for i in history.json()["items"])


@pytest.mark.asyncio
async def test_device_register(client: AsyncClient):
    token = await _register_and_gate(client, "push@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.post(
        "/api/v1/devices",
        headers=headers,
        json={"expo_push_token": "ExponentPushToken[test-token-123]", "platform": "ios"},
    )
    assert resp.status_code == 201
    assert resp.json()["active"] is True


def test_build_expo_messages():
    msgs = build_expo_messages(["t1", "t2"], "Hi", "Body")
    assert len(msgs) == 2
    assert msgs[0]["to"] == "t1"
    assert msgs[0]["title"] == "Hi"


@pytest.mark.asyncio
async def test_legacy_risk_still_works(client: AsyncClient):
    resp = await client.get("/environment-risk?lat=24.86&lon=67.00&age_group=under5")
    assert resp.status_code == 200
    assert "priority_alert" in resp.json()

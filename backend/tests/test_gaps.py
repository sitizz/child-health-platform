from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from app.services.push_service import (
    choose_notification,
    map_expo_ticket_status,
    should_skip_for_cooldown,
)
from tests.test_features import REQUIRED_CONSENT, _register_and_gate


def test_map_expo_ticket_status():
    assert map_expo_ticket_status({"status": "ok"}) == "sent"
    assert (
        map_expo_ticket_status(
            {"status": "error", "details": {"error": "DeviceNotRegistered"}}
        )
        == "inactive_token"
    )
    assert map_expo_ticket_status({"status": "error", "message": "boom"}) == "failed"


def test_cooldown_and_choose_notification():
    now = datetime(2026, 7, 22, 12, 0, tzinfo=timezone.utc)
    assert should_skip_for_cooldown(
        last_notified_at=now - timedelta(minutes=10),
        last_priority="high",
        current_priority="high",
        now=now,
        cooldown=timedelta(minutes=180),
    )
    assert not should_skip_for_cooldown(
        last_notified_at=now - timedelta(minutes=10),
        last_priority="high",
        current_priority="moderate",
        now=now,
        cooldown=timedelta(minutes=180),
    )

    high = choose_notification(
        priority="high",
        last_priority=None,
        last_notified_at=None,
        now=now,
    )
    assert high and high[0] == "high_risk"

    improved = choose_notification(
        priority="low",
        last_priority="high",
        last_notified_at=now - timedelta(hours=1),
        now=now,
    )
    assert improved and improved[0] == "risk_improved"

    briefing = choose_notification(
        priority="moderate",
        last_priority=None,
        last_notified_at=None,
        now=now,
    )
    assert briefing and briefing[0] == "daily_briefing"

    same_day = choose_notification(
        priority="moderate",
        last_priority="moderate",
        last_notified_at=now - timedelta(hours=1),
        now=now,
    )
    assert same_day is None


@pytest.mark.asyncio
async def test_consent_withdraw_and_version_bump(client: AsyncClient, monkeypatch):
    token = await _register_and_gate(client, "withdraw@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Can create child while gated
    created = await client.post(
        "/api/v1/children",
        headers=headers,
        json={"name": "A", "age": 2},
    )
    assert created.status_code == 201

    withdrawn = await client.post("/api/v1/consent/withdraw", headers=headers)
    assert withdrawn.status_code == 200
    assert withdrawn.json()["accepted"] is False

    blocked = await client.get("/api/v1/children", headers=headers)
    assert blocked.status_code == 403
    assert blocked.json()["error"]["message"] == "consent_required"

    # Re-accept after withdraw
    again = await client.post(
        "/api/v1/consent/accept",
        headers=headers,
        json={"checkboxes": REQUIRED_CONSENT},
    )
    assert again.status_code == 200
    assert (await client.get("/api/v1/children", headers=headers)).status_code == 200

    # Version bump invalidates until re-accept
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "consent_version", "consent-v2")
    stale = await client.get("/api/v1/children", headers=headers)
    assert stale.status_code == 403

    refreshed = await client.post(
        "/api/v1/consent/accept",
        headers=headers,
        json={"checkboxes": REQUIRED_CONSENT},
    )
    assert refreshed.status_code == 200
    assert refreshed.json()["version"] == "consent-v2"
    assert (await client.get("/api/v1/children", headers=headers)).status_code == 200


@pytest.mark.asyncio
async def test_disclaimer_version_tracking(client: AsyncClient, monkeypatch):
    token = (
        await client.post(
            "/api/v1/auth/register",
            json={
                "email": "disc@example.com",
                "password": "Password1!",
                "name": "D",
            },
        )
    ).json()["access"]
    headers = {"Authorization": f"Bearer {token}"}
    await client.post(
        "/api/v1/consent/accept",
        headers=headers,
        json={"checkboxes": REQUIRED_CONSENT},
    )
    ack = await client.post("/api/v1/disclaimer/acknowledge", headers=headers)
    assert ack.status_code == 200
    status = await client.get("/api/v1/disclaimer/status", headers=headers)
    assert status.json()["acknowledged"] is True

    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "disclaimer_version", "disclaimer-v2")
    # Personalised routes require current disclaimer version
    blocked = await client.get("/api/v1/panel/overview", headers=headers)
    assert blocked.status_code == 403
    assert blocked.json()["error"]["message"] == "disclaimer_required"

    reack = await client.post("/api/v1/disclaimer/acknowledge", headers=headers)
    assert reack.status_code == 200
    assert reack.json()["version"] == "disclaimer-v2"


@pytest.mark.asyncio
async def test_cross_caregiver_isolation(client: AsyncClient):
    token_a = await _register_and_gate(client, "parent_a@example.com")
    token_b = await _register_and_gate(client, "parent_b@example.com")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    child_a = await client.post(
        "/api/v1/children",
        headers=headers_a,
        json={"name": "OnlyA", "age": 4},
    )
    child_id = child_a.json()["id"]

    stolen = await client.get(f"/api/v1/children/{child_id}", headers=headers_b)
    assert stolen.status_code == 404

    patch = await client.patch(
        f"/api/v1/children/{child_id}",
        headers=headers_b,
        json={"name": "Hack"},
    )
    assert patch.status_code == 404


@pytest.mark.asyncio
async def test_empty_household_panel(client: AsyncClient):
    token = await _register_and_gate(client, "empty@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    overview = await client.get("/api/v1/panel/overview", headers=headers)
    assert overview.status_code == 200
    body = overview.json()
    assert body["children"] == []
    assert body["open_alerts_count"] == 0
    assert body["household_priority"] is None

    history = await client.get("/api/v1/panel/history", headers=headers)
    assert history.status_code == 200
    assert history.json()["items"] == []


@pytest.mark.asyncio
async def test_inactive_device_token(client: AsyncClient):
    token = await _register_and_gate(client, "device_off@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    expo = "ExponentPushToken[inactive-test]"
    created = await client.post(
        "/api/v1/devices",
        headers=headers,
        json={"expo_push_token": expo, "platform": "android"},
    )
    assert created.status_code == 201
    deleted = await client.delete(f"/api/v1/devices/{expo}", headers=headers)
    assert deleted.status_code == 204
    # Idempotent deactivate
    again = await client.delete(f"/api/v1/devices/{expo}", headers=headers)
    assert again.status_code == 204
    missing = await client.delete(
        "/api/v1/devices/ExponentPushToken[does-not-exist]", headers=headers
    )
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_panel_recommendations_include_factors(client: AsyncClient):
    token = await _register_and_gate(client, "factors@example.com")
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
    assert rec.status_code == 200
    panel = await client.get("/api/v1/panel/recommendations", headers=headers)
    assert panel.status_code == 200
    items = panel.json()["items"]
    assert items
    assert items[0]["explanation"]["environmental_factors"]
    assert items[0]["secondary_actions"] is not None

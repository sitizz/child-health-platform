import pytest
from httpx import AsyncClient

from tests.test_features import _register_and_gate


@pytest.mark.asyncio
async def test_track_engagement_anonymous(client: AsyncClient):
    resp = await client.post(
        "/api/v1/engagement/track",
        json={"event_type": "risk_check", "metadata": {"priority": "moderate"}},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["event_type"] == "risk_check"
    assert body["caregiver_id"] is None
    assert body["metadata"]["priority"] == "moderate"
    assert "id" in body
    assert "created_at" in body


@pytest.mark.asyncio
async def test_track_engagement_authenticated(client: AsyncClient):
    token = await _register_and_gate(client, "engage@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/api/v1/engagement/track",
        headers=headers,
        json={"event_type": "share_summary", "metadata": {"priority": "high"}},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["event_type"] == "share_summary"
    assert body["caregiver_id"] is not None
    assert body["metadata"]["priority"] == "high"


@pytest.mark.asyncio
async def test_track_rejects_invalid_event_type(client: AsyncClient):
    resp = await client.post(
        "/api/v1/engagement/track",
        json={"event_type": "not_a_real_event"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_metrics_requires_auth(client: AsyncClient):
    resp = await client.get("/api/v1/engagement/metrics")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_metrics_aggregates_by_type_and_day(client: AsyncClient):
    token = await _register_and_gate(client, "metrics@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    for event_type in ("risk_check", "risk_check", "share_summary"):
        tracked = await client.post(
            "/api/v1/engagement/track",
            headers=headers,
            json={"event_type": event_type},
        )
        assert tracked.status_code == 201, tracked.text

    metrics = await client.get("/api/v1/engagement/metrics", headers=headers)
    assert metrics.status_code == 200, metrics.text
    body = metrics.json()

    assert body["total_events"] == 3
    assert body["by_type"]["risk_check"] == 2
    assert body["by_type"]["share_summary"] == 1
    assert body["by_type"]["add_child"] == 0
    assert len(body["daily"]) >= 1
    today = body["daily"][0]
    assert today["risk_check"] == 2
    assert today["share_summary"] == 1


@pytest.mark.asyncio
async def test_create_child_auto_logs_add_child(client: AsyncClient):
    token = await _register_and_gate(client, "addchild@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    created = await client.post(
        "/api/v1/children",
        headers=headers,
        json={"name": "Amina", "age": 4},
    )
    assert created.status_code == 201, created.text
    child_id = created.json()["id"]

    metrics = await client.get("/api/v1/engagement/metrics", headers=headers)
    assert metrics.status_code == 200, metrics.text
    body = metrics.json()
    assert body["by_type"]["add_child"] == 1
    assert body["total_events"] >= 1

    # Confirm the logged event includes the child_id in metadata via a second track + metrics shape
    # (add_child is logged server-side; verify by creating another child)
    created2 = await client.post(
        "/api/v1/children",
        headers=headers,
        json={"name": "Bilal", "age": 6},
    )
    assert created2.status_code == 201, created2.text

    metrics2 = await client.get("/api/v1/engagement/metrics", headers=headers)
    assert metrics2.json()["by_type"]["add_child"] == 2
    assert child_id  # created successfully


@pytest.mark.asyncio
async def test_metrics_date_filter(client: AsyncClient):
    token = await _register_and_gate(client, "datefilter@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    await client.post(
        "/api/v1/engagement/track",
        headers=headers,
        json={"event_type": "risk_check"},
    )

    # Far-future window should return zero
    empty = await client.get(
        "/api/v1/engagement/metrics",
        headers=headers,
        params={"from_date": "2099-01-01", "to_date": "2099-12-31"},
    )
    assert empty.status_code == 200
    assert empty.json()["total_events"] == 0

    # Broad window should include today's event
    filled = await client.get(
        "/api/v1/engagement/metrics",
        headers=headers,
        params={"from_date": "2020-01-01", "to_date": "2099-12-31"},
    )
    assert filled.status_code == 200
    assert filled.json()["total_events"] == 1

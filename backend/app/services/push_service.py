from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID, uuid4

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.logging import get_logger
from app.models.assessment import RiskAssessment
from app.models.child import Child
from app.models.consent import Consent
from app.models.device import DeviceToken
from app.models.notification import NotificationLog, NotificationState
from app.schemas.device import DispatchResponse, DeviceOut, DeviceRegisterRequest

logger = get_logger(__name__)


def build_expo_messages(
    tokens: list[str], title: str, body: str
) -> list[dict[str, Any]]:
    return [
        {
            "to": token,
            "sound": "default",
            "title": title,
            "body": body,
        }
        for token in tokens
    ]


def map_expo_ticket_status(ticket: dict[str, Any]) -> str:
    """Map Expo push ticket to notification_log status."""
    status = ticket.get("status")
    if status == "ok":
        return "sent"
    details = ticket.get("details") or {}
    err = ticket.get("message") or details.get("error") or "unknown"
    if err in {"DeviceNotRegistered", "InvalidCredentials"}:
        return "inactive_token"
    return "failed"


def should_skip_for_cooldown(
    *,
    last_notified_at: datetime | None,
    last_priority: str | None,
    current_priority: str,
    now: datetime,
    cooldown: timedelta,
    force_type: str | None = None,
) -> bool:
    """Skip if still inside cooldown for the same priority (unless forced type)."""
    if force_type == "daily_briefing":
        # daily briefing uses its own day-bucket check elsewhere
        return False
    if last_notified_at is None:
        return False
    last = last_notified_at
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    if now - last < cooldown and last_priority == current_priority:
        return True
    return False


def choose_notification(
    *,
    priority: str,
    last_priority: str | None,
    last_notified_at: datetime | None,
    now: datetime,
) -> tuple[str, str, str] | None:
    """
    Decide notification type for a child assessment.
    Returns (ntype, title, body) or None.
    Priority: high_risk > risk_improved > daily_briefing.
    """
    if priority == "high":
        return (
            "high_risk",
            "High environmental risk",
            "Elevated environmental health risk for your child. "
            "Open Child Guard for guidance.",
        )
    if last_priority == "high" and priority in ("moderate", "low"):
        return (
            "risk_improved",
            "Risk improved",
            "Environmental risk levels have improved for your child.",
        )
    # Daily briefing at most once per calendar day when no alert applies
    if priority in ("moderate", "low"):
        if last_notified_at is None:
            return (
                "daily_briefing",
                "Daily environmental briefing",
                "Your Child Guard daily environmental update is ready.",
            )
        last = last_notified_at
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        if last.date() < now.date():
            return (
                "daily_briefing",
                "Daily environmental briefing",
                "Your Child Guard daily environmental update is ready.",
            )
    return None


class PushService:
    def __init__(
        self,
        db: AsyncSession,
        settings: Settings,
        http_client: httpx.AsyncClient,
    ) -> None:
        self.db = db
        self.settings = settings
        self.http = http_client

    async def register(
        self, caregiver_id: UUID, payload: DeviceRegisterRequest
    ) -> DeviceOut:
        result = await self.db.execute(
            select(DeviceToken).where(
                DeviceToken.expo_push_token == payload.expo_push_token
            )
        )
        row = result.scalar_one_or_none()
        if row:
            row.caregiver_id = caregiver_id
            row.platform = payload.platform
            row.active = True
            row.last_seen_at = datetime.now(timezone.utc)
        else:
            row = DeviceToken(
                id=uuid4(),
                caregiver_id=caregiver_id,
                expo_push_token=payload.expo_push_token,
                platform=payload.platform,
            )
            self.db.add(row)
        await self.db.commit()
        await self.db.refresh(row)
        return DeviceOut.model_validate(row)

    async def deactivate(self, caregiver_id: UUID, token: str) -> None:
        result = await self.db.execute(
            select(DeviceToken).where(
                DeviceToken.caregiver_id == caregiver_id,
                DeviceToken.expo_push_token == token,
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="Device token not found")
        row.active = False
        await self.db.commit()

    async def _active_tokens(self, caregiver_id: UUID) -> list[DeviceToken]:
        result = await self.db.execute(
            select(DeviceToken).where(
                DeviceToken.caregiver_id == caregiver_id,
                DeviceToken.active.is_(True),
            )
        )
        return list(result.scalars().all())

    async def send_to_caregiver(
        self,
        caregiver_id: UUID,
        title: str,
        body: str,
        *,
        ntype: str,
        child_id: UUID | None = None,
    ) -> int:
        devices = await self._active_tokens(caregiver_id)
        if not devices:
            return 0

        headers = {"Content-Type": "application/json"}
        if self.settings.expo_access_token:
            headers["Authorization"] = f"Bearer {self.settings.expo_access_token}"

        messages = build_expo_messages(
            [d.expo_push_token for d in devices], title, body
        )
        status_value = "failed"
        tickets: list[dict[str, Any]] = []
        try:
            response = await self.http.post(
                self.settings.expo_push_url, json=messages, headers=headers
            )
            response.raise_for_status()
            payload = response.json()
            tickets = payload.get("data") or []
            if isinstance(tickets, dict):
                tickets = [tickets]
            if tickets:
                statuses = [map_expo_ticket_status(t) for t in tickets]
                if any(s == "sent" for s in statuses):
                    status_value = "sent"
                elif all(s == "inactive_token" for s in statuses):
                    status_value = "inactive_token"
                else:
                    status_value = "failed"
                # Deactivate DeviceNotRegistered tokens
                for device, ticket in zip(devices, tickets):
                    if map_expo_ticket_status(ticket) == "inactive_token":
                        device.active = False
            else:
                status_value = "sent"
        except httpx.HTTPError as exc:
            logger.warning("expo_push_failed", error=str(exc))
            status_value = "failed"

        self.db.add(
            NotificationLog(
                id=uuid4(),
                caregiver_id=caregiver_id,
                child_id=child_id,
                type=ntype,
                title=title,
                body=body,
                status=status_value,
            )
        )
        await self.db.commit()
        return 1 if status_value == "sent" else 0

    async def dispatch(self) -> DispatchResponse:
        children = (await self.db.execute(select(Child))).scalars().all()
        sent = 0
        skipped = 0
        processed = 0
        cooldown = timedelta(minutes=self.settings.notification_cooldown_minutes)
        now = datetime.now(timezone.utc)

        for child in children:
            processed += 1
            consent = await self.db.execute(
                select(Consent)
                .where(
                    Consent.caregiver_id == child.caregiver_id,
                    Consent.withdrawn_at.is_(None),
                    Consent.version == self.settings.consent_version,
                )
                .order_by(Consent.accepted_at.desc())
            )
            active_consent = consent.scalars().first()
            if active_consent is None or not active_consent.notifications_opt_in:
                skipped += 1
                continue

            latest = await self.db.execute(
                select(RiskAssessment)
                .where(RiskAssessment.child_id == child.id)
                .order_by(RiskAssessment.created_at.desc())
                .limit(1)
            )
            assessment = latest.scalar_one_or_none()
            if assessment is None:
                skipped += 1
                continue

            state_row = await self.db.execute(
                select(NotificationState).where(
                    NotificationState.caregiver_id == child.caregiver_id,
                    NotificationState.child_id == child.id,
                )
            )
            state = state_row.scalar_one_or_none()
            last_notified = state.last_notified_at if state else None
            last_priority = state.last_priority if state else None

            chosen = choose_notification(
                priority=assessment.priority,
                last_priority=last_priority,
                last_notified_at=last_notified,
                now=now,
            )
            if not chosen:
                skipped += 1
                if state is None:
                    self.db.add(
                        NotificationState(
                            id=uuid4(),
                            caregiver_id=child.caregiver_id,
                            child_id=child.id,
                            last_priority=assessment.priority,
                        )
                    )
                else:
                    state.last_priority = assessment.priority
                await self.db.commit()
                continue

            ntype, title, body = chosen
            if ntype != "daily_briefing" and should_skip_for_cooldown(
                last_notified_at=last_notified,
                last_priority=last_priority,
                current_priority=assessment.priority,
                now=now,
                cooldown=cooldown,
            ):
                skipped += 1
                continue

            # Daily briefing: at most once per calendar day
            if ntype == "daily_briefing" and last_notified is not None:
                last = last_notified
                if last.tzinfo is None:
                    last = last.replace(tzinfo=timezone.utc)
                if last.date() >= now.date() and last_priority == assessment.priority:
                    skipped += 1
                    continue

            count = await self.send_to_caregiver(
                child.caregiver_id,
                title,
                body,
                ntype=ntype,
                child_id=child.id,
            )
            sent += count
            if state is None:
                state = NotificationState(
                    id=uuid4(),
                    caregiver_id=child.caregiver_id,
                    child_id=child.id,
                )
                self.db.add(state)
            state.last_priority = assessment.priority
            state.last_notified_at = now
            await self.db.commit()

        return DispatchResponse(
            processed_children=processed,
            notifications_sent=sent,
            skipped=skipped,
        )

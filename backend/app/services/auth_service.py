from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.security import (
    create_access_token,
    create_refresh_token_value,
    hash_password,
    hash_token,
    verify_password,
)
from app.models.caregiver import Caregiver, RefreshToken
from app.schemas.auth import AuthResponse, CaregiverOut, LoginRequest, RegisterRequest


class AuthService:
    def __init__(self, db: AsyncSession, settings: Settings) -> None:
        self.db = db
        self.settings = settings

    async def register(self, payload: RegisterRequest) -> AuthResponse:
        existing = await self.db.execute(
            select(Caregiver).where(Caregiver.email == payload.email.lower())
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )
        caregiver = Caregiver(
            id=uuid4(),
            email=payload.email.lower(),
            password_hash=hash_password(payload.password),
            name=payload.name.strip(),
        )
        self.db.add(caregiver)
        await self.db.flush()
        return await self._issue_tokens(caregiver)

    async def login(self, payload: LoginRequest) -> AuthResponse:
        result = await self.db.execute(
            select(Caregiver).where(Caregiver.email == payload.email.lower())
        )
        caregiver = result.scalar_one_or_none()
        if caregiver is None or not verify_password(
            payload.password, caregiver.password_hash
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        return await self._issue_tokens(caregiver)

    async def refresh(self, refresh_token: str) -> AuthResponse:
        token_hash = hash_token(refresh_token)
        result = await self.db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        row = result.scalar_one_or_none()
        now = datetime.now(timezone.utc)
        if (
            row is None
            or row.revoked
            or row.expires_at.replace(tzinfo=timezone.utc) < now
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token",
            )
        row.revoked = True
        caregiver = await self.db.get(Caregiver, row.caregiver_id)
        if caregiver is None:
            raise HTTPException(status_code=401, detail="Caregiver not found")
        return await self._issue_tokens(caregiver)

    async def logout(self, refresh_token: str) -> None:
        token_hash = hash_token(refresh_token)
        result = await self.db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        row = result.scalar_one_or_none()
        if row:
            row.revoked = True
            await self.db.commit()

    async def _issue_tokens(self, caregiver: Caregiver) -> AuthResponse:
        access = create_access_token(caregiver.id, self.settings)
        refresh = create_refresh_token_value()
        self.db.add(
            RefreshToken(
                id=uuid4(),
                caregiver_id=caregiver.id,
                token_hash=hash_token(refresh),
                expires_at=datetime.now(timezone.utc)
                + timedelta(days=self.settings.jwt_refresh_ttl_days),
            )
        )
        await self.db.commit()
        await self.db.refresh(caregiver)
        return AuthResponse(
            caregiver=CaregiverOut.model_validate(caregiver),
            access=access,
            refresh=refresh,
        )

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.models.caregiver import Caregiver

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_access_token(caregiver_id: UUID, settings: Settings) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_ttl_min)
    payload = {"sub": str(caregiver_id), "type": "access", "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token_value() -> str:
    return secrets.token_urlsafe(48)


def decode_access_token(token: str, settings: Settings) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
        ) from exc
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token type",
        )
    return payload


async def require_api_key(
    api_key: str | None = Security(API_KEY_HEADER),
    settings: Settings = Depends(get_settings),
) -> None:
    if not settings.api_key_required:
        return
    if not settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="API key is required but not configured on the server",
        )
    if not api_key or api_key != settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key",
        )


async def get_current_caregiver(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    _: None = Depends(require_api_key),
) -> Caregiver:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )
    payload = decode_access_token(credentials.credentials, settings)
    try:
        caregiver_id = UUID(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
        ) from exc

    result = await db.execute(select(Caregiver).where(Caregiver.id == caregiver_id))
    caregiver = result.scalar_one_or_none()
    if caregiver is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Caregiver not found",
        )
    return caregiver


async def get_optional_caregiver(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    _: None = Depends(require_api_key),
) -> Caregiver | None:
    """Return the authenticated caregiver when a bearer token is present, else None."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        return None
    payload = decode_access_token(credentials.credentials, settings)
    try:
        caregiver_id = UUID(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
        ) from exc

    result = await db.execute(select(Caregiver).where(Caregiver.id == caregiver_id))
    return result.scalar_one_or_none()

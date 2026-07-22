from fastapi import APIRouter, Depends

from app.api.deps import get_auth_service, get_current_caregiver, require_api_key
from app.models.caregiver import Caregiver
from app.schemas.auth import (
    AuthResponse,
    CaregiverOut,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
)
from app.schemas.common import ErrorResponse
from app.services.auth_service import AuthService

router = APIRouter(
    prefix="/auth",
    tags=["Auth"],
    dependencies=[Depends(require_api_key)],
)


@router.post(
    "/register",
    response_model=AuthResponse,
    responses={409: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
    summary="Register caregiver account",
)
async def register(
    payload: RegisterRequest,
    service: AuthService = Depends(get_auth_service),
) -> AuthResponse:
    return await service.register(payload)


@router.post(
    "/login",
    response_model=AuthResponse,
    responses={401: {"model": ErrorResponse}},
    summary="Login caregiver",
)
async def login(
    payload: LoginRequest,
    service: AuthService = Depends(get_auth_service),
) -> AuthResponse:
    return await service.login(payload)


@router.post(
    "/refresh",
    response_model=AuthResponse,
    responses={401: {"model": ErrorResponse}},
    summary="Refresh access token",
)
async def refresh(
    payload: RefreshRequest,
    service: AuthService = Depends(get_auth_service),
) -> AuthResponse:
    return await service.refresh(payload.refresh)


@router.post("/logout", summary="Revoke refresh token")
async def logout(
    payload: RefreshRequest,
    service: AuthService = Depends(get_auth_service),
) -> dict:
    await service.logout(payload.refresh)
    return {"status": "ok"}


@router.get("/me", response_model=CaregiverOut, summary="Current caregiver profile")
async def me(caregiver: Caregiver = Depends(get_current_caregiver)) -> CaregiverOut:
    return CaregiverOut.model_validate(caregiver)

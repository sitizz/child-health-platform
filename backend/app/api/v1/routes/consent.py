from fastapi import APIRouter, Depends

from app.api.deps import get_consent_service, get_current_caregiver, require_api_key
from app.models.caregiver import Caregiver
from app.schemas.consent import (
    ConsentAcceptRequest,
    ConsentCurrentResponse,
    ConsentRecordOut,
    ConsentStatusResponse,
)
from app.services.consent_service import ConsentService

router = APIRouter(
    prefix="/consent",
    tags=["Consent"],
    dependencies=[Depends(require_api_key)],
)


@router.get("/current", response_model=ConsentCurrentResponse)
async def current_consent(
    service: ConsentService = Depends(get_consent_service),
) -> ConsentCurrentResponse:
    return service.current()


@router.get("/status", response_model=ConsentStatusResponse)
async def consent_status(
    caregiver: Caregiver = Depends(get_current_caregiver),
    service: ConsentService = Depends(get_consent_service),
) -> ConsentStatusResponse:
    return await service.status(caregiver.id)


@router.post("/accept", response_model=ConsentRecordOut)
async def accept_consent(
    payload: ConsentAcceptRequest,
    caregiver: Caregiver = Depends(get_current_caregiver),
    service: ConsentService = Depends(get_consent_service),
) -> ConsentRecordOut:
    return await service.accept(caregiver.id, payload)


@router.post("/withdraw", response_model=ConsentStatusResponse)
async def withdraw_consent(
    caregiver: Caregiver = Depends(get_current_caregiver),
    service: ConsentService = Depends(get_consent_service),
) -> ConsentStatusResponse:
    return await service.withdraw(caregiver.id)

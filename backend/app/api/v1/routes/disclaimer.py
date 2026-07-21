from fastapi import APIRouter, Depends

from app.api.deps import get_current_caregiver, get_disclaimer_service, require_api_key
from app.models.caregiver import Caregiver
from app.schemas.disclaimer import (
    DisclaimerAckOut,
    DisclaimerCurrentResponse,
    DisclaimerStatusResponse,
)
from app.services.disclaimer_service import DisclaimerService

router = APIRouter(
    prefix="/disclaimer",
    tags=["Disclaimer"],
    dependencies=[Depends(require_api_key)],
)


@router.get("/current", response_model=DisclaimerCurrentResponse)
async def current_disclaimer(
    service: DisclaimerService = Depends(get_disclaimer_service),
) -> DisclaimerCurrentResponse:
    return service.current()


@router.get("/status", response_model=DisclaimerStatusResponse)
async def disclaimer_status(
    caregiver: Caregiver = Depends(get_current_caregiver),
    service: DisclaimerService = Depends(get_disclaimer_service),
) -> DisclaimerStatusResponse:
    return await service.status(caregiver.id)


@router.post("/acknowledge", response_model=DisclaimerAckOut)
async def acknowledge_disclaimer(
    caregiver: Caregiver = Depends(get_current_caregiver),
    service: DisclaimerService = Depends(get_disclaimer_service),
) -> DisclaimerAckOut:
    return await service.acknowledge(caregiver.id)

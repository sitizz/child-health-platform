from fastapi import APIRouter, Depends

from app.api.deps import (
    get_push_service,
    require_api_key,
    require_personalised_access,
)
from app.models.caregiver import Caregiver
from app.schemas.device import (
    DeviceOut,
    DeviceRegisterRequest,
    DispatchResponse,
    NotificationTestRequest,
)
from app.services.push_service import PushService

router = APIRouter(tags=["Devices"])


@router.post("/devices", response_model=DeviceOut, status_code=201)
async def register_device(
    payload: DeviceRegisterRequest,
    caregiver: Caregiver = Depends(require_personalised_access),
    service: PushService = Depends(get_push_service),
) -> DeviceOut:
    return await service.register(caregiver.id, payload)


@router.delete("/devices/{token}", status_code=204)
async def delete_device(
    token: str,
    caregiver: Caregiver = Depends(require_personalised_access),
    service: PushService = Depends(get_push_service),
) -> None:
    await service.deactivate(caregiver.id, token)


@router.post("/notifications/test", summary="Send test push to current caregiver")
async def test_notification(
    payload: NotificationTestRequest,
    caregiver: Caregiver = Depends(require_personalised_access),
    service: PushService = Depends(get_push_service),
) -> dict:
    sent = await service.send_to_caregiver(
        caregiver.id, payload.title, payload.body, ntype="test"
    )
    return {"sent": sent}


@router.post(
    "/notifications/dispatch",
    response_model=DispatchResponse,
    dependencies=[Depends(require_api_key)],
    tags=["Notifications"],
    summary="Scheduler dispatch for high-risk / improved alerts",
)
async def dispatch_notifications(
    service: PushService = Depends(get_push_service),
) -> DispatchResponse:
    return await service.dispatch()

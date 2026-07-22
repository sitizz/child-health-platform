from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.deps import get_child_service, require_personalised_access
from app.models.caregiver import Caregiver
from app.schemas.child import ChildCreate, ChildOut, ChildUpdate
from app.services.child_service import ChildService

router = APIRouter(prefix="/children", tags=["Children"])


@router.get("", response_model=list[ChildOut])
async def list_children(
    caregiver: Caregiver = Depends(require_personalised_access),
    service: ChildService = Depends(get_child_service),
) -> list[ChildOut]:
    return await service.list(caregiver.id)


@router.post("", response_model=ChildOut, status_code=201)
async def create_child(
    payload: ChildCreate,
    caregiver: Caregiver = Depends(require_personalised_access),
    service: ChildService = Depends(get_child_service),
) -> ChildOut:
    return await service.create(caregiver.id, payload)


@router.get("/{child_id}", response_model=ChildOut)
async def get_child(
    child_id: UUID,
    caregiver: Caregiver = Depends(require_personalised_access),
    service: ChildService = Depends(get_child_service),
) -> ChildOut:
    child = await service.get(caregiver.id, child_id)
    return ChildOut.model_validate(child)


@router.patch("/{child_id}", response_model=ChildOut)
async def update_child(
    child_id: UUID,
    payload: ChildUpdate,
    caregiver: Caregiver = Depends(require_personalised_access),
    service: ChildService = Depends(get_child_service),
) -> ChildOut:
    return await service.update(caregiver.id, child_id, payload)


@router.delete("/{child_id}", status_code=204)
async def delete_child(
    child_id: UUID,
    caregiver: Caregiver = Depends(require_personalised_access),
    service: ChildService = Depends(get_child_service),
) -> None:
    await service.delete(caregiver.id, child_id)


@router.post("/{child_id}/select", response_model=ChildOut)
async def select_child(
    child_id: UUID,
    caregiver: Caregiver = Depends(require_personalised_access),
    service: ChildService = Depends(get_child_service),
) -> ChildOut:
    return await service.select(caregiver.id, child_id)

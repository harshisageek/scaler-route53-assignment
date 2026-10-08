from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.record_set import (
    RecordSetCreate,
    RecordSetList,
    RecordSetListParams,
    RecordSetOut,
    RecordSetUpdate,
)
from app.services import record_sets as service

router = APIRouter(
    prefix="/hosted-zones/{zone_id}/records",
    tags=["record sets"],
)


@router.get("", response_model=RecordSetList, summary="Search, filter and page record sets")
def list_record_sets(
    zone_id: str,
    params: Annotated[RecordSetListParams, Query()],
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RecordSetList:
    return service.list_record_sets(db, user, zone_id, params)


@router.post("", response_model=RecordSetOut, status_code=status.HTTP_201_CREATED)
def create_record_set(
    zone_id: str,
    body: RecordSetCreate,
    response: Response,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RecordSetOut:
    record = service.create_record_set(db, user, zone_id, body)
    response.headers["Location"] = f"/api/v1/hosted-zones/{zone_id}/records/{record.id}"
    return record


@router.get("/{record_set_id}", response_model=RecordSetOut)
def get_record_set(
    zone_id: str,
    record_set_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RecordSetOut:
    return service.get_record_set(db, user, zone_id, record_set_id)


@router.put("/{record_set_id}", response_model=RecordSetOut)
def update_record_set(
    zone_id: str,
    record_set_id: int,
    body: RecordSetUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RecordSetOut:
    return service.update_record_set(db, user, zone_id, record_set_id, body)


@router.delete("/{record_set_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record_set(
    zone_id: str,
    record_set_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    service.delete_record_set(db, user, zone_id, record_set_id)

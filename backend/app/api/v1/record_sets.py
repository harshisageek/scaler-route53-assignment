from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.bind_import import BindImportPreview, BindImportResult
from app.schemas.record_set import (
    RecordSetCreate,
    RecordSetList,
    RecordSetListParams,
    RecordSetOut,
    RecordSetUpdate,
)
from app.services import bind_import
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


@router.post("/import/preview", response_model=BindImportPreview)
async def preview_bind_import(
    zone_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BindImportPreview:
    content = await file.read(bind_import.MAX_BIND_FILE_SIZE + 1)
    return bind_import.preview_bind_import(
        db,
        user,
        zone_id,
        file.filename or "zone-file.txt",
        content,
    )


@router.post(
    "/import",
    response_model=BindImportResult,
    status_code=status.HTTP_201_CREATED,
)
async def apply_bind_import(
    zone_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BindImportResult:
    content = await file.read(bind_import.MAX_BIND_FILE_SIZE + 1)
    return bind_import.apply_bind_import(db, user, zone_id, content)


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

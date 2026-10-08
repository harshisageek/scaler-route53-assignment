from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.hosted_zone import (
    HostedZoneCreate,
    HostedZoneDetail,
    HostedZoneList,
    HostedZoneListParams,
    HostedZoneUpdate,
)
from app.services import hosted_zones as service

router = APIRouter(prefix="/hosted-zones", tags=["hosted zones"])


@router.get("", response_model=HostedZoneList, summary="Search, sort and page your hosted zones")
def list_hosted_zones(
    params: Annotated[HostedZoneListParams, Query()],
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> HostedZoneList:
    return service.list_hosted_zones(db, user, params)


@router.post(
    "",
    response_model=HostedZoneDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create a hosted zone with its default NS and SOA records",
)
def create_hosted_zone(
    body: HostedZoneCreate,
    response: Response,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> HostedZoneDetail:
    zone = service.create_hosted_zone(db, user, body)
    response.headers["Location"] = f"/api/v1/hosted-zones/{zone.id}"
    return zone


@router.get("/{zone_id}", response_model=HostedZoneDetail, summary="Get one hosted zone")
def get_hosted_zone(
    zone_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> HostedZoneDetail:
    return service.get_hosted_zone(db, user, zone_id)


@router.patch("/{zone_id}", response_model=HostedZoneDetail, summary="Edit a zone's comment")
def update_hosted_zone(
    zone_id: str,
    body: HostedZoneUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> HostedZoneDetail:
    return service.update_hosted_zone(db, user, zone_id, body)


@router.delete(
    "/{zone_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a zone that has only its default NS and SOA records",
    responses={409: {"description": "The zone still has other record sets."}},
)
def delete_hosted_zone(
    zone_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> None:
    service.delete_hosted_zone(db, user, zone_id)

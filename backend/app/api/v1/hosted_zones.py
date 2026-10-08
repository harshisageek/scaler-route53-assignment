from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import HostedZone, User
from app.schemas.hosted_zone import HostedZoneList, HostedZoneOut
from app.services import hosted_zones as service

router = APIRouter(prefix="/hosted-zones", tags=["hosted zones"])


@router.get("", response_model=HostedZoneList, summary="List your hosted zones")
def list_hosted_zones(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> HostedZoneList:
    return service.list_hosted_zones(db, user)


@router.get("/{zone_id}", response_model=HostedZoneOut, summary="Get one hosted zone")
def get_hosted_zone(
    zone_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> HostedZone:
    return service.get_hosted_zone(db, user, zone_id)

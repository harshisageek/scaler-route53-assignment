from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.hosted_zone import HostedZoneList
from app.services import hosted_zones as service

router = APIRouter(prefix="/hosted-zones", tags=["hosted zones"])


@router.get("", response_model=HostedZoneList, summary="List hosted zones")
def list_hosted_zones(db: Session = Depends(get_db)) -> HostedZoneList:
    return service.list_hosted_zones(db)

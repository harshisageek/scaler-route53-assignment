from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.bulk import (
    BatchResult,
    HostedZoneDeleteBatch,
    HostedZoneDeleteResult,
    RecordSetChangeBatch,
)
from app.services import hosted_zones, record_sets

router = APIRouter(tags=["bulk operations"])


@router.post(
    "/hosted-zones/{zone_id}/records:batch",
    response_model=BatchResult,
)
def apply_record_set_change_batch(
    zone_id: str,
    body: RecordSetChangeBatch,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BatchResult:
    return record_sets.apply_change_batch(db, user, zone_id, body)


@router.post("/hosted-zones:batch", response_model=HostedZoneDeleteResult)
def delete_hosted_zone_batch(
    body: HostedZoneDeleteBatch,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> HostedZoneDeleteResult:
    return hosted_zones.delete_hosted_zones(db, user, body)

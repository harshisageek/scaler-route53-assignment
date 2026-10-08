from sqlalchemy.orm import Session

from app.repositories import hosted_zones as repository
from app.schemas.hosted_zone import HostedZoneList, HostedZoneOut


def list_hosted_zones(db: Session) -> HostedZoneList:
    zones = repository.list_hosted_zones(db)
    return HostedZoneList(
        items=[HostedZoneOut.model_validate(zone) for zone in zones],
        total=repository.count_hosted_zones(db),
    )

from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.models import HostedZone, User
from app.repositories import hosted_zones as repository
from app.schemas.hosted_zone import HostedZoneList, HostedZoneOut


def list_hosted_zones(db: Session, owner: User) -> HostedZoneList:
    zones = repository.list_hosted_zones(db, owner.id)
    return HostedZoneList(
        items=[HostedZoneOut.model_validate(zone) for zone in zones],
        total=repository.count_hosted_zones(db, owner.id),
    )


def get_hosted_zone(db: Session, owner: User, zone_id: str) -> HostedZone:
    """Return one of the owner's zones.

    Another user's zone is reported as missing, not forbidden: a 403 would
    confirm that the ID exists.
    """
    zone = repository.get_hosted_zone(db, owner.id, zone_id)
    if zone is None:
        raise NotFoundError(f"No hosted zone found with ID: {zone_id}", code="NoSuchHostedZone")
    return zone

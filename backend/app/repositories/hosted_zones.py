"""Database access for hosted zones. No business rules live here.

Every query takes the owner's ID, so one user can never read another's zones.
"""

from collections.abc import Sequence

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models import HostedZone


def list_hosted_zones(db: Session, owner_id: int) -> Sequence[HostedZone]:
    statement = (
        select(HostedZone)
        .where(HostedZone.owner_id == owner_id)
        .order_by(HostedZone.name, HostedZone.id)
    )
    return db.scalars(statement).all()


def count_hosted_zones(db: Session, owner_id: int) -> int:
    statement = select(func.count()).select_from(HostedZone).where(HostedZone.owner_id == owner_id)
    return db.scalar(statement) or 0


def get_hosted_zone(db: Session, owner_id: int, zone_id: str) -> HostedZone | None:
    statement = select(HostedZone).where(HostedZone.id == zone_id, HostedZone.owner_id == owner_id)
    return db.scalar(statement)


def add_hosted_zone(db: Session, zone: HostedZone) -> HostedZone:
    db.add(zone)
    db.flush()
    return zone


def delete_all_hosted_zones(db: Session, owner_id: int) -> None:
    db.execute(delete(HostedZone).where(HostedZone.owner_id == owner_id))

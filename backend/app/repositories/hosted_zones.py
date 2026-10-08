"""Database access for hosted zones. No business rules live here."""

from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import HostedZone


def list_hosted_zones(db: Session) -> Sequence[HostedZone]:
    statement = select(HostedZone).order_by(HostedZone.name, HostedZone.id)
    return db.scalars(statement).all()


def count_hosted_zones(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(HostedZone)) or 0


def add_hosted_zone(db: Session, zone: HostedZone) -> HostedZone:
    db.add(zone)
    db.flush()
    return zone

"""Database access for record sets. No business rules live here.

Callers check that the zone belongs to the current user before reaching these.
"""

from collections.abc import Iterable

from sqlalchemy import and_, func, not_, select
from sqlalchemy.orm import Session

from app.models import HostedZone, RecordSet


def add_record_sets(db: Session, record_sets: Iterable[RecordSet]) -> None:
    db.add_all(list(record_sets))
    db.flush()


def count_by_zone(db: Session, zone_ids: Iterable[str]) -> dict[str, int]:
    ids = list(zone_ids)
    if not ids:
        return {}
    statement = (
        select(RecordSet.hosted_zone_id, func.count())
        .where(RecordSet.hosted_zone_id.in_(ids))
        .group_by(RecordSet.hosted_zone_id)
    )
    counts: dict[str, int] = dict(db.execute(statement).all())
    return {zone_id: counts.get(zone_id, 0) for zone_id in ids}


def count_non_default(db: Session, zone: HostedZone) -> int:
    """Record sets other than the NS and SOA at the zone apex, which Route 53 creates."""
    is_default = and_(RecordSet.name == zone.name, RecordSet.type.in_(("NS", "SOA")))
    statement = (
        select(func.count())
        .select_from(RecordSet)
        .where(RecordSet.hosted_zone_id == zone.id, not_(is_default))
    )
    return db.scalar(statement) or 0

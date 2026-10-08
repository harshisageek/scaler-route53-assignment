"""Database access for record sets. No business rules live here.

Callers check that the zone belongs to the current user before reaching these.
"""

from collections.abc import Iterable, Sequence

from sqlalchemy import String, and_, func, not_, or_, select
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


def search_record_sets(
    db: Session,
    zone_id: str,
    *,
    q: str | None,
    record_type: str | None,
    sort: str,
    offset: int,
    limit: int,
) -> tuple[Sequence[RecordSet], int]:
    filters = [RecordSet.hosted_zone_id == zone_id]
    if q:
        pattern = f"%{_escape_like(q.strip())}%"
        filters.append(
            or_(
                RecordSet.name.ilike(pattern, escape="\\"),
                RecordSet.values.cast(String).ilike(pattern, escape="\\"),
            )
        )
    if record_type:
        filters.append(RecordSet.type == record_type)

    total = db.scalar(select(func.count()).select_from(RecordSet).where(*filters)) or 0
    columns = {"name": RecordSet.name, "type": RecordSet.type, "ttl": RecordSet.ttl}
    column = columns[sort.removeprefix("-")]
    statement = (
        select(RecordSet)
        .where(*filters)
        .order_by(
            column.desc() if sort.startswith("-") else column.asc(),
            RecordSet.name,
            RecordSet.type,
            RecordSet.id,
        )
        .offset(offset)
        .limit(limit)
    )
    return db.scalars(statement).all(), total


def get_record_set(db: Session, zone_id: str, record_set_id: int) -> RecordSet | None:
    return db.scalar(
        select(RecordSet).where(
            RecordSet.hosted_zone_id == zone_id,
            RecordSet.id == record_set_id,
        )
    )


def exists_by_name_and_type(
    db: Session,
    zone_id: str,
    name: str,
    record_type: str,
    *,
    exclude_id: int | None = None,
) -> bool:
    filters = [
        RecordSet.hosted_zone_id == zone_id,
        RecordSet.name == name,
        RecordSet.type == record_type,
    ]
    if exclude_id is not None:
        filters.append(RecordSet.id != exclude_id)
    return db.scalar(select(RecordSet.id).where(*filters).limit(1)) is not None


def delete_record_set(db: Session, record_set: RecordSet) -> None:
    db.delete(record_set)
    db.flush()


def _escape_like(text: str) -> str:
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")

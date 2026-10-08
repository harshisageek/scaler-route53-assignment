"""Database access for hosted zones. No business rules live here.

Every query takes the owner's ID, so one user can never read another's zones.
"""

from collections.abc import Sequence

from sqlalchemy import ColumnElement, delete, func, or_, select
from sqlalchemy.orm import Session

from app.models import HostedZone, RecordSet


def search_hosted_zones(
    db: Session, owner_id: int, *, q: str | None, sort: str, offset: int, limit: int
) -> tuple[Sequence[tuple[HostedZone, int]], int]:
    """One page of the owner's zones with their record counts, plus the total match count.

    ``sort`` is a column name, prefixed with "-" for descending order.
    """
    filters: list[ColumnElement[bool]] = [HostedZone.owner_id == owner_id]
    if q:
        pattern = f"%{_escape_like(q.strip())}%"
        filters.append(
            or_(
                HostedZone.name.ilike(pattern, escape="\\"),
                HostedZone.id.ilike(pattern, escape="\\"),
                HostedZone.comment.ilike(pattern, escape="\\"),
            )
        )

    total = db.scalar(select(func.count()).select_from(HostedZone).where(*filters)) or 0

    counts = (
        select(RecordSet.hosted_zone_id, func.count().label("record_count"))
        .group_by(RecordSet.hosted_zone_id)
        .subquery()
    )
    record_count = func.coalesce(counts.c.record_count, 0)
    columns = {
        "name": HostedZone.name,
        "type": HostedZone.private_zone,
        "record_count": record_count,
        "created_at": HostedZone.created_at,
    }
    column = columns[sort.removeprefix("-")]
    statement = (
        select(HostedZone, record_count)
        .outerjoin(counts, counts.c.hosted_zone_id == HostedZone.id)
        .where(*filters)
        # Name, then ID, breaks ties so pages never overlap or skip a zone.
        .order_by(
            column.desc() if sort.startswith("-") else column.asc(), HostedZone.name, HostedZone.id
        )
        .offset(offset)
        .limit(limit)
    )
    rows = [(zone, count) for zone, count in db.execute(statement).all()]
    return rows, total


def _escape_like(text: str) -> str:
    """Make %, _ and the escape character itself match literally."""
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def get_hosted_zone(db: Session, owner_id: int, zone_id: str) -> HostedZone | None:
    statement = select(HostedZone).where(HostedZone.id == zone_id, HostedZone.owner_id == owner_id)
    return db.scalar(statement)


def add_hosted_zone(db: Session, zone: HostedZone) -> HostedZone:
    db.add(zone)
    db.flush()
    return zone


def delete_hosted_zone(db: Session, zone: HostedZone) -> None:
    """Delete a zone. Its record sets go with it through ON DELETE CASCADE."""
    db.delete(zone)
    db.flush()


def delete_all_hosted_zones(db: Session, owner_id: int) -> None:
    db.execute(delete(HostedZone).where(HostedZone.owner_id == owner_id))

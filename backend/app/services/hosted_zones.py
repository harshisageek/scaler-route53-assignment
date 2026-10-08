from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError
from app.models import HostedZone, RecordSet, User
from app.repositories import hosted_zones as repository
from app.repositories import record_sets
from app.schemas.hosted_zone import (
    HostedZoneCreate,
    HostedZoneDetail,
    HostedZoneList,
    HostedZoneListParams,
    HostedZoneOut,
    HostedZoneUpdate,
    Vpc,
)
from app.services import name_servers
from app.services.ids import new_hosted_zone_id


def list_hosted_zones(db: Session, owner: User, params: HostedZoneListParams) -> HostedZoneList:
    rows, total = repository.search_hosted_zones(
        db,
        owner.id,
        q=params.q,
        sort=params.sort,
        offset=(params.page - 1) * params.page_size,
        limit=params.page_size,
    )
    return HostedZoneList(
        items=[_summary(zone, record_count) for zone, record_count in rows],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


def get_hosted_zone(db: Session, owner: User, zone_id: str) -> HostedZoneDetail:
    return _detail(db, _owned_zone(db, owner, zone_id))


def update_hosted_zone(
    db: Session, owner: User, zone_id: str, request: HostedZoneUpdate
) -> HostedZoneDetail:
    zone = _owned_zone(db, owner, zone_id)
    zone.comment = request.comment
    db.commit()
    return _detail(db, zone)


def delete_hosted_zone(db: Session, owner: User, zone_id: str) -> None:
    """Delete a zone, as Route 53 does, only once it holds just the default records."""
    zone = _owned_zone(db, owner, zone_id)
    extra = record_sets.count_non_default(db, zone)
    if extra:
        raise ConflictError(
            f"This hosted zone still has {extra} record {'set' if extra == 1 else 'sets'}"
            " besides the default NS and SOA records. Delete them first.",
            {"record_count": extra},
            code="HostedZoneNotEmpty",
        )
    repository.delete_hosted_zone(db, zone)
    db.commit()


def create_hosted_zone(db: Session, owner: User, request: HostedZoneCreate) -> HostedZoneDetail:
    zone = add_hosted_zone(db, owner.id, request)
    db.commit()
    return _detail(db, zone)


def add_hosted_zone(db: Session, owner_id: int, request: HostedZoneCreate) -> HostedZone:
    """Add a zone and its default NS and SOA records, without committing.

    Both go in the caller's transaction, so a zone never exists without them.
    """
    servers = name_servers.new_delegation_set(request.private_zone)
    zone = repository.add_hosted_zone(
        db,
        HostedZone(
            id=new_hosted_zone_id(),
            owner_id=owner_id,
            name=request.name,
            comment=request.comment,
            private_zone=request.private_zone,
            name_servers=servers,
            vpc_region=request.vpc.region if request.vpc else None,
            vpc_id=request.vpc.vpc_id if request.vpc else None,
        ),
    )
    record_sets.add_record_sets(
        db,
        [
            RecordSet(
                hosted_zone_id=zone.id,
                name=zone.name,
                type="NS",
                ttl=name_servers.NS_TTL,
                values=servers,
            ),
            RecordSet(
                hosted_zone_id=zone.id,
                name=zone.name,
                type="SOA",
                ttl=name_servers.SOA_TTL,
                values=[name_servers.soa_value(servers[0])],
            ),
        ],
    )
    return zone


def _owned_zone(db: Session, owner: User, zone_id: str) -> HostedZone:
    """Return one of the owner's zones.

    Another user's zone is reported as missing, not forbidden: a 403 would
    confirm that the ID exists.
    """
    zone = repository.get_hosted_zone(db, owner.id, zone_id)
    if zone is None:
        raise NotFoundError(f"No hosted zone found with ID: {zone_id}", code="NoSuchHostedZone")
    return zone


def _summary(zone: HostedZone, record_count: int) -> HostedZoneOut:
    return HostedZoneOut(
        id=zone.id,
        name=zone.name,
        comment=zone.comment,
        private_zone=zone.private_zone,
        record_count=record_count,
        created_at=zone.created_at,
    )


def _detail(db: Session, zone: HostedZone) -> HostedZoneDetail:
    vpc = (
        Vpc(region=zone.vpc_region, vpc_id=zone.vpc_id)
        if zone.vpc_region is not None and zone.vpc_id is not None
        else None
    )
    return HostedZoneDetail(
        **_summary(zone, record_sets.count_by_zone(db, [zone.id])[zone.id]).model_dump(),
        updated_at=zone.updated_at,
        name_servers=zone.name_servers,
        vpc=vpc,
    )

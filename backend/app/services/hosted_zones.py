from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError
from app.models import HostedZone, RecordSet, User
from app.models import HostedZoneTag as HostedZoneTagModel
from app.repositories import hosted_zones as repository
from app.repositories import record_sets
from app.schemas.bulk import HostedZoneDeleteBatch, HostedZoneDeleteResult
from app.schemas.hosted_zone import (
    HostedZoneCreate,
    HostedZoneDetail,
    HostedZoneList,
    HostedZoneListParams,
    HostedZoneOut,
    HostedZoneUpdate,
    Vpc,
)
from app.schemas.hosted_zone import (
    HostedZoneTag as HostedZoneTagOut,
)
from app.services import name_servers
from app.services.ids import new_hosted_zone_id

MAX_HOSTED_ZONES_PER_ACCOUNT = 100


def list_hosted_zones(db: Session, owner: User, params: HostedZoneListParams) -> HostedZoneList:
    rows, total = repository.search_hosted_zones(
        db,
        owner.id,
        q=params.q,
        tag_key=params.tag_key,
        tag_value=params.tag_value,
        sort=params.sort,
        offset=(params.page - 1) * params.page_size,
        limit=params.page_size,
    )
    tags_by_zone = repository.get_tags_by_zone_ids(db, [zone.id for zone, _ in rows])
    return HostedZoneList(
        items=[_summary(zone, record_count, tags_by_zone[zone.id]) for zone, record_count in rows],
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
    if request.tags is not None:
        repository.replace_tags(
            db,
            zone.id,
            [(tag.key, tag.value) for tag in request.tags],
        )
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


def delete_hosted_zones(
    db: Session,
    owner: User,
    request: HostedZoneDeleteBatch,
) -> HostedZoneDeleteResult:
    zone_ids = list(dict.fromkeys(request.hosted_zone_ids))
    zones = [_owned_zone(db, owner, zone_id) for zone_id in zone_ids]
    non_empty = [
        {"hosted_zone_id": zone.id, "record_count": extra}
        for zone in zones
        if (extra := record_sets.count_non_default(db, zone)) > 0
    ]
    if non_empty:
        raise ConflictError(
            "Every selected hosted zone must contain only its default NS and SOA records.",
            {"hosted_zones": non_empty},
            code="HostedZonesNotEmpty",
        )
    try:
        for zone in zones:
            repository.delete_hosted_zone(db, zone)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return HostedZoneDeleteResult(deleted_count=len(zones))


def create_hosted_zone(db: Session, owner: User, request: HostedZoneCreate) -> HostedZoneDetail:
    if repository.count_hosted_zones(db, owner.id) >= MAX_HOSTED_ZONES_PER_ACCOUNT:
        raise ConflictError(
            f"An account can have at most {MAX_HOSTED_ZONES_PER_ACCOUNT} hosted zones.",
            {"maximum_hosted_zones": MAX_HOSTED_ZONES_PER_ACCOUNT},
            code="TooManyHostedZones",
        )
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
    repository.replace_tags(
        db,
        zone.id,
        [(tag.key, tag.value) for tag in request.tags],
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


def _summary(
    zone: HostedZone,
    record_count: int,
    tags: list[HostedZoneTagModel],
) -> HostedZoneOut:
    return HostedZoneOut(
        id=zone.id,
        name=zone.name,
        comment=zone.comment,
        private_zone=zone.private_zone,
        record_count=record_count,
        tags=[HostedZoneTagOut(key=tag.key, value=tag.value) for tag in tags],
        created_at=zone.created_at,
    )


def _detail(db: Session, zone: HostedZone) -> HostedZoneDetail:
    vpc = (
        Vpc(region=zone.vpc_region, vpc_id=zone.vpc_id)
        if zone.vpc_region is not None and zone.vpc_id is not None
        else None
    )
    tags = repository.get_tags_by_zone_ids(db, [zone.id])[zone.id]
    return HostedZoneDetail(
        **_summary(
            zone,
            record_sets.count_by_zone(db, [zone.id])[zone.id],
            tags,
        ).model_dump(),
        updated_at=zone.updated_at,
        name_servers=zone.name_servers,
        vpc=vpc,
    )

from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError, ValidationFailedError
from app.models import HostedZone, RecordSet, User
from app.repositories import hosted_zones, record_sets
from app.schemas.record_set import (
    RecordSetCreate,
    RecordSetList,
    RecordSetListParams,
    RecordSetOut,
    RecordSetUpdate,
)
from app.services.validation.domain_names import InvalidDomainNameError, normalize_record_name


def list_record_sets(
    db: Session, owner: User, zone_id: str, params: RecordSetListParams
) -> RecordSetList:
    zone = _owned_zone(db, owner, zone_id)
    records, total = record_sets.search_record_sets(
        db,
        zone.id,
        q=params.q,
        record_type=params.record_type,
        sort=params.sort,
        offset=(params.page - 1) * params.page_size,
        limit=params.page_size,
    )
    return RecordSetList(
        items=[RecordSetOut.model_validate(record) for record in records],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


def get_record_set(db: Session, owner: User, zone_id: str, record_set_id: int) -> RecordSetOut:
    zone = _owned_zone(db, owner, zone_id)
    return RecordSetOut.model_validate(_record_set(db, zone, record_set_id))


def create_record_set(
    db: Session, owner: User, zone_id: str, request: RecordSetCreate
) -> RecordSetOut:
    zone = _owned_zone(db, owner, zone_id)
    name = _record_name(request.name, zone.name)
    _ensure_available(db, zone.id, name, request.type)
    record = RecordSet(
        hosted_zone_id=zone.id,
        name=name,
        type=request.type,
        ttl=request.ttl,
        values=request.values,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return RecordSetOut.model_validate(record)


def update_record_set(
    db: Session,
    owner: User,
    zone_id: str,
    record_set_id: int,
    request: RecordSetUpdate,
) -> RecordSetOut:
    zone = _owned_zone(db, owner, zone_id)
    record = _record_set(db, zone, record_set_id)
    name = _record_name(request.name, zone.name)
    _ensure_available(db, zone.id, name, request.type, exclude_id=record.id)
    record.name = name
    record.type = request.type
    record.ttl = request.ttl
    record.values = request.values
    db.commit()
    db.refresh(record)
    return RecordSetOut.model_validate(record)


def delete_record_set(db: Session, owner: User, zone_id: str, record_set_id: int) -> None:
    zone = _owned_zone(db, owner, zone_id)
    record_sets.delete_record_set(db, _record_set(db, zone, record_set_id))
    db.commit()


def _owned_zone(db: Session, owner: User, zone_id: str) -> HostedZone:
    zone = hosted_zones.get_hosted_zone(db, owner.id, zone_id)
    if zone is None:
        raise NotFoundError(
            "No hosted zone was found with that ID.",
            code="NoSuchHostedZone",
        )
    return zone


def _record_set(db: Session, zone: HostedZone, record_set_id: int) -> RecordSet:
    record = record_sets.get_record_set(db, zone.id, record_set_id)
    if record is None:
        raise NotFoundError(
            "No record set was found with that ID.",
            code="NoSuchRecordSet",
        )
    return record


def _record_name(raw: str, zone_name: str) -> str:
    try:
        return normalize_record_name(raw, zone_name)
    except InvalidDomainNameError as exc:
        raise ValidationFailedError(
            "One or more fields are invalid.",
            {"fields": [{"loc": ["body", "name"], "msg": str(exc)}]},
        ) from exc


def _ensure_available(
    db: Session,
    zone_id: str,
    name: str,
    record_type: str,
    *,
    exclude_id: int | None = None,
) -> None:
    if record_sets.exists_by_name_and_type(
        db,
        zone_id,
        name,
        record_type,
        exclude_id=exclude_id,
    ):
        raise ConflictError(
            f"A {record_type} record set already exists for {name}",
            {"name": name, "type": record_type},
            code="RecordSetAlreadyExists",
        )

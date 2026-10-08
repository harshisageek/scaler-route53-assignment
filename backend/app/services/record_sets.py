from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError, ValidationFailedError
from app.models import HostedZone, RecordSet, User
from app.repositories import hosted_zones, record_sets
from app.schemas.bulk import BatchResult, RecordSetChangeBatch
from app.schemas.record_set import (
    AliasTargetType,
    EditableRecordType,
    RecordSetCreate,
    RecordSetList,
    RecordSetListParams,
    RecordSetOut,
    RecordSetUpdate,
)
from app.services.alias_targets import MOCK_ALIAS_TARGETS
from app.services.validation.domain_names import InvalidDomainNameError, normalize_record_name
from app.services.validation.record_values import (
    InvalidRecordValueError,
    normalize_record_values,
)


def list_record_sets(
    db: Session, owner: User, zone_id: str, params: RecordSetListParams
) -> RecordSetList:
    zone = _owned_zone(db, owner, zone_id)
    records, total = record_sets.search_record_sets(
        db,
        zone.id,
        q=params.q,
        record_type=params.record_type,
        routing_policy=params.routing_policy,
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
    db: Session,
    owner: User,
    zone_id: str,
    request: RecordSetCreate,
    *,
    commit: bool = True,
) -> RecordSetOut:
    zone = _owned_zone(db, owner, zone_id)
    name = _record_name(request.name, zone.name)
    values = [] if request.alias else _record_values(request.type, request.values)
    alias_target = _alias_target(db, zone, name, request)
    set_identifier = request.set_identifier or ""
    _ensure_cname_compatible(db, zone, name, request.type)
    _ensure_policy_compatible(
        db,
        zone.id,
        name,
        request.type,
        request.routing_policy,
    )
    _ensure_available(
        db,
        zone.id,
        name,
        request.type,
        set_identifier,
    )
    record = RecordSet(
        hosted_zone_id=zone.id,
        name=name,
        type=request.type,
        ttl=request.ttl,
        values=values,
        routing_policy=request.routing_policy,
        set_identifier=set_identifier,
        weight=request.weight,
        failover_role=request.failover_role,
        region=request.region,
        geolocation=request.geolocation,
        alias=request.alias,
        alias_target_type=request.alias_target_type,
        alias_target=alias_target,
        evaluate_target_health=request.evaluate_target_health,
    )
    db.add(record)
    if commit:
        db.commit()
        db.refresh(record)
    else:
        db.flush()
    return RecordSetOut.model_validate(record)


def update_record_set(
    db: Session,
    owner: User,
    zone_id: str,
    record_set_id: int,
    request: RecordSetUpdate,
    *,
    commit: bool = True,
) -> RecordSetOut:
    zone = _owned_zone(db, owner, zone_id)
    record = _record_set(db, zone, record_set_id)
    _protect_default_record(zone, record)
    name = _record_name(request.name, zone.name)
    values = [] if request.alias else _record_values(request.type, request.values)
    alias_target = _alias_target(
        db,
        zone,
        name,
        request,
        exclude_id=record.id,
    )
    set_identifier = request.set_identifier or ""
    _ensure_cname_compatible(db, zone, name, request.type, exclude_id=record.id)
    _ensure_policy_compatible(
        db,
        zone.id,
        name,
        request.type,
        request.routing_policy,
        exclude_id=record.id,
    )
    _ensure_available(
        db,
        zone.id,
        name,
        request.type,
        set_identifier,
        exclude_id=record.id,
    )
    record.name = name
    record.type = request.type
    record.ttl = request.ttl
    record.values = values
    record.routing_policy = request.routing_policy
    record.set_identifier = set_identifier
    record.weight = request.weight
    record.failover_role = request.failover_role
    record.region = request.region
    record.geolocation = request.geolocation
    record.alias = request.alias
    record.alias_target_type = request.alias_target_type
    record.alias_target = alias_target
    record.evaluate_target_health = request.evaluate_target_health
    if commit:
        db.commit()
        db.refresh(record)
    else:
        db.flush()
    return RecordSetOut.model_validate(record)


def delete_record_set(
    db: Session,
    owner: User,
    zone_id: str,
    record_set_id: int,
    *,
    commit: bool = True,
) -> None:
    zone = _owned_zone(db, owner, zone_id)
    record = _record_set(db, zone, record_set_id)
    _protect_default_record(zone, record)
    record_sets.delete_record_set(db, record)
    if commit:
        db.commit()


def apply_change_batch(
    db: Session,
    owner: User,
    zone_id: str,
    request: RecordSetChangeBatch,
) -> BatchResult:
    try:
        for change in request.changes:
            if change.action == "CREATE":
                assert change.record_set is not None
                create_record_set(
                    db,
                    owner,
                    zone_id,
                    RecordSetCreate.model_validate(change.record_set.model_dump()),
                    commit=False,
                )
            elif change.action == "UPSERT":
                assert change.record_set_id is not None
                assert change.record_set is not None
                update_record_set(
                    db,
                    owner,
                    zone_id,
                    change.record_set_id,
                    RecordSetUpdate.model_validate(change.record_set.model_dump()),
                    commit=False,
                )
            else:
                assert change.record_set_id is not None
                delete_record_set(
                    db,
                    owner,
                    zone_id,
                    change.record_set_id,
                    commit=False,
                )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return BatchResult(applied_count=len(request.changes))


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


def _record_values(record_type: EditableRecordType, values: list[str]) -> list[str]:
    try:
        return normalize_record_values(record_type, values)
    except InvalidRecordValueError as exc:
        raise ValidationFailedError(
            "One or more fields are invalid.",
            {"fields": [{"loc": ["body", "values"], "msg": str(exc)}]},
        ) from exc


def _alias_target(
    db: Session,
    zone: HostedZone,
    record_name: str,
    request: RecordSetCreate | RecordSetUpdate,
    *,
    exclude_id: int | None = None,
) -> str | None:
    if not request.alias:
        return None
    assert request.alias_target_type is not None
    assert request.alias_target is not None
    target_type: AliasTargetType = request.alias_target_type
    target = request.alias_target.lower()
    if target_type != "record":
        if target not in MOCK_ALIAS_TARGETS[target_type]:
            raise ValidationFailedError(
                "One or more fields are invalid.",
                {
                    "fields": [
                        {
                            "loc": ["body", "alias_target"],
                            "msg": "Choose one of the available mocked AWS targets.",
                        }
                    ]
                },
            )
        return target

    target_name = _record_name(target, zone.name)
    if target_name == record_name:
        raise ValidationFailedError(
            "One or more fields are invalid.",
            {
                "fields": [
                    {
                        "loc": ["body", "alias_target"],
                        "msg": "An alias record cannot target itself.",
                    }
                ]
            },
        )
    target_types = record_sets.types_for_name(
        db,
        zone.id,
        target_name,
        exclude_id=exclude_id,
    )
    if request.type not in target_types:
        raise ValidationFailedError(
            "One or more fields are invalid.",
            {
                "fields": [
                    {
                        "loc": ["body", "alias_target"],
                        "msg": f"Choose an existing {request.type} record in this hosted zone.",
                    }
                ]
            },
        )
    return target_name


def _ensure_cname_compatible(
    db: Session,
    zone: HostedZone,
    name: str,
    record_type: EditableRecordType,
    *,
    exclude_id: int | None = None,
) -> None:
    if record_type == "CNAME" and name == zone.name:
        raise ValidationFailedError(
            "One or more fields are invalid.",
            {
                "fields": [
                    {
                        "loc": ["body", "name"],
                        "msg": "A CNAME record cannot be created at the zone apex.",
                    }
                ]
            },
        )

    existing_types = record_sets.types_for_name(
        db,
        zone.id,
        name,
        exclude_id=exclude_id,
    )
    if (record_type == "CNAME" and existing_types - {"CNAME"}) or (
        record_type != "CNAME" and "CNAME" in existing_types
    ):
        raise ConflictError(
            "A CNAME record cannot share its name with another record.",
            {"name": name, "existing_types": sorted(existing_types)},
            code="CnameConflict",
        )


def _protect_default_record(zone: HostedZone, record: RecordSet) -> None:
    if record.name == zone.name and record.type in {"NS", "SOA"}:
        raise ConflictError(
            "The default NS and SOA records cannot be changed or deleted.",
            {"record_set_id": record.id, "type": record.type},
            code="ProtectedRecordSet",
        )


def _ensure_available(
    db: Session,
    zone_id: str,
    name: str,
    record_type: str,
    set_identifier: str,
    *,
    exclude_id: int | None = None,
) -> None:
    if record_sets.exists_by_name_and_type(
        db,
        zone_id,
        name,
        record_type,
        set_identifier,
        exclude_id=exclude_id,
    ):
        raise ConflictError(
            f"A {record_type} record set with this identifier already exists for {name}",
            {
                "name": name,
                "type": record_type,
                "set_identifier": set_identifier or None,
            },
            code="RecordSetAlreadyExists",
        )


def _ensure_policy_compatible(
    db: Session,
    zone_id: str,
    name: str,
    record_type: str,
    routing_policy: str,
    *,
    exclude_id: int | None = None,
) -> None:
    existing = record_sets.policies_for_name_and_type(
        db,
        zone_id,
        name,
        record_type,
        exclude_id=exclude_id,
    )
    if not existing:
        return
    if routing_policy == "simple":
        if existing == {"simple"}:
            return
        raise ConflictError(
            "A simple record cannot share its name and type with another routing policy.",
            {
                "name": name,
                "type": record_type,
                "existing_policies": sorted(existing),
            },
            code="RoutingPolicyConflict",
        )
    if "simple" in existing:
        raise ConflictError(
            "A simple record cannot share its name and type with another routing policy.",
            {
                "name": name,
                "type": record_type,
                "existing_policies": sorted(existing),
            },
            code="RoutingPolicyConflict",
        )
    if existing != {routing_policy}:
        raise ConflictError(
            "Record sets with the same name and type must use one routing policy.",
            {
                "name": name,
                "type": record_type,
                "existing_policies": sorted(existing),
            },
            code="RoutingPolicyConflict",
        )

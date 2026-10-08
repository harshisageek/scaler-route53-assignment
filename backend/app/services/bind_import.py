import re
from dataclasses import dataclass
from typing import Literal, cast

import dns.exception
import dns.name
import dns.rdatatype
import dns.zone
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError, ValidationFailedError
from app.models import HostedZone, RecordSet, User
from app.repositories import hosted_zones, record_sets
from app.schemas.bind_import import (
    BindImportPreview,
    BindImportRecord,
    BindImportResult,
)
from app.schemas.record_set import EditableRecordType
from app.services.record_sets import ensure_record_capacity
from app.services.validation.domain_names import (
    InvalidDomainNameError,
    normalize_record_name,
)
from app.services.validation.record_values import (
    InvalidRecordValueError,
    normalize_record_values,
)

# dnspython expands $GENERATE in full before any record limit can apply.
_GENERATE_DIRECTIVE = re.compile(r"^\s*\$GENERATE\b", re.IGNORECASE | re.MULTILINE)

MAX_BIND_FILE_SIZE = 1024 * 1024
MAX_IMPORT_RECORD_SETS = 1000
SUPPORTED_TYPES = {"A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA"}


@dataclass(frozen=True)
class _ParsedRecord:
    name: str
    type: str
    ttl: int
    values: list[str]


def preview_bind_import(
    db: Session,
    owner: User,
    zone_id: str,
    file_name: str,
    content: bytes,
) -> BindImportPreview:
    zone = _owned_zone(db, owner, zone_id)
    records, _ = _analyze(db, zone, content)
    return BindImportPreview(
        file_name=file_name,
        records=records,
        add_count=sum(record.status == "add" for record in records),
        already_present_count=sum(record.status == "already_present" for record in records),
        unsupported_count=sum(record.status == "unsupported" for record in records),
    )


def apply_bind_import(
    db: Session,
    owner: User,
    zone_id: str,
    content: bytes,
) -> BindImportResult:
    zone = _owned_zone(db, owner, zone_id)
    preview, candidates = _analyze(db, zone, content)
    unsupported = [record for record in preview if record.status == "unsupported"]
    if unsupported:
        raise ValidationFailedError(
            "The BIND file contains unsupported or invalid records.",
            {"unsupported_count": len(unsupported)},
            code="BindImportBlocked",
        )
    additions = [
        RecordSet(
            hosted_zone_id=zone.id,
            name=candidate.name,
            type=candidate.type,
            ttl=candidate.ttl,
            values=candidate.values,
        )
        for candidate in candidates
    ]
    ensure_record_capacity(db, zone, len(additions))
    try:
        record_sets.add_record_sets(db, additions)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(
            "The hosted zone changed after the preview. Preview the file again.",
            code="BindImportConflict",
        ) from exc
    return BindImportResult(
        imported_count=len(additions),
        skipped_count=len(preview) - len(additions),
    )


def _analyze(
    db: Session,
    zone: HostedZone,
    content: bytes,
) -> tuple[list[BindImportRecord], list[_ParsedRecord]]:
    parsed = _parse(content, zone.name)
    existing = {(record.name, record.type) for record in record_sets.all_by_zone(db, zone.id)}
    occupied_types: dict[str, set[str]] = {}
    for name, record_type in existing:
        occupied_types.setdefault(name, set()).add(record_type)

    preview: list[BindImportRecord] = []
    candidates: list[_ParsedRecord] = []
    for record in parsed:
        key = (record.name, record.type)
        if key in existing:
            preview.append(_preview_record(record, "already_present"))
            continue
        if record.type not in SUPPORTED_TYPES:
            preview.append(
                _preview_record(
                    record,
                    "unsupported",
                    f"{record.type} records are not supported for import.",
                )
            )
            continue
        try:
            name = normalize_record_name(record.name, zone.name)
            record_type = cast(EditableRecordType, record.type)
            values = normalize_record_values(record_type, record.values)
            if record_type == "CNAME" and name == zone.name:
                raise InvalidRecordValueError("A CNAME record cannot be created at the zone apex.")
            types = occupied_types.get(name, set())
            if (record_type == "CNAME" and types - {"CNAME"}) or (
                record_type != "CNAME" and "CNAME" in types
            ):
                raise InvalidRecordValueError(
                    "A CNAME record cannot share its name with another record."
                )
        except (InvalidDomainNameError, InvalidRecordValueError) as exc:
            preview.append(_preview_record(record, "unsupported", str(exc)))
            continue

        candidate = _ParsedRecord(
            name=name,
            type=record_type,
            ttl=record.ttl,
            values=values,
        )
        candidates.append(candidate)
        occupied_types.setdefault(name, set()).add(record_type)
        preview.append(_preview_record(candidate, "add"))
    return preview, candidates


def _parse(content: bytes, origin: str) -> list[_ParsedRecord]:
    if len(content) > MAX_BIND_FILE_SIZE:
        raise ValidationFailedError(
            "The BIND file is too large.",
            {"maximum_bytes": MAX_BIND_FILE_SIZE},
            code="BindFileTooLarge",
        )
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValidationFailedError(
            "The BIND file must use UTF-8 text.",
            code="InvalidBindFile",
        ) from exc
    if not text.strip():
        raise ValidationFailedError(
            "The BIND file is empty.",
            code="InvalidBindFile",
        )
    if _GENERATE_DIRECTIVE.search(text):
        raise ValidationFailedError(
            "$GENERATE directives are not supported. List each record explicitly.",
            code="InvalidBindFile",
        )

    origin_name = dns.name.from_text(origin)
    try:
        parsed_zone = dns.zone.from_text(
            text,
            origin=origin_name,
            relativize=False,
            check_origin=False,
            allow_include=False,
        )
    except dns.exception.DNSException as exc:
        raise ValidationFailedError(
            f"The BIND file could not be parsed: {exc}",
            code="InvalidBindFile",
        ) from exc

    records: list[_ParsedRecord] = []
    for name, node in parsed_zone.nodes.items():
        for rdataset in node.rdatasets:
            record_type = dns.rdatatype.to_text(rdataset.rdtype)
            records.append(
                _ParsedRecord(
                    name=name.to_text(),
                    type=record_type,
                    ttl=rdataset.ttl,
                    values=[
                        value.to_text(origin=origin_name, relativize=False) for value in rdataset
                    ],
                )
            )
    if len(records) > MAX_IMPORT_RECORD_SETS:
        raise ValidationFailedError(
            "The BIND file contains too many record sets.",
            {"maximum_record_sets": MAX_IMPORT_RECORD_SETS},
            code="BindFileTooLarge",
        )
    return sorted(records, key=lambda record: (record.name, record.type))


def _preview_record(
    record: _ParsedRecord,
    status: Literal["add", "already_present", "unsupported"],
    reason: str | None = None,
) -> BindImportRecord:
    return BindImportRecord(
        name=record.name,
        type=record.type,
        ttl=record.ttl,
        values=record.values,
        status=status,
        reason=reason,
    )


def _owned_zone(
    db: Session,
    owner: User,
    zone_id: str,
) -> HostedZone:
    zone = hosted_zones.get_hosted_zone(db, owner.id, zone_id)
    if zone is None:
        raise NotFoundError(
            "No hosted zone was found with that ID.",
            code="NoSuchHostedZone",
        )
    return zone

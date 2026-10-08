import json
from dataclasses import dataclass
from typing import Literal

from sqlalchemy.orm import Session

from app.models import User
from app.repositories import record_sets
from app.schemas.record_set import RecordSetOut
from app.services import hosted_zones

ExportFormat = Literal["bind", "json"]


@dataclass(frozen=True)
class ZoneExport:
    content: bytes
    media_type: str
    file_name: str


def export_zone(
    db: Session,
    owner: User,
    zone_id: str,
    export_format: ExportFormat,
) -> ZoneExport:
    zone = hosted_zones.get_hosted_zone(db, owner, zone_id)
    records = record_sets.all_by_zone(db, zone_id)
    base_name = zone.name.removesuffix(".")
    if export_format == "json":
        payload = {
            "version": 1,
            "hosted_zone": zone.model_dump(mode="json"),
            "records": [
                RecordSetOut.model_validate(record).model_dump(mode="json") for record in records
            ],
        }
        return ZoneExport(
            content=(json.dumps(payload, indent=2) + "\n").encode(),
            media_type="application/json",
            file_name=f"{base_name}.json",
        )

    lines = [
        f"$ORIGIN {zone.name}",
        "$TTL 300",
        "",
        "; Exported by the Route 53 clone.",
        "; Alias and routing-policy metadata is preserved as comments because",
        "; standard BIND zone files do not represent those Route 53 features.",
        "",
    ]
    for record in records:
        if record.alias:
            lines.append(
                f"; {record.name} {record.type} ALIAS {record.alias_target} "
                f"evaluate-target-health={'yes' if record.evaluate_target_health else 'no'}"
            )
            continue
        if record.routing_policy != "simple":
            metadata = f"routing-policy={record.routing_policy}"
            if record.set_identifier:
                metadata += f" set-identifier={record.set_identifier}"
            lines.append(f"; {metadata}")
        assert record.ttl is not None
        lines.extend(
            f"{record.name} {record.ttl} IN {record.type} {value}" for value in record.values
        )
    return ZoneExport(
        content=("\n".join(lines) + "\n").encode(),
        media_type="text/dns",
        file_name=f"{base_name}.zone",
    )

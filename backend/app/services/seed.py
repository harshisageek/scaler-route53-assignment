"""Sample data, so a fresh deployment opens on something other than an empty table."""

from typing import TypedDict

from sqlalchemy.orm import Session

from app.models import HostedZone
from app.repositories import hosted_zones as repository
from app.services.ids import new_hosted_zone_id


class SampleZone(TypedDict):
    name: str
    comment: str
    private_zone: bool


SAMPLE_ZONES: list[SampleZone] = [
    {"name": "example.com.", "comment": "Sample public hosted zone", "private_zone": False},
]


def seed_demo_data(db: Session) -> int:
    """Insert the sample zones into an empty database. Returns how many were added."""
    if repository.count_hosted_zones(db) > 0:
        return 0

    for zone in SAMPLE_ZONES:
        repository.add_hosted_zone(db, HostedZone(id=new_hosted_zone_id(), **zone))
    return len(SAMPLE_ZONES)

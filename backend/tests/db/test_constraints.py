"""The database rejects bad data on its own, even if a bug slips past the API."""

import pytest
from app.models import HostedZone
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


@pytest.mark.parametrize("name", ["Example.com.", "example.com"])
def test_zone_names_must_be_lower_case_and_fully_qualified(db_session: Session, name: str) -> None:
    db_session.add(HostedZone(id="ZAAAAAAAAAAAAAAAAAAAA", name=name))

    with pytest.raises(IntegrityError):
        db_session.commit()


def test_zone_comments_are_capped_at_256_characters(db_session: Session) -> None:
    db_session.add(HostedZone(id="ZAAAAAAAAAAAAAAAAAAAA", name="example.com.", comment="x" * 257))

    with pytest.raises(IntegrityError):
        db_session.commit()

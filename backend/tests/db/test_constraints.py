"""The database rejects bad data on its own, even if a bug slips past the API."""

import pytest
from app.models import HostedZone, User
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


@pytest.fixture
def owner(db_session: Session) -> User:
    user = User(email="owner@example.com", password_hash="x", account_id="123456789012")
    db_session.add(user)
    db_session.commit()
    return user


@pytest.mark.parametrize("name", ["Example.com.", "example.com"])
def test_zone_names_must_be_lower_case_and_fully_qualified(
    db_session: Session, owner: User, name: str
) -> None:
    db_session.add(HostedZone(id="ZAAAAAAAAAAAAAAAAAAAA", owner_id=owner.id, name=name))

    with pytest.raises(IntegrityError):
        db_session.commit()


def test_zone_comments_are_capped_at_256_characters(db_session: Session, owner: User) -> None:
    db_session.add(
        HostedZone(id="ZAAAAAAAAAAAAAAAAAAAA", owner_id=owner.id, name="a.", comment="x" * 257)
    )

    with pytest.raises(IntegrityError):
        db_session.commit()


def test_a_zone_cannot_point_at_a_user_that_does_not_exist(db_session: Session) -> None:
    # Fails only because PRAGMA foreign_keys is switched on for every connection.
    db_session.add(HostedZone(id="ZAAAAAAAAAAAAAAAAAAAA", owner_id=999, name="a."))

    with pytest.raises(IntegrityError):
        db_session.commit()


def test_deleting_a_user_deletes_their_zones(db_session: Session, owner: User) -> None:
    db_session.add(HostedZone(id="ZAAAAAAAAAAAAAAAAAAAA", owner_id=owner.id, name="a."))
    db_session.commit()

    db_session.delete(owner)
    db_session.commit()

    assert db_session.scalars(select(HostedZone)).all() == []


def test_two_accounts_cannot_share_an_email(db_session: Session, owner: User) -> None:
    db_session.add(User(email=owner.email, password_hash="x", account_id="999999999999"))

    with pytest.raises(IntegrityError):
        db_session.commit()

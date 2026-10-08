from app.core.config import Settings
from app.main import create_app
from app.models import HostedZone, User
from app.services.demo import SAMPLE_ZONES
from fastapi.testclient import TestClient
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session


def test_startup_creates_the_demo_account_with_sample_zones(
    settings: Settings, db_engine: Engine, db_session: Session
) -> None:
    with TestClient(create_app(settings.model_copy(update={"seed_demo_data": True}))):
        pass

    db_session.expire_all()
    user = db_session.scalars(select(User)).one()
    assert user.is_demo and user.email == settings.demo_user_email
    zones = db_session.scalars(select(HostedZone).where(HostedZone.owner_id == user.id)).all()
    assert len(zones) == len(SAMPLE_ZONES)


def test_restarting_does_not_duplicate_the_demo_data(
    settings: Settings, db_engine: Engine, db_session: Session
) -> None:
    seeded = settings.model_copy(update={"seed_demo_data": True})
    for _ in range(2):
        with TestClient(create_app(seeded)):
            pass

    db_session.expire_all()
    assert len(db_session.scalars(select(User)).all()) == 1
    assert len(db_session.scalars(select(HostedZone)).all()) == len(SAMPLE_ZONES)


def test_startup_adds_nothing_when_seeding_is_off(
    settings: Settings, db_engine: Engine, db_session: Session
) -> None:
    with TestClient(create_app(settings)):
        pass

    assert db_session.scalars(select(User)).all() == []

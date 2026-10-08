from app.core.config import Settings
from app.main import create_app
from app.models import HostedZone
from fastapi.testclient import TestClient
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session


def zone_names(db: Session) -> list[str]:
    db.expire_all()
    return list(db.scalars(select(HostedZone.name)).all())


def test_startup_seeds_the_sample_zones_when_enabled(
    settings: Settings, db_engine: Engine, db_session: Session
) -> None:
    with TestClient(create_app(settings.model_copy(update={"seed_demo_data": True}))):
        pass

    assert zone_names(db_session) == ["example.com."]


def test_startup_adds_nothing_when_seeding_is_off(
    settings: Settings, db_engine: Engine, db_session: Session
) -> None:
    with TestClient(create_app(settings)):
        pass

    assert zone_names(db_session) == []

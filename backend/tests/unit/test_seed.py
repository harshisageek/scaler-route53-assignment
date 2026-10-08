from app.models import HostedZone
from app.services.seed import SAMPLE_ZONES, seed_demo_data
from sqlalchemy import select
from sqlalchemy.orm import Session


def test_seed_fills_an_empty_database(db_session: Session) -> None:
    added = seed_demo_data(db_session)
    db_session.commit()

    names = db_session.scalars(select(HostedZone.name)).all()
    assert added == len(SAMPLE_ZONES)
    assert sorted(names) == sorted(zone["name"] for zone in SAMPLE_ZONES)


def test_seed_leaves_existing_data_alone(db_session: Session) -> None:
    seed_demo_data(db_session)
    db_session.commit()

    assert seed_demo_data(db_session) == 0
    assert len(db_session.scalars(select(HostedZone)).all()) == len(SAMPLE_ZONES)

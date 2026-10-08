from datetime import timedelta

from app.core.config import Settings
from app.db.base import utcnow
from app.models import HostedZone, User
from app.services.demo import SAMPLE_ZONES
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

SAMPLE_NAMES = sorted(zone["name"] for zone in SAMPLE_ZONES)


def zone_names(client: TestClient) -> list[str]:
    return sorted(zone["name"] for zone in client.get("/api/v1/hosted-zones").json()["items"])


def demo_user(db: Session) -> User:
    db.expire_all()
    return db.scalars(select(User).where(User.is_demo)).one()


def test_demo_sign_in_opens_the_sample_account(client: TestClient) -> None:
    response = client.post("/api/v1/auth/demo")

    assert response.status_code == 200
    assert response.json()["is_demo"] is True
    assert zone_names(client) == SAMPLE_NAMES


def test_the_demo_account_also_accepts_its_published_password(
    client: TestClient, settings: Settings
) -> None:
    client.post("/api/v1/auth/demo")
    client.cookies.clear()

    response = client.post(
        "/api/v1/auth/sign-in",
        json={"email": settings.demo_user_email, "password": settings.demo_user_password},
    )

    assert response.status_code == 200


def test_recent_demo_edits_survive_the_next_demo_sign_in(
    client: TestClient, db_session: Session
) -> None:
    client.post("/api/v1/auth/demo")
    db_session.add(
        HostedZone(id="ZVISITORXXXXXXXXXXXXX", owner_id=demo_user(db_session).id, name="mine.")
    )
    db_session.commit()

    client.post("/api/v1/auth/demo")

    assert "mine." in zone_names(client)


def test_stale_demo_data_is_reset_to_the_samples(
    client: TestClient, db_session: Session, settings: Settings
) -> None:
    client.post("/api/v1/auth/demo")
    user = demo_user(db_session)
    db_session.add(HostedZone(id="ZVISITORXXXXXXXXXXXXX", owner_id=user.id, name="mine."))
    user.demo_data_reset_at = utcnow() - timedelta(hours=settings.demo_reset_interval_hours + 1)
    db_session.commit()

    client.post("/api/v1/auth/demo")

    assert zone_names(client) == SAMPLE_NAMES


def test_demo_resets_never_touch_other_accounts(
    alice: TestClient, client: TestClient, db_session: Session, settings: Settings
) -> None:
    alice_id = db_session.scalars(select(User.id).where(User.email == "alice@example.com")).one()
    db_session.add(HostedZone(id="ZALICEXXXXXXXXXXXXXXX", owner_id=alice_id, name="alice."))
    db_session.commit()

    client.post("/api/v1/auth/demo")
    demo_user(db_session).demo_data_reset_at = utcnow() - timedelta(days=30)
    db_session.commit()
    client.post("/api/v1/auth/demo")

    assert zone_names(alice) == ["alice."]

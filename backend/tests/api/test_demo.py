from datetime import timedelta

from app.core.config import Settings
from app.db.base import utcnow
from app.models import HostedZone, User, UserSession
from app.services.demo import SAMPLE_ZONES, VISITOR_EMAIL_DOMAIN, ensure_demo_account
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from tests.api.test_auth import _app_with

SAMPLE_NAMES = sorted(zone.name for zone in SAMPLE_ZONES)


def zone_names(client: TestClient) -> list[str]:
    return sorted(zone["name"] for zone in client.get("/api/v1/hosted-zones").json()["items"])


def visitors(db: Session) -> list[User]:
    db.expire_all()
    return list(db.scalars(select(User).where(User.email.endswith(VISITOR_EMAIL_DOMAIN))).all())


def shared_demo_sign_in(client: TestClient, settings: Settings) -> int:
    response = client.post(
        "/api/v1/auth/sign-in",
        json={"email": settings.demo_user_email, "password": settings.demo_user_password},
    )
    return response.status_code


# --- Private visitor accounts ------------------------------------------------


def test_demo_sign_in_opens_a_private_copy_of_the_samples(client: TestClient) -> None:
    response = client.post("/api/v1/auth/demo")

    assert response.status_code == 200
    assert response.json()["is_demo"] is True
    assert response.json()["email"].endswith(f"@{VISITOR_EMAIL_DOMAIN}")
    assert zone_names(client) == SAMPLE_NAMES


def test_each_visitor_gets_an_isolated_account(app: FastAPI) -> None:
    with TestClient(app) as first, TestClient(app) as second:
        first.post("/api/v1/auth/demo")
        created = first.post("/api/v1/hosted-zones", json={"name": "mine.example"})
        assert created.status_code == 201, created.text

        second.post("/api/v1/auth/demo")

        assert "mine.example." in zone_names(first)
        assert zone_names(second) == SAMPLE_NAMES
        assert (
            first.get("/api/v1/auth/me").json()["account_id"]
            != (second.get("/api/v1/auth/me").json()["account_id"])
        )


def test_visitor_accounts_cannot_be_signed_into_by_password(
    client: TestClient, db_session: Session
) -> None:
    client.post("/api/v1/auth/demo")
    client.cookies.clear()
    (visitor,) = visitors(db_session)

    response = client.post("/api/v1/auth/sign-in", json={"email": visitor.email, "password": "!"})

    assert response.status_code == 401


def test_abandoned_visitors_are_deleted_and_active_ones_kept(
    client: TestClient, db_session: Session
) -> None:
    client.post("/api/v1/auth/demo")
    client.post("/api/v1/auth/demo")
    abandoned, active = visitors(db_session)
    long_ago = utcnow() - timedelta(days=2)
    abandoned.created_at = active.created_at = long_ago
    for session in db_session.scalars(
        select(UserSession).where(UserSession.user_id == abandoned.id)
    ):
        session.expires_at = long_ago
    db_session.commit()
    abandoned_id, active_id = abandoned.id, active.id

    client.post("/api/v1/auth/demo")

    remaining = {user.id for user in visitors(db_session)}
    assert abandoned_id not in remaining
    assert active_id in remaining
    assert (
        db_session.scalars(select(HostedZone).where(HostedZone.owner_id == abandoned_id)).all()
        == []
    )


def test_demo_creation_is_rate_limited(settings: Settings, db_session: Session) -> None:
    app = _app_with(settings, db_session, demo_rate_limit="2/minute")
    with TestClient(app) as client:
        assert client.post("/api/v1/auth/demo").status_code == 200
        assert client.post("/api/v1/auth/demo").status_code == 200
        response = client.post("/api/v1/auth/demo")

    assert response.status_code == 429
    assert response.json()["error"]["details"]["retry_after_seconds"] > 0


# --- Shared local-development account ----------------------------------------


def test_the_shared_account_accepts_its_published_password(
    client: TestClient, db_session: Session, settings: Settings
) -> None:
    ensure_demo_account(db_session, settings)

    assert shared_demo_sign_in(client, settings) == 200
    assert zone_names(client) == SAMPLE_NAMES


def test_recent_shared_demo_edits_survive_the_next_sign_in(
    client: TestClient, db_session: Session, settings: Settings
) -> None:
    user = ensure_demo_account(db_session, settings)
    db_session.add(HostedZone(id="ZVISITORXXXXXXXXXXXXX", owner_id=user.id, name="mine."))
    db_session.commit()

    shared_demo_sign_in(client, settings)

    assert "mine." in zone_names(client)


def test_stale_shared_demo_data_is_reset_to_the_samples(
    client: TestClient, db_session: Session, settings: Settings
) -> None:
    user = ensure_demo_account(db_session, settings)
    db_session.add(HostedZone(id="ZVISITORXXXXXXXXXXXXX", owner_id=user.id, name="mine."))
    user.demo_data_reset_at = utcnow() - timedelta(hours=settings.demo_reset_interval_hours + 1)
    db_session.commit()

    shared_demo_sign_in(client, settings)

    assert zone_names(client) == SAMPLE_NAMES


def test_demo_resets_never_touch_other_accounts(
    alice: TestClient, client: TestClient, db_session: Session, settings: Settings
) -> None:
    alice_id = db_session.scalars(select(User.id).where(User.email == "alice@example.com")).one()
    db_session.add(HostedZone(id="ZALICEXXXXXXXXXXXXXXX", owner_id=alice_id, name="alice."))
    user = ensure_demo_account(db_session, settings)
    user.demo_data_reset_at = utcnow() - timedelta(days=30)
    db_session.commit()

    shared_demo_sign_in(client, settings)
    client.post("/api/v1/auth/demo")

    assert zone_names(alice) == ["alice."]

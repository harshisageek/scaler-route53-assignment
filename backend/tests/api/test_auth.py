from collections.abc import Callable
from datetime import timedelta

import pytest
from app.core.config import Settings, get_settings
from app.core.security import hash_session_token
from app.db.base import utcnow
from app.db.session import get_db
from app.main import create_app
from app.models import User, UserSession
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from tests.conftest import PASSWORD, sign_up

COOKIE = "r53_session"


def session_rows(db: Session) -> list[UserSession]:
    db.expire_all()
    return list(db.scalars(select(UserSession)).all())


def sign_in(client: TestClient, email: str, password: str = PASSWORD) -> int:
    response = client.post("/api/v1/auth/sign-in", json={"email": email, "password": password})
    return response.status_code


# --- Sign-up -----------------------------------------------------------------


def test_sign_up_creates_the_account_and_signs_in(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/sign-up", json={"email": "Alice@Example.com", "password": PASSWORD}
    )

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "alice@example.com"
    assert len(body["account_id"]) == 12 and body["account_id"].isdigit()
    assert body["is_demo"] is False
    assert client.get("/api/v1/auth/me").json()["email"] == "alice@example.com"


def test_the_session_cookie_is_http_only_and_same_site(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/sign-up", json={"email": "alice@example.com", "password": PASSWORD}
    )

    cookie = response.headers["set-cookie"].lower()
    assert cookie.startswith(f"{COOKIE}=")
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert "path=/" in cookie


def test_passwords_and_session_tokens_are_never_stored_in_plain_text(
    alice: TestClient, db_session: Session
) -> None:
    user = db_session.scalars(select(User)).one()
    token = alice.cookies[COOKIE]

    assert user.password_hash.startswith("$argon2id$")
    assert PASSWORD not in user.password_hash
    assert [row.token_hash for row in session_rows(db_session)] == [hash_session_token(token)]
    assert token != hash_session_token(token)


def test_an_email_can_only_register_once_whatever_its_case(
    alice: TestClient, client: TestClient
) -> None:
    response = client.post(
        "/api/v1/auth/sign-up", json={"email": "ALICE@example.com", "password": PASSWORD}
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "EmailAlreadyRegistered"


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "not-an-email", "password": PASSWORD},
        {"email": "alice@example.com", "password": "short"},
        {"email": "alice@example.com"},
    ],
)
def test_sign_up_rejects_malformed_input(client: TestClient, payload: dict[str, str]) -> None:
    response = client.post("/api/v1/auth/sign-up", json=payload)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "ValidationFailed"


# --- Sign-in -----------------------------------------------------------------


def test_sign_in_with_the_right_password(alice: TestClient, client: TestClient) -> None:
    assert sign_in(client, "alice@example.com") == 200
    assert client.get("/api/v1/auth/me").status_code == 200


@pytest.mark.parametrize(
    ("email", "password"),
    [("alice@example.com", "wrong password"), ("nobody@example.com", PASSWORD)],
)
def test_a_bad_password_and_an_unknown_email_look_the_same(
    alice: TestClient, client: TestClient, email: str, password: str
) -> None:
    response = client.post("/api/v1/auth/sign-in", json={"email": email, "password": password})

    assert response.status_code == 401
    assert response.json()["error"] == {
        "code": "InvalidCredentials",
        "message": "Incorrect email or password.",
        "details": {},
    }
    assert COOKIE not in client.cookies


def test_repeated_failures_are_throttled_even_with_the_right_password(
    settings: Settings, db_session: Session
) -> None:
    app = _app_with(settings, db_session, login_rate_limit="2/minute")
    with TestClient(app) as client:
        sign_up(client, "alice@example.com")
        client.cookies.clear()

        assert sign_in(client, "alice@example.com", "wrong one") == 401
        assert sign_in(client, "alice@example.com", "wrong two") == 401
        response = client.post(
            "/api/v1/auth/sign-in", json={"email": "alice@example.com", "password": PASSWORD}
        )

    assert response.status_code == 429
    assert response.json()["error"]["details"]["retry_after_seconds"] > 0


# --- Sessions ----------------------------------------------------------------


def test_me_requires_a_session(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "NotAuthenticated"


def test_an_expired_session_is_rejected(alice: TestClient, db_session: Session) -> None:
    for row in session_rows(db_session):
        row.expires_at = utcnow() - timedelta(seconds=1)
    db_session.commit()

    assert alice.get("/api/v1/auth/me").status_code == 401


def test_an_active_session_is_renewed_before_it_runs_out(
    alice: TestClient, db_session: Session, settings: Settings
) -> None:
    (row,) = session_rows(db_session)
    row.expires_at = utcnow() + timedelta(minutes=5)
    db_session.commit()

    response = alice.get("/api/v1/auth/me")

    assert response.status_code == 200
    assert f"{COOKIE}=" in response.headers["set-cookie"]
    (row,) = session_rows(db_session)
    assert row.expires_at > utcnow() + timedelta(hours=settings.session_ttl_hours - 1)


def test_a_fresh_session_is_not_rewritten_on_every_request(alice: TestClient) -> None:
    assert "set-cookie" not in alice.get("/api/v1/auth/me").headers


def test_sign_out_ends_the_session(alice: TestClient, db_session: Session) -> None:
    response = alice.post("/api/v1/auth/sign-out")

    assert response.status_code == 204
    assert session_rows(db_session) == []
    assert alice.get("/api/v1/auth/me").status_code == 401


def test_a_stolen_token_stops_working_after_sign_out(
    alice: TestClient, make_client: Callable[[], TestClient]
) -> None:
    thief = make_client()
    thief.cookies.set(COOKIE, alice.cookies[COOKIE])

    alice.post("/api/v1/auth/sign-out")

    assert thief.get("/api/v1/auth/me").status_code == 401


def _app_with(settings: Settings, db_session: Session, **overrides: object) -> FastAPI:
    custom = settings.model_copy(update=overrides)
    app = create_app(custom)
    app.dependency_overrides[get_settings] = lambda: custom
    app.dependency_overrides[get_db] = lambda: db_session
    return app

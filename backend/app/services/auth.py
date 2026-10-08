"""Accounts and sessions.

A session lasts SESSION_TTL_HOURS from its last renewal. It is renewed once
less than half of that remains, so an active user stays signed in while an idle
session expires, without a database write on every request.
"""

from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import ConflictError, TooManyRequestsError, UnauthorizedError
from app.core.security import (
    hash_password,
    hash_session_token,
    new_session_token,
    password_needs_rehash,
    verify_password,
)
from app.db.base import utcnow
from app.models import User, UserSession
from app.repositories import users as repository
from app.services import demo
from app.services.ids import new_account_id
from app.services.login_throttle import LoginThrottle


@dataclass(frozen=True)
class ActiveSession:
    user: User
    # The browser cookie must be re-sent with a new expiry when this is true.
    renewed: bool


def sign_up(db: Session, email: str, password: str) -> User:
    if repository.get_user_by_email(db, email) is not None:
        raise ConflictError(
            "An account with this email already exists.", code="EmailAlreadyRegistered"
        )
    user = repository.add_user(
        db,
        User(email=email, password_hash=hash_password(password), account_id=new_account_id(db)),
    )
    db.commit()
    return user


def sign_in(
    db: Session, settings: Settings, throttle: LoginThrottle, email: str, password: str
) -> User:
    if retry_after := throttle.retry_after(email):
        raise TooManyRequestsError(
            "Too many failed sign-in attempts. Try again shortly.",
            {"retry_after_seconds": retry_after},
        )

    user = repository.get_user_by_email(db, email)
    if not verify_password(user.password_hash if user else None, password) or user is None:
        throttle.record_failure(email)
        raise UnauthorizedError("Incorrect email or password.", code="InvalidCredentials")

    throttle.reset(email)
    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
    if user.is_demo:
        demo.reset_if_stale(db, settings, user)
    db.commit()
    return user


def create_session(db: Session, settings: Settings, user: User) -> str:
    """Start a session and return the token for the cookie. Only its hash is stored."""
    now = utcnow()
    repository.delete_expired_sessions(db, user.id, now)
    token = new_session_token()
    repository.add_session(
        db,
        UserSession(
            user_id=user.id,
            token_hash=hash_session_token(token),
            created_at=now,
            expires_at=now + _ttl(settings),
        ),
    )
    db.commit()
    return token


def resolve_session(db: Session, settings: Settings, token: str) -> ActiveSession | None:
    session = repository.get_session_by_token_hash(db, hash_session_token(token))
    now = utcnow()
    if session is None or session.expires_at <= now:
        return None

    user = repository.get_user(db, session.user_id)
    if user is None:
        return None

    renewed = session.expires_at - now < _ttl(settings) / 2
    if renewed:
        session.expires_at = now + _ttl(settings)
        db.commit()
    return ActiveSession(user=user, renewed=renewed)


def sign_out(db: Session, token: str) -> None:
    repository.delete_session(db, hash_session_token(token))
    db.commit()


def _ttl(settings: Settings) -> timedelta:
    return timedelta(hours=settings.session_ttl_hours)

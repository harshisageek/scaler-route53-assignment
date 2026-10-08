"""Database access for users and their sessions."""

from datetime import datetime

from sqlalchemy import delete, exists, select
from sqlalchemy.orm import Session

from app.models import User, UserSession


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email))


def account_id_taken(db: Session, account_id: str) -> bool:
    return bool(db.scalar(select(exists().where(User.account_id == account_id))))


def add_user(db: Session, user: User) -> User:
    db.add(user)
    db.flush()
    return user


def add_session(db: Session, session: UserSession) -> UserSession:
    db.add(session)
    db.flush()
    return session


def get_session_by_token_hash(db: Session, token_hash: str) -> UserSession | None:
    return db.scalar(select(UserSession).where(UserSession.token_hash == token_hash))


def get_user(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def delete_session(db: Session, token_hash: str) -> None:
    db.execute(delete(UserSession).where(UserSession.token_hash == token_hash))


def delete_abandoned_visitors(
    db: Session, email_domain: str, now: datetime, created_before: datetime
) -> None:
    """Delete demo visitor accounts with no live session. Zones and records cascade."""
    live_session = exists().where(UserSession.user_id == User.id, UserSession.expires_at > now)
    db.execute(
        delete(User).where(
            User.is_demo.is_(True),
            User.email.endswith(f"@{email_domain}"),
            User.created_at < created_before,
            ~live_session,
        )
    )


def delete_expired_sessions(db: Session, user_id: int, now: datetime) -> None:
    db.execute(
        delete(UserSession).where(UserSession.user_id == user_id, UserSession.expires_at <= now)
    )

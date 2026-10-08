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


def delete_expired_sessions(db: Session, user_id: int, now: datetime) -> None:
    db.execute(
        delete(UserSession).where(UserSession.user_id == user_id, UserSession.expires_at <= now)
    )

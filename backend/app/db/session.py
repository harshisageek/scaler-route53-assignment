"""Database engine and per-request sessions.

Two SQLite-specific settings matter here:

* ``PRAGMA foreign_keys = ON`` - SQLite ignores foreign keys unless each
  connection switches them on.
* ``PRAGMA journal_mode = WAL`` - write-ahead logging lets reads continue
  during a write, and is what Litestream replicates in production.
"""

from collections.abc import Generator, Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings, get_settings


def _ensure_sqlite_directory(database_url: str) -> None:
    prefix = "sqlite:///"
    if not database_url.startswith(prefix):
        return
    path = database_url[len(prefix) :]
    if path and path != ":memory:":
        Path(path).parent.mkdir(parents=True, exist_ok=True)


def create_db_engine(settings: Settings) -> Engine:
    _ensure_sqlite_directory(settings.database_url)
    engine = create_engine(
        settings.database_url,
        # FastAPI serves requests from a threadpool, so a connection may be
        # handed to a different thread than the one that opened it.
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
    )

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection: Any, _: Any) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys = ON")
        cursor.execute("PRAGMA journal_mode = WAL")
        cursor.execute("PRAGMA busy_timeout = 5000")
        cursor.close()

    return engine


engine = create_db_engine(get_settings())
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session]:
    """FastAPI dependency: one session per request, always closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def session_scope() -> Iterator[Session]:
    """A transactional session for startup tasks and scripts."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

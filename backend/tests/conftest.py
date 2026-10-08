"""Shared test fixtures.

Each test gets a throwaway SQLite file, so a test never sees state left
behind by another one.
"""

from collections.abc import Callable, Generator
from pathlib import Path

import pytest
from app.core.config import Settings, get_settings
from app.db.base import Base
from app.db.session import create_db_engine, get_db
from app.main import create_app
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.orm import Session, sessionmaker


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        app_env="test",
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        seed_demo_data=False,
        session_cookie_secure=False,
    )


@pytest.fixture
def db_engine(settings: Settings) -> Generator[Engine]:
    engine = create_db_engine(settings)
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def db_session(db_engine: Engine) -> Generator[Session]:
    factory = sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False)
    session = factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def app(settings: Settings, db_session: Session) -> Generator[FastAPI]:
    application = create_app(settings)
    application.dependency_overrides[get_settings] = lambda: settings
    application.dependency_overrides[get_db] = lambda: db_session
    yield application
    application.dependency_overrides.clear()


@pytest.fixture
def client(app: FastAPI) -> Generator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


PASSWORD = "correct horse battery staple"


@pytest.fixture
def make_client(app: FastAPI) -> Generator[Callable[[], TestClient]]:
    """Build extra clients, each with its own cookie jar: one per simulated user."""
    clients: list[TestClient] = []

    def build() -> TestClient:
        clients.append(TestClient(app))
        return clients[-1]

    yield build
    for test_client in clients:
        test_client.close()


def sign_up(client: TestClient, email: str, password: str = PASSWORD) -> TestClient:
    response = client.post("/api/v1/auth/sign-up", json={"email": email, "password": password})
    assert response.status_code == 201, response.text
    return client


@pytest.fixture
def alice(make_client: Callable[[], TestClient]) -> TestClient:
    return sign_up(make_client(), "alice@example.com")


@pytest.fixture
def bob(make_client: Callable[[], TestClient]) -> TestClient:
    return sign_up(make_client(), "bob@example.com")

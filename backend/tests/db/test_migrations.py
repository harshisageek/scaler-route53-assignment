"""The migrations, not the models, are what build the production database.

These tests make sure the two never drift apart.
"""

from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from app.core.config import Settings
from app.db.base import Base
from app.db.session import create_db_engine
from sqlalchemy import inspect

BACKEND_DIR = Path(__file__).resolve().parents[2]


@pytest.fixture
def alembic_config(settings: Settings) -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    config.set_main_option("sqlalchemy.url", settings.database_url)
    return config


def test_migrations_build_exactly_the_schema_the_models_describe(
    alembic_config: Config, settings: Settings
) -> None:
    command.upgrade(alembic_config, "head")

    engine = create_db_engine(settings)
    try:
        with engine.connect() as connection:
            context = MigrationContext.configure(connection, opts={"compare_type": True})
            assert compare_metadata(context, Base.metadata) == []
    finally:
        engine.dispose()


def test_every_migration_can_be_rolled_back(alembic_config: Config, settings: Settings) -> None:
    command.upgrade(alembic_config, "head")
    command.downgrade(alembic_config, "base")

    engine = create_db_engine(settings)
    try:
        assert inspect(engine).get_table_names() == ["alembic_version"]
    finally:
        engine.dispose()

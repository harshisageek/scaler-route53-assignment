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
from app.models import HostedZone, RecordSet
from app.services.name_servers import PRIVATE_NAME_SERVERS
from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session

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


def test_zones_created_before_record_sets_get_their_default_records(
    alembic_config: Config, settings: Settings
) -> None:
    command.upgrade(alembic_config, "0002")
    engine = create_db_engine(settings)
    stamp = "2026-10-01 12:00:00.000000"
    try:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO users (id, email, password_hash, account_id, is_demo,"
                    " created_at, updated_at) VALUES (1, 'a@example.com', 'x', '123456789012',"
                    " 0, :now, :now)"
                ),
                {"now": stamp},
            )
            for zone_id, name, is_private in [("ZPUB", "pub.example.", 0), ("ZPRIV", "priv.", 1)]:
                connection.execute(
                    text(
                        "INSERT INTO hosted_zones (id, owner_id, name, private_zone, created_at,"
                        " updated_at) VALUES (:id, 1, :name, :private, :now, :now)"
                    ),
                    {"id": zone_id, "name": name, "private": is_private, "now": stamp},
                )

        command.upgrade(alembic_config, "head")

        with Session(engine) as db:
            public, private = db.get(HostedZone, "ZPUB"), db.get(HostedZone, "ZPRIV")
            assert public and private
            assert len(public.name_servers) == 4 and public.vpc_id is None
            assert private.name_servers == PRIVATE_NAME_SERVERS and private.vpc_id
            records = db.scalars(select(RecordSet).order_by(RecordSet.hosted_zone_id)).all()
            assert sorted((r.hosted_zone_id, r.type) for r in records) == [
                ("ZPRIV", "NS"),
                ("ZPRIV", "SOA"),
                ("ZPUB", "NS"),
                ("ZPUB", "SOA"),
            ]
            ns = next(r for r in records if r.hosted_zone_id == "ZPUB" and r.type == "NS")
            assert ns.values == public.name_servers and ns.name == "pub.example."
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

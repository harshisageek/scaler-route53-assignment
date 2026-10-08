"""Alembic environment.

The database URL comes from application settings rather than alembic.ini, so
migrations always target the same database the app uses. A caller can still
pass ``sqlalchemy.url`` explicitly, which is how the migration tests point
Alembic at a throwaway database.
"""

from logging.config import fileConfig

import app.models  # noqa: F401  (registers every table on Base.metadata)
from alembic import context
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import create_db_engine

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata
settings = get_settings()
database_url = config.get_main_option("sqlalchemy.url") or settings.database_url


def run_migrations_offline() -> None:
    context.configure(
        url=database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # SQLite cannot ALTER most things in place; batch mode rebuilds the
        # table behind the scenes instead.
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_db_engine(settings.model_copy(update={"database_url": database_url}))

    try:
        with connectable.connect() as connection:
            context.configure(
                connection=connection,
                target_metadata=target_metadata,
                render_as_batch=True,
                compare_type=True,
            )
            with context.begin_transaction():
                context.run_migrations()
    finally:
        connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

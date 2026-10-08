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
from sqlalchemy import Connection

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
            sqlite = connection.dialect.name == "sqlite"
            if sqlite:
                # Batch mode rebuilds a table by copy, drop and rename. With
                # foreign keys on, the drop cascades and deletes every child
                # row. The pragma is ignored inside a transaction, so it is set
                # and committed before any migration runs.
                connection.exec_driver_sql("PRAGMA foreign_keys = OFF")
                connection.commit()
            context.configure(
                connection=connection,
                target_metadata=target_metadata,
                render_as_batch=True,
                compare_type=True,
            )
            with context.begin_transaction():
                context.run_migrations()
                if sqlite:
                    _fail_on_broken_foreign_keys(connection)
    finally:
        connectable.dispose()


def _fail_on_broken_foreign_keys(connection: Connection) -> None:
    """Stop startup if a migration left a row pointing at nothing.

    Alembic commits each SQLite migration on its own, so this cannot undo the
    damage, but it keeps the app from serving a database that lost integrity.
    """
    violations = connection.exec_driver_sql("PRAGMA foreign_key_check").all()
    if violations:
        raise RuntimeError(f"migration left broken foreign keys: {violations[:5]}")


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

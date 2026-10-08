"""add users and sessions

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-08 00:40:00

Every hosted zone now belongs to a user. Before this revision the only zones
were the startup seed data, which has no owner; they are removed here, and the
startup seed recreates them for the demo account.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("account_id", sa.String(length=12), nullable=False),
        sa.Column("is_demo", sa.Boolean(), nullable=False),
        sa.Column("demo_data_reset_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("account_id", name=op.f("uq_users_account_id")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
    )
    op.create_table(
        "sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_sessions_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sessions")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_sessions_token_hash")),
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])

    op.execute("DELETE FROM hosted_zones")
    with op.batch_alter_table("hosted_zones") as batch_op:
        batch_op.add_column(sa.Column("owner_id", sa.Integer(), nullable=False))
        batch_op.drop_index("ix_hosted_zones_name")
        batch_op.create_index("ix_hosted_zones_owner_id_name", ["owner_id", "name"])
        batch_op.create_foreign_key(
            "fk_hosted_zones_owner_id_users",
            "users",
            ["owner_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    with op.batch_alter_table("hosted_zones") as batch_op:
        batch_op.drop_constraint("fk_hosted_zones_owner_id_users", type_="foreignkey")
        batch_op.drop_index("ix_hosted_zones_owner_id_name")
        batch_op.create_index("ix_hosted_zones_name", ["name"])
        batch_op.drop_column("owner_id")

    op.drop_index("ix_sessions_user_id", table_name="sessions")
    op.drop_table("sessions")
    op.drop_table("users")

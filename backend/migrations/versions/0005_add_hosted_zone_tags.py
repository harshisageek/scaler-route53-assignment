"""add hosted zone tags

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-08 16:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "hosted_zone_tags",
        sa.Column("hosted_zone_id", sa.String(length=32), nullable=False),
        sa.Column("key", sa.String(length=128), nullable=False),
        sa.Column("value", sa.String(length=256), nullable=False),
        sa.CheckConstraint("length(key) >= 1", name="tag_key_not_empty"),
        sa.CheckConstraint("length(key) <= 128", name="tag_key_length"),
        sa.CheckConstraint("length(value) <= 256", name="tag_value_length"),
        sa.ForeignKeyConstraint(
            ["hosted_zone_id"],
            ["hosted_zones.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("hosted_zone_id", "key"),
    )
    op.create_index(
        "ix_hosted_zone_tags_key_value",
        "hosted_zone_tags",
        ["key", "value"],
    )


def downgrade() -> None:
    op.drop_index("ix_hosted_zone_tags_key_value", table_name="hosted_zone_tags")
    op.drop_table("hosted_zone_tags")

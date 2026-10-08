"""create hosted zones

Revision ID: 0001
Revises:
Create Date: 2026-10-08 00:14:06
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "hosted_zones",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("comment", sa.String(length=256), nullable=True),
        sa.Column("private_zone", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "name = lower(name) AND name LIKE '%.'",
            name=op.f("ck_hosted_zones_name_is_canonical"),
        ),
        sa.CheckConstraint("length(comment) <= 256", name=op.f("ck_hosted_zones_comment_length")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_hosted_zones")),
    )
    op.create_index("ix_hosted_zones_name", "hosted_zones", ["name"])


def downgrade() -> None:
    op.drop_index("ix_hosted_zones_name", table_name="hosted_zones")
    op.drop_table("hosted_zones")

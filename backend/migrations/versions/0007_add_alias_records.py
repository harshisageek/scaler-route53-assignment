"""add alias records

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-08 17:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("record_sets") as batch:
        batch.add_column(
            sa.Column(
                "alias",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )
        batch.add_column(sa.Column("alias_target_type", sa.String(length=20), nullable=True))
        batch.add_column(sa.Column("alias_target", sa.String(length=255), nullable=True))
        batch.add_column(
            sa.Column(
                "evaluate_target_health",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )
        batch.create_check_constraint(
            "alias_target_type_value",
            "alias_target_type IS NULL OR alias_target_type IN "
            "('cloudfront', 's3-website', 'load-balancer', 'api-gateway', 'record')",
        )
        batch.create_check_constraint(
            "alias_target_fields",
            "(alias = 0 AND alias_target_type IS NULL AND alias_target IS NULL) OR "
            "(alias = 1 AND alias_target_type IS NOT NULL AND alias_target IS NOT NULL)",
        )
        batch.create_check_constraint(
            "alias_ttl",
            "(alias = 0 AND ttl IS NOT NULL) OR (alias = 1 AND ttl IS NULL)",
        )


def downgrade() -> None:
    with op.batch_alter_table("record_sets") as batch:
        batch.drop_constraint("alias_ttl", type_="check")
        batch.drop_constraint("alias_target_fields", type_="check")
        batch.drop_constraint("alias_target_type_value", type_="check")
        batch.drop_column("evaluate_target_health")
        batch.drop_column("alias_target")
        batch.drop_column("alias_target_type")
        batch.drop_column("alias")

"""add record routing policies

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-08 16:30:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_OLD_INDEX = "ix_record_sets_hosted_zone_id_name_type"
_NEW_INDEX = "ix_record_sets_hosted_zone_name_type_identifier"


def upgrade() -> None:
    with op.batch_alter_table("record_sets") as batch:
        batch.add_column(
            sa.Column(
                "routing_policy",
                sa.String(length=16),
                nullable=False,
                server_default="simple",
            )
        )
        batch.add_column(
            sa.Column(
                "set_identifier",
                sa.String(length=128),
                nullable=False,
                server_default="",
            )
        )
        batch.add_column(sa.Column("weight", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("failover_role", sa.String(length=9), nullable=True))
        batch.add_column(sa.Column("region", sa.String(length=32), nullable=True))
        batch.add_column(sa.Column("geolocation", sa.String(length=64), nullable=True))
        batch.create_check_constraint(
            "routing_policy_value",
            "routing_policy IN "
            "('simple', 'weighted', 'failover', 'latency', 'geolocation', 'multivalue')",
        )
        batch.create_check_constraint(
            "weight_range",
            "weight IS NULL OR (weight >= 0 AND weight <= 255)",
        )
        batch.create_check_constraint(
            "failover_role_value",
            "failover_role IS NULL OR failover_role IN ('PRIMARY', 'SECONDARY')",
        )
        batch.drop_index(_OLD_INDEX)
        batch.create_index(
            _NEW_INDEX,
            ["hosted_zone_id", "name", "type", "set_identifier"],
            unique=True,
        )


def downgrade() -> None:
    with op.batch_alter_table("record_sets") as batch:
        batch.drop_index(_NEW_INDEX)
        batch.create_index(
            _OLD_INDEX,
            ["hosted_zone_id", "name", "type"],
            unique=True,
        )
        batch.drop_constraint("failover_role_value", type_="check")
        batch.drop_constraint("weight_range", type_="check")
        batch.drop_constraint("routing_policy_value", type_="check")
        batch.drop_column("geolocation")
        batch.drop_column("region")
        batch.drop_column("failover_role")
        batch.drop_column("weight")
        batch.drop_column("set_identifier")
        batch.drop_column("routing_policy")

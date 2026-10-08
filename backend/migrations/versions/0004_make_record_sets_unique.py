"""make record set names and types unique within a zone

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-08 15:15:00
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_INDEX = "ix_record_sets_hosted_zone_id_name_type"
_COLUMNS = ["hosted_zone_id", "name", "type"]


def upgrade() -> None:
    op.drop_index(_INDEX, table_name="record_sets")
    op.create_index(_INDEX, "record_sets", _COLUMNS, unique=True)


def downgrade() -> None:
    op.drop_index(_INDEX, table_name="record_sets")
    op.create_index(_INDEX, "record_sets", _COLUMNS, unique=False)

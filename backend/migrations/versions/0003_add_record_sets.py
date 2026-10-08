"""add record sets, name servers and private zone VPCs

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-08 01:10:00

Zones created before this revision have no name servers and no default NS and
SOA records. They are backfilled here. The generator is copied in rather than
imported, so later changes to the app cannot change what this migration does.
Existing private zones get a placeholder VPC, which the new constraint requires.
"""

import random
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_BLOCKS = ((".com.", 0), (".net.", 512), (".org.", 1024), (".co.uk.", 1536))
_PRIVATE_NAME_SERVERS = [f"ns-{start}.awsdns-00{tld}" for tld, start in _BLOCKS]
_SOA_TAIL = "awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400"


def _name_servers(private: bool) -> list[str]:
    if private:
        return list(_PRIVATE_NAME_SERVERS)
    rng = random.SystemRandom()
    servers = []
    for tld, start in _BLOCKS:
        number = start + rng.randrange(512)
        servers.append(f"ns-{number}.awsdns-{(number - start) // 8:02d}{tld}")
    rng.shuffle(servers)
    return servers


def upgrade() -> None:
    op.create_table(
        "record_sets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("hosted_zone_id", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("type", sa.String(length=10), nullable=False),
        sa.Column("ttl", sa.Integer(), nullable=True),
        sa.Column("values", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "name = lower(name) AND name LIKE '%.'",
            name=op.f("ck_record_sets_name_is_canonical"),
        ),
        sa.CheckConstraint(
            "ttl IS NULL OR (ttl >= 0 AND ttl <= 2147483647)",
            name=op.f("ck_record_sets_ttl_range"),
        ),
        sa.ForeignKeyConstraint(
            ["hosted_zone_id"],
            ["hosted_zones.id"],
            name=op.f("fk_record_sets_hosted_zone_id_hosted_zones"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_record_sets")),
    )
    op.create_index(
        "ix_record_sets_hosted_zone_id_name_type",
        "record_sets",
        ["hosted_zone_id", "name", "type"],
    )

    with op.batch_alter_table("hosted_zones") as batch_op:
        batch_op.add_column(
            sa.Column("name_servers", sa.JSON(), nullable=False, server_default="[]")
        )
        batch_op.add_column(sa.Column("vpc_region", sa.String(length=32), nullable=True))
        batch_op.add_column(sa.Column("vpc_id", sa.String(length=32), nullable=True))

    _backfill()

    with op.batch_alter_table("hosted_zones") as batch_op:
        batch_op.alter_column("name_servers", server_default=None)
        batch_op.create_check_constraint(
            op.f("ck_hosted_zones_vpc_only_for_private_zones"),
            "(private_zone AND vpc_region IS NOT NULL AND vpc_id IS NOT NULL)"
            " OR (NOT private_zone AND vpc_region IS NULL AND vpc_id IS NULL)",
        )


# Typed table stubs, so SQLAlchemy encodes JSON and datetimes as the app does.
_hosted_zones = sa.table(
    "hosted_zones",
    sa.column("id", sa.String),
    sa.column("name", sa.String),
    sa.column("private_zone", sa.Boolean),
    sa.column("name_servers", sa.JSON),
    sa.column("vpc_region", sa.String),
    sa.column("vpc_id", sa.String),
)
_record_sets = sa.table(
    "record_sets",
    sa.column("hosted_zone_id", sa.String),
    sa.column("name", sa.String),
    sa.column("type", sa.String),
    sa.column("ttl", sa.Integer),
    sa.column("values", sa.JSON),
    sa.column("created_at", sa.DateTime(timezone=True)),
    sa.column("updated_at", sa.DateTime(timezone=True)),
)


def _backfill() -> None:
    bind = op.get_bind()
    now = datetime.now(UTC)
    zones = bind.execute(
        sa.select(_hosted_zones.c.id, _hosted_zones.c.name, _hosted_zones.c.private_zone)
    ).all()
    for zone_id, name, private in zones:
        servers = _name_servers(bool(private))
        bind.execute(
            _hosted_zones.update()
            .where(_hosted_zones.c.id == zone_id)
            .values(
                name_servers=servers,
                vpc_region="us-east-1" if private else None,
                vpc_id="vpc-00000000" if private else None,
            )
        )
        for record_type, ttl, values in (
            ("NS", 172800, servers),
            ("SOA", 900, [f"{servers[0]} {_SOA_TAIL}"]),
        ):
            bind.execute(
                _record_sets.insert().values(
                    hosted_zone_id=zone_id,
                    name=name,
                    type=record_type,
                    ttl=ttl,
                    values=values,
                    created_at=now,
                    updated_at=now,
                )
            )


def downgrade() -> None:
    with op.batch_alter_table("hosted_zones") as batch_op:
        batch_op.drop_constraint(op.f("ck_hosted_zones_vpc_only_for_private_zones"), type_="check")
        batch_op.drop_column("vpc_id")
        batch_op.drop_column("vpc_region")
        batch_op.drop_column("name_servers")

    op.drop_index("ix_record_sets_hosted_zone_id_name_type", table_name="record_sets")
    op.drop_table("record_sets")

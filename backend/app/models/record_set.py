from sqlalchemy import JSON, CheckConstraint, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin

# Route 53 accepts TTLs from 0 to 2^31 - 1 seconds.
TTL_MAX = 2_147_483_647


class RecordSet(TimestampMixin, Base):
    """All the values for one name and type in a zone, as Route 53 groups them.

    For example, two A records for www.example.com. are one record set with two
    values, not two rows.
    """

    __tablename__ = "record_sets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    hosted_zone_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("hosted_zones.id", ondelete="CASCADE"), nullable=False
    )
    # Fully qualified, lower case, with the trailing dot: "www.example.com."
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(10), nullable=False)
    ttl: Mapped[int | None] = mapped_column(Integer)
    values: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    routing_policy: Mapped[str] = mapped_column(String(16), nullable=False, default="simple")
    # Empty for simple and multivalue records. Other routing policies require
    # a stable identifier so multiple answers can share one name and type.
    set_identifier: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    weight: Mapped[int | None] = mapped_column(Integer)
    failover_role: Mapped[str | None] = mapped_column(String(9))
    region: Mapped[str | None] = mapped_column(String(32))
    geolocation: Mapped[str | None] = mapped_column(String(64))

    __table_args__ = (
        CheckConstraint("name = lower(name) AND name LIKE '%.'", name="name_is_canonical"),
        CheckConstraint(f"ttl IS NULL OR (ttl >= 0 AND ttl <= {TTL_MAX})", name="ttl_range"),
        CheckConstraint(
            "routing_policy IN "
            "('simple', 'weighted', 'failover', 'latency', 'geolocation', 'multivalue')",
            name="routing_policy_value",
        ),
        CheckConstraint(
            "weight IS NULL OR (weight >= 0 AND weight <= 255)",
            name="weight_range",
        ),
        CheckConstraint(
            "failover_role IS NULL OR failover_role IN ('PRIMARY', 'SECONDARY')",
            name="failover_role_value",
        ),
        Index(
            "ix_record_sets_hosted_zone_name_type_identifier",
            "hosted_zone_id",
            "name",
            "type",
            "set_identifier",
            unique=True,
        ),
    )

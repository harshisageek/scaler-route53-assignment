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

    __table_args__ = (
        CheckConstraint("name = lower(name) AND name LIKE '%.'", name="name_is_canonical"),
        CheckConstraint(f"ttl IS NULL OR (ttl >= 0 AND ttl <= {TTL_MAX})", name="ttl_range"),
        Index("ix_record_sets_hosted_zone_id_name_type", "hosted_zone_id", "name", "type"),
    )

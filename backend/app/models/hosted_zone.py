from sqlalchemy import Boolean, CheckConstraint, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin

COMMENT_MAX_LENGTH = 256


class HostedZone(TimestampMixin, Base):
    """A container for the DNS records of one domain.

    Route 53 allows several zones with the same name (for example a public and a
    private one), so the name is indexed but deliberately not unique.
    """

    __tablename__ = "hosted_zones"

    # Route 53 style: "Z" followed by uppercase letters and digits.
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    # Fully qualified, lower case, with the trailing dot: "example.com."
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    comment: Mapped[str | None] = mapped_column(String(COMMENT_MAX_LENGTH))
    private_zone: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    __table_args__ = (
        CheckConstraint(f"length(comment) <= {COMMENT_MAX_LENGTH}", name="comment_length"),
        CheckConstraint("name = lower(name) AND name LIKE '%.'", name="name_is_canonical"),
        Index("ix_hosted_zones_name", "name"),
    )

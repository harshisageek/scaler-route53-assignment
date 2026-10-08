from sqlalchemy import CheckConstraint, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

TAG_KEY_MAX_LENGTH = 128
TAG_VALUE_MAX_LENGTH = 256


class HostedZoneTag(Base):
    """A user-defined key/value label attached to one hosted zone."""

    __tablename__ = "hosted_zone_tags"

    hosted_zone_id: Mapped[str] = mapped_column(
        String(32),
        ForeignKey("hosted_zones.id", ondelete="CASCADE"),
        primary_key=True,
    )
    key: Mapped[str] = mapped_column(String(TAG_KEY_MAX_LENGTH), primary_key=True)
    value: Mapped[str] = mapped_column(String(TAG_VALUE_MAX_LENGTH), nullable=False, default="")

    __table_args__ = (
        CheckConstraint("length(key) >= 1", name="tag_key_not_empty"),
        CheckConstraint(
            f"length(key) <= {TAG_KEY_MAX_LENGTH}",
            name="tag_key_length",
        ),
        CheckConstraint(
            f"length(value) <= {TAG_VALUE_MAX_LENGTH}",
            name="tag_value_length",
        ),
        Index("ix_hosted_zone_tags_key_value", "key", "value"),
    )

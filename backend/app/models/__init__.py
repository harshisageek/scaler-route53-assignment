"""Every model is imported here so Alembic sees the full schema."""

from app.models.hosted_zone import HostedZone

__all__ = ["HostedZone"]

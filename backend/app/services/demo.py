"""The shared demo account and its sample data.

Anyone can sign in to the demo account, so its zones drift as visitors edit
them. At each demo sign-in, data older than DEMO_RESET_INTERVAL_HOURS is put
back to the sample set. Checking at sign-in needs no scheduler or extra secret.
"""

from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import hash_password, verify_password
from app.db.base import utcnow
from app.models import User
from app.repositories import hosted_zones as zones
from app.repositories import users
from app.schemas.hosted_zone import HostedZoneCreate, Vpc
from app.services.hosted_zones import add_hosted_zone
from app.services.ids import new_account_id

SAMPLE_ZONES: list[HostedZoneCreate] = [
    HostedZoneCreate(name="example.com", comment="Sample public hosted zone"),
    HostedZoneCreate(name="shop.example.net", comment="Storefront"),
    HostedZoneCreate(
        name="internal.example.com",
        comment="Private VPC zone",
        private_zone=True,
        vpc=Vpc(region="us-east-1", vpc_id="vpc-0a1b2c3d"),
    ),
]


def ensure_demo_account(db: Session, settings: Settings) -> User:
    """Create the demo account if needed, keep its password in sync, and restore stale data."""
    user = users.get_user_by_email(db, settings.demo_user_email)
    if user is None:
        user = users.add_user(
            db,
            User(
                email=settings.demo_user_email,
                password_hash=hash_password(settings.demo_user_password),
                account_id=new_account_id(db),
                is_demo=True,
            ),
        )
    elif not verify_password(user.password_hash, settings.demo_user_password):
        user.password_hash = hash_password(settings.demo_user_password)

    reset_if_stale(db, settings, user)
    db.commit()
    return user


def reset_if_stale(db: Session, settings: Settings, user: User) -> bool:
    """Put the demo data back to the sample set if it is too old. Returns whether it did."""
    now = utcnow()
    interval = timedelta(hours=settings.demo_reset_interval_hours)
    if user.demo_data_reset_at is not None and now - user.demo_data_reset_at < interval:
        return False

    zones.delete_all_hosted_zones(db, user.id)
    for zone in SAMPLE_ZONES:
        add_hosted_zone(db, user.id, zone)
    user.demo_data_reset_at = now
    return True

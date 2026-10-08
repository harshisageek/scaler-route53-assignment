"""Demo accounts and their sample data.

"Try the demo" gives every visitor a private visitor account with a fresh copy
of the sample zones, so no visitor ever sees another's edits. A visitor account
has no usable password and is deleted once it has no live session left.

The shared account with published credentials is a local-development
convenience, created at startup when SEED_DEMO_DATA is true. Its data is put
back to the sample set at sign-in once older than DEMO_RESET_INTERVAL_HOURS.
"""

import secrets
from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import TooManyRequestsError
from app.core.security import hash_password, verify_password
from app.db.base import utcnow
from app.models import User
from app.repositories import hosted_zones as zones
from app.repositories import users
from app.schemas.hosted_zone import HostedZoneCreate, Vpc
from app.services.hosted_zones import add_hosted_zone
from app.services.ids import new_account_id
from app.services.login_throttle import LoginThrottle

VISITOR_EMAIL_DOMAIN = "visitors.route53-clone.dev"
# Never a valid Argon2 hash, so nobody can sign in to a visitor account by password.
UNUSABLE_PASSWORD_HASH = "!"
# Grace period that keeps a just-created visitor safe until its session is stored.
VISITOR_MIN_AGE = timedelta(hours=1)
VISITOR_THROTTLE_KEY = "demo-visitor"

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


def create_visitor_account(db: Session, throttle: LoginThrottle) -> User:
    """Create a private demo account seeded with the sample zones."""
    if retry_after := throttle.retry_after(VISITOR_THROTTLE_KEY):
        raise TooManyRequestsError(
            "The demo is busy. Try again shortly.",
            {"retry_after_seconds": retry_after},
        )
    throttle.record_failure(VISITOR_THROTTLE_KEY)

    now = utcnow()
    users.delete_abandoned_visitors(db, VISITOR_EMAIL_DOMAIN, now, now - VISITOR_MIN_AGE)
    user = users.add_user(
        db,
        User(
            email=f"visitor-{secrets.token_hex(6)}@{VISITOR_EMAIL_DOMAIN}",
            password_hash=UNUSABLE_PASSWORD_HASH,
            account_id=new_account_id(db),
            is_demo=True,
            demo_data_reset_at=now,
        ),
    )
    for zone in SAMPLE_ZONES:
        add_hosted_zone(db, user.id, zone)
    db.commit()
    return user


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

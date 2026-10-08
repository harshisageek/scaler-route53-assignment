"""Identifiers in the same shape AWS uses."""

import secrets
import string

from sqlalchemy.orm import Session

from app.repositories import users

_ALPHABET = string.ascii_uppercase + string.digits
_HOSTED_ZONE_ID_LENGTH = 20


def new_hosted_zone_id() -> str:
    """Return an ID like ``Z0812345ABCDEFGHIJKLM``: "Z" plus 20 random characters."""
    return "Z" + "".join(secrets.choice(_ALPHABET) for _ in range(_HOSTED_ZONE_ID_LENGTH))


def new_account_id(db: Session) -> str:
    """Return an unused, mocked 12-digit AWS account ID."""
    while True:
        account_id = f"{secrets.randbelow(10**12):012d}"
        if not users.account_id_taken(db, account_id):
            return account_id

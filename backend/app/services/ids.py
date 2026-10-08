"""Identifiers in the same shape Route 53 uses."""

import secrets
import string

_ALPHABET = string.ascii_uppercase + string.digits
_HOSTED_ZONE_ID_LENGTH = 20


def new_hosted_zone_id() -> str:
    """Return an ID like ``Z0812345ABCDEFGHIJKLM``: "Z" plus 20 random characters."""
    return "Z" + "".join(secrets.choice(_ALPHABET) for _ in range(_HOSTED_ZONE_ID_LENGTH))

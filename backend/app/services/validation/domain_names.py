"""Domain name rules for hosted zones.

Names are stored the way Route 53 returns them: lower case, ASCII (non-ASCII
names become punycode), with the trailing dot that marks them fully qualified.
"""

import re

MAX_NAME_LENGTH = 253
MAX_LABEL_LENGTH = 63

# Letters, digits, hyphens and underscores; no hyphen at either end. Underscores
# are allowed because names like _dmarc.example.com. are common in practice.
_LABEL = re.compile(r"[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?")


class InvalidDomainNameError(ValueError):
    """The message is written to be shown to the user as it is."""


def normalize_zone_name(raw: str) -> str:
    """Return the canonical form of a zone name, or raise InvalidDomainNameError."""
    name = raw.strip().lower()
    if name.endswith("."):
        name = name[:-1]
    if not name:
        raise InvalidDomainNameError("Enter a domain name.")

    name = _to_ascii(name)
    if len(name) > MAX_NAME_LENGTH:
        raise InvalidDomainNameError(
            f"A domain name can have at most {MAX_NAME_LENGTH} characters."
        )

    labels = name.split(".")
    if len(labels) < 2:
        raise InvalidDomainNameError("Enter a full domain name, such as example.com.")
    for label in labels:
        _check_label(label)
    if labels[-1].isdigit():
        raise InvalidDomainNameError("The last part of a domain name can't be only digits.")
    return f"{name}."


def _to_ascii(name: str) -> str:
    if name.isascii():
        return name
    try:
        return name.encode("idna").decode("ascii")
    except UnicodeError:
        raise InvalidDomainNameError("This international domain name isn't valid.") from None


def _check_label(label: str) -> None:
    if not label:
        raise InvalidDomainNameError("A domain name can't contain two dots in a row.")
    if len(label) > MAX_LABEL_LENGTH:
        raise InvalidDomainNameError(
            f"Each part between dots can have at most {MAX_LABEL_LENGTH} characters."
        )
    if not _LABEL.fullmatch(label):
        raise InvalidDomainNameError(
            f'"{label}" isn\'t valid. Use letters, digits, hyphens and underscores,'
            " and don't start or end a part with a hyphen."
        )

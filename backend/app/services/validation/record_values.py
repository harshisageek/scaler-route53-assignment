"""Validation and canonical formatting for Route 53 record values."""

import ipaddress
import re
from collections.abc import Callable

from app.schemas.record_set import EditableRecordType
from app.services.validation.domain_names import InvalidDomainNameError, normalize_zone_name

_UINT16_MAX = 65_535
_CAA = re.compile(r'(\d+)\s+([a-z0-9]+)\s+"(.+)"', re.IGNORECASE)
_TXT_CHUNK = re.compile(r'"((?:[^"\\]|\\.)*)"')


class InvalidRecordValueError(ValueError):
    """A value failed the rules for its DNS record type."""


def normalize_record_values(record_type: EditableRecordType, values: list[str]) -> list[str]:
    validator: Callable[[str], str] = {
        "A": _ipv4,
        "AAAA": _ipv6,
        "CNAME": _domain,
        "TXT": _txt,
        "MX": _mx,
        "NS": _domain,
        "PTR": _domain,
        "SRV": _srv,
        "CAA": _caa,
    }[record_type]
    if record_type == "CNAME" and len(values) != 1:
        raise InvalidRecordValueError("A CNAME record must have exactly one value.")

    normalized = [validator(value) for value in values]
    if len(set(normalized)) != len(normalized):
        raise InvalidRecordValueError("Record values must be unique.")
    return normalized


def _ipv4(value: str) -> str:
    try:
        return str(ipaddress.IPv4Address(value))
    except ipaddress.AddressValueError:
        raise InvalidRecordValueError(f'"{value}" is not a valid IPv4 address.') from None


def _ipv6(value: str) -> str:
    try:
        return str(ipaddress.IPv6Address(value))
    except ipaddress.AddressValueError:
        raise InvalidRecordValueError(f'"{value}" is not a valid IPv6 address.') from None


def _domain(value: str) -> str:
    try:
        return normalize_zone_name(value)
    except InvalidDomainNameError as exc:
        raise InvalidRecordValueError(f'"{value}" is not a valid domain name: {exc}') from exc


def _txt(value: str) -> str:
    if len(value.encode()) > 4_000:
        raise InvalidRecordValueError("A TXT value can have at most 4,000 bytes.")
    chunks = _TXT_CHUNK.findall(value)
    remainder = _TXT_CHUNK.sub("", value)
    if not chunks or remainder.strip():
        raise InvalidRecordValueError(
            'A TXT value must be enclosed in double quotation marks, for example "hello".'
        )
    if any(len(chunk.encode()) > 255 for chunk in chunks):
        raise InvalidRecordValueError("Each quoted part of a TXT value can have at most 255 bytes.")
    return value


def _mx(value: str) -> str:
    parts = value.split()
    if len(parts) != 2:
        raise InvalidRecordValueError(
            "An MX value needs a priority and mail server, such as 10 mail.example.com."
        )
    priority = _uint(parts[0], "MX priority")
    return f"{priority} {_domain(parts[1])}"


def _srv(value: str) -> str:
    parts = value.split()
    if len(parts) != 4:
        raise InvalidRecordValueError("An SRV value needs priority, weight, port and target.")
    priority = _uint(parts[0], "SRV priority")
    weight = _uint(parts[1], "SRV weight")
    port = _uint(parts[2], "SRV port")
    return f"{priority} {weight} {port} {_domain(parts[3])}"


def _caa(value: str) -> str:
    match = _CAA.fullmatch(value)
    if not match:
        raise InvalidRecordValueError(
            'A CAA value needs flags, tag and a quoted value, such as 0 issue "letsencrypt.org".'
        )
    flags = int(match.group(1))
    if flags > 255:
        raise InvalidRecordValueError("CAA flags must be from 0 to 255.")
    return f'{flags} {match.group(2).lower()} "{match.group(3)}"'


def _uint(value: str, label: str) -> int:
    try:
        number = int(value)
    except ValueError:
        raise InvalidRecordValueError(f"{label} must be a whole number.") from None
    if not 0 <= number <= _UINT16_MAX:
        raise InvalidRecordValueError(f"{label} must be from 0 to {_UINT16_MAX}.")
    return number

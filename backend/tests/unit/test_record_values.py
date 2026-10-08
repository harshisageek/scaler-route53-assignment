import pytest
from app.schemas.record_set import EditableRecordType
from app.services.validation.record_values import (
    InvalidRecordValueError,
    normalize_record_values,
)


@pytest.mark.parametrize(
    ("record_type", "value", "expected"),
    [
        ("A", "192.0.2.1", "192.0.2.1"),
        ("AAAA", "2001:0db8:0:0:0:0:0:1", "2001:db8::1"),
        ("CNAME", "Target.Example.COM", "target.example.com."),
        ("TXT", '"v=spf1 include:example.com ~all"', '"v=spf1 include:example.com ~all"'),
        ("TXT", '"first" "second"', '"first" "second"'),
        ("MX", "10 Mail.Example.COM", "10 mail.example.com."),
        ("NS", "NS-1.Example.COM", "ns-1.example.com."),
        ("PTR", "Host.Example.COM", "host.example.com."),
        ("SRV", "10 20 443 Service.Example.COM", "10 20 443 service.example.com."),
        ("CAA", '0 ISSUE "letsencrypt.org"', '0 issue "letsencrypt.org"'),
    ],
)
def test_valid_values_are_canonicalized(
    record_type: EditableRecordType, value: str, expected: str
) -> None:
    assert normalize_record_values(record_type, [value]) == [expected]


@pytest.mark.parametrize(
    ("record_type", "value", "message"),
    [
        ("A", "2001:db8::1", "valid IPv4"),
        ("A", "192.168.1.999", "valid IPv4"),
        ("AAAA", "192.0.2.1", "valid IPv6"),
        ("CNAME", "not a domain", "valid domain"),
        ("TXT", "not quoted", "double quotation marks"),
        ("TXT", f'"{"x" * 256}"', "255 bytes"),
        ("MX", "mail.example.com", "priority and mail server"),
        ("MX", "65536 mail.example.com", "0 to 65535"),
        ("NS", "bad target", "valid domain"),
        ("PTR", "localhost", "valid domain"),
        ("SRV", "10 20 service.example.com", "priority, weight, port and target"),
        ("SRV", "10 20 65536 service.example.com", "0 to 65535"),
        ("CAA", 'issue "letsencrypt.org"', "flags, tag"),
        ("CAA", '256 issue "letsencrypt.org"', "0 to 255"),
    ],
)
def test_invalid_values_have_type_specific_messages(
    record_type: EditableRecordType, value: str, message: str
) -> None:
    with pytest.raises(InvalidRecordValueError, match=message):
        normalize_record_values(record_type, [value])


def test_a_cname_has_exactly_one_value() -> None:
    with pytest.raises(InvalidRecordValueError, match="exactly one"):
        normalize_record_values("CNAME", ["one.example.com", "two.example.com"])


def test_duplicate_values_are_rejected_after_canonicalization() -> None:
    with pytest.raises(InvalidRecordValueError, match="unique"):
        normalize_record_values("AAAA", ["2001:db8::1", "2001:0db8:0:0:0:0:0:1"])

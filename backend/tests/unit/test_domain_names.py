import pytest
from app.services.validation.domain_names import (
    InvalidDomainNameError,
    normalize_record_name,
    normalize_zone_name,
)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("example.com", "example.com."),
        ("example.com.", "example.com."),
        ("  Example.COM  ", "example.com."),
        ("sub.domain.example.co.uk", "sub.domain.example.co.uk."),
        ("_dmarc.example.com", "_dmarc.example.com."),
        ("my-site.example", "my-site.example."),
        ("123.example.com", "123.example.com."),
        ("bücher.de", "xn--bcher-kva.de."),
    ],
)
def test_names_are_stored_in_canonical_form(raw: str, expected: str) -> None:
    assert normalize_zone_name(raw) == expected


@pytest.mark.parametrize(
    ("raw", "message"),
    [
        ("", "Enter a domain name."),
        ("   .", "Enter a domain name."),
        ("localhost", "Enter a full domain name"),
        ("example..com", "two dots in a row"),
        (".example.com", "two dots in a row"),
        ("-bad.example.com", '"-bad" isn\'t valid'),
        ("bad-.example.com", '"bad-" isn\'t valid'),
        ("exa mple.com", '"exa mple" isn\'t valid'),
        ("example!.com", '"example!" isn\'t valid'),
        ("example.123", "can't be only digits"),
        (f"{'a' * 64}.com", "at most 63 characters"),
        (".".join(["a" * 63] * 4) + ".com", "at most 253 characters"),
    ],
)
def test_invalid_names_are_rejected_with_a_helpful_message(raw: str, message: str) -> None:
    with pytest.raises(InvalidDomainNameError, match=message):
        normalize_zone_name(raw)


def test_the_longest_allowed_name_is_accepted() -> None:
    name = ".".join(["a" * 63, "b" * 63, "c" * 63, "d" * 61])

    assert len(name) == 253
    assert normalize_zone_name(name) == f"{name}."


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("", "example.com."),
        ("@", "example.com."),
        ("www", "www.example.com."),
        ("WWW.Example.COM", "www.example.com."),
        ("www.example.com.", "www.example.com."),
        ("_dmarc", "_dmarc.example.com."),
        ("bücher", "xn--bcher-kva.example.com."),
    ],
)
def test_record_names_can_be_relative_or_absolute(raw: str, expected: str) -> None:
    assert normalize_record_name(raw, "example.com.") == expected


def test_an_absolute_record_name_must_be_inside_the_zone() -> None:
    with pytest.raises(InvalidDomainNameError, match="inside the hosted zone"):
        normalize_record_name("www.other.example.", "example.com.")

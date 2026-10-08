import re

from app.services.name_servers import PRIVATE_NAME_SERVERS, new_delegation_set, soa_value

_SERVER = re.compile(r"ns-(\d+)\.awsdns-(\d{2})\.(com|net|org|co\.uk)\.")
_BLOCK_START = {"com": 0, "net": 512, "org": 1024, "co.uk": 1536}


def test_a_public_zone_gets_one_server_under_each_aws_domain() -> None:
    servers = new_delegation_set(private_zone=False)

    tlds = sorted(_SERVER.fullmatch(server).group(3) for server in servers)  # type: ignore[union-attr]
    assert tlds == ["co.uk", "com", "net", "org"]


def test_server_numbers_follow_the_route53_pattern() -> None:
    for _ in range(50):
        for server in new_delegation_set(private_zone=False):
            match = _SERVER.fullmatch(server)
            assert match, server
            number, awsdns, tld = int(match.group(1)), int(match.group(2)), match.group(3)
            start = _BLOCK_START[tld]
            assert start <= number < start + 512
            assert awsdns == (number - start) // 8


def test_public_zones_get_different_servers() -> None:
    assert len({tuple(sorted(new_delegation_set(private_zone=False))) for _ in range(20)}) > 1


def test_private_zones_share_one_fixed_set() -> None:
    assert new_delegation_set(private_zone=True) == PRIVATE_NAME_SERVERS
    assert PRIVATE_NAME_SERVERS == [
        "ns-0.awsdns-00.com.",
        "ns-512.awsdns-00.net.",
        "ns-1024.awsdns-00.org.",
        "ns-1536.awsdns-00.co.uk.",
    ]


def test_soa_matches_what_route53_creates() -> None:
    assert soa_value("ns-89.awsdns-11.com.") == (
        "ns-89.awsdns-11.com. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400"
    )

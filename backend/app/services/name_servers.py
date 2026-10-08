"""Mocked Route 53 name servers and the default records every zone starts with.

Route 53 gives each public zone four name servers, one under each of .com, .net,
.org and .co.uk. Server numbers come from a fixed block per domain, and the
awsdns-NN part follows from the number. Private zones all share one fixed set.
"""

import secrets

_BLOCKS = ((".com.", 0), (".net.", 512), (".org.", 1024), (".co.uk.", 1536))
_BLOCK_SIZE = 512

PRIVATE_NAME_SERVERS = [f"ns-{start}.awsdns-00{tld}" for tld, start in _BLOCKS]

NS_TTL = 172_800
SOA_TTL = 900
# Serial, refresh, retry, expire and negative-cache TTL, as Route 53 sets them.
_SOA_TAIL = "awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400"


def new_delegation_set(private_zone: bool) -> list[str]:
    if private_zone:
        return list(PRIVATE_NAME_SERVERS)
    servers = []
    for tld, start in _BLOCKS:
        number = start + secrets.randbelow(_BLOCK_SIZE)
        servers.append(f"ns-{number}.awsdns-{(number - start) // 8:02d}{tld}")
    # Route 53 lists them in no particular order.
    secrets.SystemRandom().shuffle(servers)
    return servers


def soa_value(primary_name_server: str) -> str:
    return f"{primary_name_server} {_SOA_TAIL}"

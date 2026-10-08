from typing import Any

import pytest
from fastapi.testclient import TestClient

ZONES = "/api/v1/hosted-zones"


def create_zone(client: TestClient) -> dict[str, Any]:
    response = client.post(ZONES, json={"name": "example.com"})
    assert response.status_code == 201, response.text
    zone: dict[str, Any] = response.json()
    return zone


def create_record(
    client: TestClient,
    zone_id: str,
    **overrides: Any,
) -> Any:
    body = {
        "name": "www",
        "type": "A",
        "ttl": 60,
        "values": ["192.0.2.1"],
        **overrides,
    }
    return client.post(f"{ZONES}/{zone_id}/records", json=body)


@pytest.mark.parametrize(
    ("policy", "fields"),
    [
        ("weighted", {"set_identifier": "blue", "weight": 20}),
        (
            "failover",
            {"set_identifier": "primary", "failover_role": "PRIMARY"},
        ),
        ("latency", {"set_identifier": "ireland", "region": "eu-west-1"}),
        (
            "geolocation",
            {"set_identifier": "north-america", "geolocation": "US"},
        ),
        ("multivalue", {}),
    ],
)
def test_each_routing_policy_can_be_created(
    alice: TestClient, policy: str, fields: dict[str, Any]
) -> None:
    zone = create_zone(alice)

    response = create_record(
        alice,
        zone["id"],
        routing_policy=policy,
        **fields,
    )

    assert response.status_code == 201, response.text
    record = response.json()
    assert record["routing_policy"] == policy
    for key, value in fields.items():
        assert record[key] == value


@pytest.mark.parametrize(
    "body",
    [
        {"routing_policy": "weighted", "set_identifier": "blue"},
        {"routing_policy": "weighted", "weight": 10},
        {"routing_policy": "failover", "set_identifier": "primary"},
        {"routing_policy": "latency", "set_identifier": "ireland"},
        {"routing_policy": "latency", "set_identifier": "x", "region": "not-a-region"},
        {"routing_policy": "geolocation", "set_identifier": "north-america"},
        {"routing_policy": "simple", "set_identifier": "not-used"},
        {"routing_policy": "multivalue", "weight": 10},
    ],
)
def test_policy_specific_fields_are_enforced(alice: TestClient, body: dict[str, Any]) -> None:
    zone = create_zone(alice)

    response = create_record(alice, zone["id"], **body)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "ValidationFailed"


def test_weighted_records_share_a_name_when_identifiers_differ(
    alice: TestClient,
) -> None:
    zone = create_zone(alice)
    first = create_record(
        alice,
        zone["id"],
        routing_policy="weighted",
        set_identifier="blue",
        weight=10,
    )
    second = create_record(
        alice,
        zone["id"],
        routing_policy="weighted",
        set_identifier="green",
        weight=90,
        values=["192.0.2.2"],
    )
    duplicate = create_record(
        alice,
        zone["id"],
        routing_policy="weighted",
        set_identifier="blue",
        weight=50,
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "RecordSetAlreadyExists"


@pytest.mark.parametrize("simple_first", [True, False])
def test_simple_records_cannot_mix_with_routing_policies(
    alice: TestClient, simple_first: bool
) -> None:
    zone = create_zone(alice)
    simple: dict[str, Any] = {}
    weighted = {
        "routing_policy": "weighted",
        "set_identifier": "blue",
        "weight": 10,
    }
    first, second = (simple, weighted) if simple_first else (weighted, simple)

    assert create_record(alice, zone["id"], **first).status_code == 201
    response = create_record(alice, zone["id"], **second)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "RoutingPolicyConflict"


def test_different_non_simple_policies_cannot_mix(alice: TestClient) -> None:
    zone = create_zone(alice)
    assert (
        create_record(
            alice,
            zone["id"],
            routing_policy="weighted",
            set_identifier="blue",
            weight=10,
        ).status_code
        == 201
    )

    response = create_record(
        alice,
        zone["id"],
        routing_policy="latency",
        set_identifier="ireland",
        region="eu-west-1",
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "RoutingPolicyConflict"


def test_routed_cnames_can_share_the_same_name(alice: TestClient) -> None:
    zone = create_zone(alice)

    first = create_record(
        alice,
        zone["id"],
        type="CNAME",
        values=["blue.example.net"],
        routing_policy="weighted",
        set_identifier="blue",
        weight=10,
    )
    second = create_record(
        alice,
        zone["id"],
        type="CNAME",
        values=["green.example.net"],
        routing_policy="weighted",
        set_identifier="green",
        weight=90,
    )

    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text


def test_records_can_be_filtered_by_routing_policy(alice: TestClient) -> None:
    zone = create_zone(alice)
    create_record(
        alice,
        zone["id"],
        routing_policy="weighted",
        set_identifier="blue",
        weight=10,
    )

    response = alice.get(
        f"{ZONES}/{zone['id']}/records",
        params={"routing_policy": "weighted"},
    )

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["routing_policy"] == "weighted"

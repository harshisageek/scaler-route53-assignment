from typing import Any

import pytest
from fastapi.testclient import TestClient

ZONES = "/api/v1/hosted-zones"
MOCK_TARGETS = {
    "cloudfront": "d111111abcdef8.cloudfront.net.",
    "s3-website": "example-bucket.s3-website-us-east-1.amazonaws.com.",
    "load-balancer": "dualstack.example.us-east-1.elb.amazonaws.com.",
    "api-gateway": "d-example.execute-api.us-east-1.amazonaws.com.",
}


def create_zone(client: TestClient) -> dict[str, Any]:
    response = client.post(ZONES, json={"name": "example.com"})
    assert response.status_code == 201, response.text
    zone: dict[str, Any] = response.json()
    return zone


def alias_body(target_type: str, target: str, **overrides: Any) -> dict[str, Any]:
    return {
        "name": "@",
        "type": "A",
        "ttl": None,
        "values": [],
        "alias": True,
        "alias_target_type": target_type,
        "alias_target": target,
        "evaluate_target_health": True,
        **overrides,
    }


@pytest.mark.parametrize(("target_type", "target"), MOCK_TARGETS.items())
def test_apex_alias_can_use_each_mocked_aws_target(
    alice: TestClient, target_type: str, target: str
) -> None:
    zone = create_zone(alice)

    response = alice.post(
        f"{ZONES}/{zone['id']}/records",
        json=alias_body(target_type, target),
    )

    assert response.status_code == 201, response.text
    record = response.json()
    assert record["name"] == "example.com."
    assert record["alias"] is True
    assert record["ttl"] is None
    assert record["values"] == []
    assert record["alias_target_type"] == target_type
    assert record["alias_target"] == target
    assert record["evaluate_target_health"] is True


def test_alias_can_target_another_record_in_the_zone(alice: TestClient) -> None:
    zone = create_zone(alice)
    target = alice.post(
        f"{ZONES}/{zone['id']}/records",
        json={
            "name": "origin",
            "type": "AAAA",
            "ttl": 60,
            "values": ["2001:db8::1"],
        },
    )
    assert target.status_code == 201, target.text

    response = alice.post(
        f"{ZONES}/{zone['id']}/records",
        json=alias_body(
            "record",
            "origin",
            name="www",
            type="AAAA",
            evaluate_target_health=False,
        ),
    )

    assert response.status_code == 201, response.text
    assert response.json()["alias_target"] == "origin.example.com."


@pytest.mark.parametrize(
    "body",
    [
        alias_body("cloudfront", MOCK_TARGETS["cloudfront"], type="CNAME"),
        alias_body("cloudfront", MOCK_TARGETS["cloudfront"], ttl=60),
        alias_body("cloudfront", MOCK_TARGETS["cloudfront"], values=["192.0.2.1"]),
        alias_body("cloudfront", "unknown.cloudfront.net."),
        alias_body("record", "missing"),
        alias_body("record", "@"),
        {
            "name": "www",
            "type": "A",
            "ttl": 60,
            "values": ["192.0.2.1"],
            "evaluate_target_health": True,
        },
    ],
)
def test_invalid_alias_combinations_are_rejected(alice: TestClient, body: dict[str, Any]) -> None:
    zone = create_zone(alice)

    response = alice.post(f"{ZONES}/{zone['id']}/records", json=body)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "ValidationFailed"

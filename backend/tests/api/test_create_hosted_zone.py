from typing import Any

import pytest
from app.models import HostedZone, RecordSet
from app.repositories import record_sets
from app.services.name_servers import PRIVATE_NAME_SERVERS
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

URL = "/api/v1/hosted-zones"
VPC = {"region": "eu-west-1", "vpc_id": "vpc-0a1b2c3d"}


def create(client: TestClient, **body: Any) -> dict[str, Any]:
    response = client.post(URL, json={"name": "example.com", **body})
    assert response.status_code == 201, response.text
    result: dict[str, Any] = response.json()
    return result


def field_errors(response: Any) -> list[str]:
    assert response.status_code == 422, response.text
    return [error["msg"] for error in response.json()["error"]["details"]["fields"]]


def test_creating_a_zone_returns_it_with_its_location(alice: TestClient) -> None:
    response = alice.post(URL, json={"name": "Example.COM", "comment": "Production"})

    assert response.status_code == 201
    zone = response.json()
    assert response.headers["location"] == f"{URL}/{zone['id']}"
    assert zone["id"].startswith("Z") and len(zone["id"]) == 21
    assert zone["name"] == "example.com."
    assert zone["comment"] == "Production"
    assert zone["private_zone"] is False
    assert zone["record_count"] == 2
    assert len(zone["name_servers"]) == 4
    assert zone["vpc"] is None


def test_a_new_zone_starts_with_route53s_default_ns_and_soa_records(
    alice: TestClient, db_session: Session
) -> None:
    zone = create(alice)

    records = {
        record.type: record
        for record in db_session.scalars(
            select(RecordSet).where(RecordSet.hosted_zone_id == zone["id"])
        )
    }
    assert set(records) == {"NS", "SOA"}
    assert records["NS"].name == records["SOA"].name == "example.com."
    assert records["NS"].ttl == 172800
    assert records["NS"].values == zone["name_servers"]
    assert records["SOA"].ttl == 900
    (soa,) = records["SOA"].values
    assert soa.split()[0] in zone["name_servers"]
    assert soa.endswith("awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400")


def test_the_zone_is_not_saved_if_its_default_records_fail(
    alice: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fail(*_: object) -> None:
        raise RuntimeError("disk full")

    monkeypatch.setattr(record_sets, "add_record_sets", fail)

    with pytest.raises(RuntimeError):
        alice.post(URL, json={"name": "example.com"})

    db_session.rollback()
    assert db_session.scalars(select(HostedZone)).all() == []


def test_a_private_zone_keeps_its_vpc_and_gets_the_private_name_servers(
    alice: TestClient,
) -> None:
    zone = create(alice, private_zone=True, vpc=VPC)

    assert zone["private_zone"] is True
    assert zone["vpc"] == VPC
    assert zone["name_servers"] == PRIVATE_NAME_SERVERS


def test_a_blank_comment_is_stored_as_none(alice: TestClient) -> None:
    assert create(alice, comment="   ")["comment"] is None


def test_two_zones_can_share_a_name_like_in_route53(alice: TestClient) -> None:
    first, second = create(alice), create(alice)

    assert first["id"] != second["id"]
    assert alice.get(URL).json()["total"] == 2


@pytest.mark.parametrize(
    ("body", "message"),
    [
        ({"name": "localhost"}, "Enter a full domain name, such as example.com."),
        ({"name": "bad..example.com"}, "A domain name can't contain two dots in a row."),
        ({"name": ""}, "Enter a domain name."),
        ({"name": "example.com", "comment": "x" * 257}, "String should have at most 256"),
        ({"name": "example.com", "private_zone": True}, "A private hosted zone needs a VPC."),
        ({"name": "example.com", "vpc": VPC}, "Only private hosted zones have a VPC."),
        (
            {"name": "a.com", "private_zone": True, "vpc": {**VPC, "region": "mars-1"}},
            "Choose an AWS Region from the list.",
        ),
        (
            {"name": "a.com", "private_zone": True, "vpc": {**VPC, "vpc_id": "vpc-xyz"}},
            "String should match pattern",
        ),
    ],
)
def test_invalid_zones_are_rejected_with_a_clear_message(
    alice: TestClient, body: dict[str, Any], message: str
) -> None:
    messages = field_errors(alice.post(URL, json=body))

    assert any(msg.startswith(message) for msg in messages), messages


def test_creating_a_zone_requires_a_session(client: TestClient) -> None:
    assert client.post(URL, json={"name": "example.com"}).status_code == 401


def test_zone_details_include_name_servers_and_record_count(alice: TestClient) -> None:
    created = create(alice)

    details = alice.get(f"{URL}/{created['id']}").json()

    assert details == created


def test_the_list_shows_each_zones_record_count(alice: TestClient) -> None:
    create(alice)

    (zone,) = alice.get(URL).json()["items"]

    assert zone["record_count"] == 2


def test_another_users_new_zone_stays_hidden(alice: TestClient, bob: TestClient) -> None:
    zone = create(alice)

    assert bob.get(f"{URL}/{zone['id']}").status_code == 404
    assert bob.get(URL).json()["total"] == 0

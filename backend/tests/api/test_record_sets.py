from typing import Any

import pytest
from fastapi.testclient import TestClient

ZONES = "/api/v1/hosted-zones"


def create_zone(client: TestClient, name: str = "example.com") -> dict[str, Any]:
    response = client.post(ZONES, json={"name": name})
    assert response.status_code == 201, response.text
    zone: dict[str, Any] = response.json()
    return zone


def records_url(zone_id: str) -> str:
    return f"{ZONES}/{zone_id}/records"


def create_record(
    client: TestClient,
    zone_id: str,
    *,
    name: str = "www",
    record_type: str = "A",
    ttl: int = 300,
    values: list[str] | None = None,
) -> dict[str, Any]:
    response = client.post(
        records_url(zone_id),
        json={
            "name": name,
            "type": record_type,
            "ttl": ttl,
            "values": values or ["192.0.2.1"],
        },
    )
    assert response.status_code == 201, response.text
    record: dict[str, Any] = response.json()
    return record


def test_records_require_a_signed_in_user(client: TestClient) -> None:
    assert client.get(records_url("ZANY")).status_code == 401


def test_a_new_zone_lists_its_default_records(alice: TestClient) -> None:
    zone = create_zone(alice)

    response = alice.get(records_url(zone["id"]))

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert (body["page"], body["page_size"]) == (1, 100)
    assert [record["type"] for record in body["items"]] == ["NS", "SOA"]


def test_a_record_can_be_created_with_a_relative_name(alice: TestClient) -> None:
    zone = create_zone(alice)

    response = alice.post(
        records_url(zone["id"]),
        json={"name": "WWW", "type": "A", "ttl": 60, "values": ["192.0.2.1", "192.0.2.2"]},
    )

    assert response.status_code == 201
    record = response.json()
    assert record["name"] == "www.example.com."
    assert record["values"] == ["192.0.2.1", "192.0.2.2"]
    assert response.headers["location"].endswith(f"/records/{record['id']}")
    assert alice.get(f"{records_url(zone['id'])}/{record['id']}").json() == record
    assert alice.get(f"{ZONES}/{zone['id']}").json()["record_count"] == 3


def test_blank_and_at_both_mean_the_zone_apex(alice: TestClient) -> None:
    zone = create_zone(alice)

    blank = create_record(alice, zone["id"], name="", record_type="A")
    at = create_record(alice, zone["id"], name="@", record_type="AAAA", values=["2001:db8::1"])

    assert blank["name"] == "example.com."
    assert at["name"] == "example.com."


def test_a_record_can_be_updated_and_deleted(alice: TestClient) -> None:
    zone = create_zone(alice)
    record = create_record(alice, zone["id"])
    url = f"{records_url(zone['id'])}/{record['id']}"

    updated = alice.put(
        url,
        json={"name": "api", "type": "AAAA", "ttl": 900, "values": ["2001:db8::1"]},
    )

    assert updated.status_code == 200
    assert updated.json()["name"] == "api.example.com."
    assert updated.json()["type"] == "AAAA"
    assert updated.json()["ttl"] == 900
    assert alice.delete(url).status_code == 204
    assert alice.get(url).status_code == 404


def test_duplicate_name_and_type_is_a_conflict(alice: TestClient) -> None:
    zone = create_zone(alice)
    create_record(alice, zone["id"])

    response = alice.post(
        records_url(zone["id"]),
        json={"name": "www.example.com.", "type": "A", "ttl": 300, "values": ["192.0.2.2"]},
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "RecordSetAlreadyExists"


def test_records_never_cross_accounts(alice: TestClient, bob: TestClient) -> None:
    zone = create_zone(alice)
    record = create_record(alice, zone["id"])
    collection = records_url(zone["id"])
    item = f"{collection}/{record['id']}"
    body = {"name": "x", "type": "A", "ttl": 60, "values": ["192.0.2.2"]}

    assert bob.get(collection).status_code == 404
    assert bob.post(collection, json=body).status_code == 404
    assert bob.get(item).status_code == 404
    assert bob.put(item, json=body).status_code == 404
    assert bob.delete(item).status_code == 404
    assert alice.get(item).status_code == 200


@pytest.fixture
def searchable_records(alice: TestClient) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    zone = create_zone(alice)
    records = [
        create_record(alice, zone["id"], name="beta", ttl=600, values=["192.0.2.20"]),
        create_record(
            alice,
            zone["id"],
            name="alpha",
            record_type="AAAA",
            ttl=60,
            values=["2001:db8::1"],
        ),
        create_record(alice, zone["id"], name="gamma", ttl=300, values=["192.0.2.30"]),
    ]
    return zone, records


def test_records_can_be_searched_and_filtered(
    alice: TestClient, searchable_records: tuple[dict[str, Any], list[dict[str, Any]]]
) -> None:
    zone, _ = searchable_records
    url = records_url(zone["id"])

    by_name = alice.get(url, params={"q": "ALPHA"}).json()
    by_value = alice.get(url, params={"q": "192.0.2.20"}).json()
    by_type = alice.get(url, params={"type": "AAAA"}).json()

    assert [item["name"] for item in by_name["items"]] == ["alpha.example.com."]
    assert [item["name"] for item in by_value["items"]] == ["beta.example.com."]
    assert [item["name"] for item in by_type["items"]] == ["alpha.example.com."]


def test_records_can_be_sorted_and_paged(
    alice: TestClient, searchable_records: tuple[dict[str, Any], list[dict[str, Any]]]
) -> None:
    zone, _ = searchable_records
    response = alice.get(
        records_url(zone["id"]),
        params={"sort": "-ttl", "page": 2, "page_size": 2},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 5
    assert [item["ttl"] for item in body["items"]] == [600, 300]


@pytest.mark.parametrize(
    "body",
    [
        {"name": "www", "type": "BOGUS", "ttl": 60, "values": ["x"]},
        {"name": "www", "type": "A", "ttl": -1, "values": ["x"]},
        {"name": "www", "type": "A", "ttl": 60, "values": []},
        {"name": "www", "type": "A", "ttl": 60, "values": [" "]},
        {"name": "www", "type": "A", "ttl": 60, "values": ["x"], "alias": True},
    ],
)
def test_invalid_record_bodies_are_rejected(alice: TestClient, body: dict[str, Any]) -> None:
    zone = create_zone(alice)

    response = alice.post(records_url(zone["id"]), json=body)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "ValidationFailed"


def test_an_absolute_name_outside_the_zone_is_rejected(alice: TestClient) -> None:
    zone = create_zone(alice)

    response = alice.post(
        records_url(zone["id"]),
        json={"name": "www.other.example.", "type": "A", "ttl": 60, "values": ["192.0.2.1"]},
    )

    assert response.status_code == 422
    assert response.json()["error"]["details"]["fields"][0]["loc"] == ["body", "name"]

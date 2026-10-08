from typing import Any

from fastapi.testclient import TestClient

ZONES = "/api/v1/hosted-zones"


def create_zone(client: TestClient, name: str) -> dict[str, Any]:
    response = client.post(ZONES, json={"name": name})
    assert response.status_code == 201, response.text
    zone: dict[str, Any] = response.json()
    return zone


def record_body(name: str, value: str) -> dict[str, Any]:
    return {
        "name": name,
        "type": "A",
        "ttl": 300,
        "values": [value],
    }


def test_record_change_batch_creates_updates_and_deletes_atomically(
    alice: TestClient,
) -> None:
    zone = create_zone(alice, "batch.example.com")
    create = alice.post(
        f"{ZONES}/{zone['id']}/records:batch",
        json={
            "changes": [
                {"action": "CREATE", "record_set": record_body("one", "192.0.2.1")},
                {"action": "CREATE", "record_set": record_body("two", "192.0.2.2")},
            ]
        },
    )
    assert create.status_code == 200, create.text
    assert create.json() == {"applied_count": 2}
    records = alice.get(
        f"{ZONES}/{zone['id']}/records",
        params={"q": ".batch.example.com", "page_size": 100},
    ).json()["items"]
    by_name = {record["name"]: record for record in records}

    change = alice.post(
        f"{ZONES}/{zone['id']}/records:batch",
        json={
            "changes": [
                {
                    "action": "UPSERT",
                    "record_set_id": by_name["one.batch.example.com."]["id"],
                    "record_set": record_body("one.batch.example.com.", "192.0.2.10"),
                },
                {
                    "action": "DELETE",
                    "record_set_id": by_name["two.batch.example.com."]["id"],
                },
            ]
        },
    )

    assert change.status_code == 200, change.text
    remaining = alice.get(
        f"{ZONES}/{zone['id']}/records",
        params={"q": ".batch.example.com", "page_size": 100},
    ).json()["items"]
    assert len(remaining) == 1
    assert remaining[0]["values"] == ["192.0.2.10"]


def test_failed_record_batch_rolls_back_earlier_changes(alice: TestClient) -> None:
    zone = create_zone(alice, "rollback.example.com")
    created = alice.post(
        f"{ZONES}/{zone['id']}/records",
        json=record_body("keep", "192.0.2.1"),
    ).json()

    response = alice.post(
        f"{ZONES}/{zone['id']}/records:batch",
        json={
            "changes": [
                {"action": "DELETE", "record_set_id": created["id"]},
                {"action": "DELETE", "record_set_id": 999999},
            ]
        },
    )

    assert response.status_code == 404
    still_present = alice.get(f"{ZONES}/{zone['id']}/records/{created['id']}")
    assert still_present.status_code == 200


def test_hosted_zone_batch_deletes_only_when_every_zone_is_empty(
    alice: TestClient,
) -> None:
    empty = create_zone(alice, "empty.example.com")
    non_empty = create_zone(alice, "used.example.com")
    alice.post(
        f"{ZONES}/{non_empty['id']}/records",
        json=record_body("www", "192.0.2.1"),
    )

    blocked = alice.post(
        f"{ZONES}:batch",
        json={"hosted_zone_ids": [empty["id"], non_empty["id"]]},
    )

    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "HostedZonesNotEmpty"
    assert alice.get(f"{ZONES}/{empty['id']}").status_code == 200
    assert alice.get(f"{ZONES}/{non_empty['id']}").status_code == 200

    removable = create_zone(alice, "removable.example.com")
    deleted = alice.post(
        f"{ZONES}:batch",
        json={"hosted_zone_ids": [empty["id"], removable["id"]]},
    )
    assert deleted.status_code == 200
    assert deleted.json() == {"deleted_count": 2}
    assert alice.get(f"{ZONES}/{empty['id']}").status_code == 404
    assert alice.get(f"{ZONES}/{removable['id']}").status_code == 404


def test_hosted_zone_batch_does_not_reveal_another_owner_zone(
    alice: TestClient,
    bob: TestClient,
) -> None:
    alice_zone = create_zone(alice, "alice.example.com")
    bob_zone = create_zone(bob, "bob.example.com")

    response = alice.post(
        f"{ZONES}:batch",
        json={"hosted_zone_ids": [alice_zone["id"], bob_zone["id"]]},
    )

    assert response.status_code == 404
    assert alice.get(f"{ZONES}/{alice_zone['id']}").status_code == 200
    assert bob.get(f"{ZONES}/{bob_zone['id']}").status_code == 200

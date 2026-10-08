from typing import Any

from fastapi.testclient import TestClient

ZONES = "/api/v1/hosted-zones"


def create_zone(client: TestClient, name: str = "example.com") -> dict[str, Any]:
    response = client.post(ZONES, json={"name": name})
    assert response.status_code == 201, response.text
    zone: dict[str, Any] = response.json()
    return zone


def create_record(
    client: TestClient,
    zone_id: str,
    *,
    name: str,
    record_type: str,
    values: list[str],
    ttl: int = 300,
) -> None:
    response = client.post(
        f"{ZONES}/{zone_id}/records",
        json={
            "name": name,
            "type": record_type,
            "ttl": ttl,
            "values": values,
        },
    )
    assert response.status_code == 201, response.text


def test_bind_export_downloads_a_valid_zone_file(alice: TestClient) -> None:
    zone = create_zone(alice)
    create_record(
        alice,
        zone["id"],
        name="www",
        record_type="A",
        values=["192.0.2.10", "192.0.2.11"],
        ttl=60,
    )

    response = alice.get(f"{ZONES}/{zone['id']}/export", params={"format": "bind"})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/dns")
    assert response.headers["content-disposition"] == ('attachment; filename="example.com.zone"')
    assert "$ORIGIN example.com." in response.text
    assert "www.example.com. 60 IN A 192.0.2.10" in response.text
    assert "www.example.com. 60 IN A 192.0.2.11" in response.text


def test_json_export_preserves_route53_specific_fields(alice: TestClient) -> None:
    zone = create_zone(alice)
    alias = alice.post(
        f"{ZONES}/{zone['id']}/records",
        json={
            "name": "@",
            "type": "A",
            "ttl": None,
            "values": [],
            "alias": True,
            "alias_target_type": "cloudfront",
            "alias_target": "d111111abcdef8.cloudfront.net.",
            "evaluate_target_health": True,
        },
    )
    assert alias.status_code == 201, alias.text

    response = alice.get(f"{ZONES}/{zone['id']}/export", params={"format": "json"})

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"
    assert response.headers["content-disposition"] == ('attachment; filename="example.com.json"')
    payload = response.json()
    assert payload["version"] == 1
    assert payload["hosted_zone"]["id"] == zone["id"]
    exported_alias = next(record for record in payload["records"] if record["alias"])
    assert exported_alias["alias_target_type"] == "cloudfront"
    assert exported_alias["evaluate_target_health"] is True


def test_bind_export_import_round_trip_preserves_standard_records(
    alice: TestClient,
) -> None:
    source = create_zone(alice, "roundtrip.example.com")
    create_record(
        alice,
        source["id"],
        name="www",
        record_type="A",
        values=["192.0.2.20"],
        ttl=120,
    )
    create_record(
        alice,
        source["id"],
        name="mail",
        record_type="MX",
        values=["10 mail.roundtrip.example.com."],
        ttl=600,
    )
    exported = alice.get(
        f"{ZONES}/{source['id']}/export",
        params={"format": "bind"},
    )
    assert exported.status_code == 200
    destination = create_zone(alice, "roundtrip.example.com")

    imported = alice.post(
        f"{ZONES}/{destination['id']}/records/import",
        files={"file": ("roundtrip.zone", exported.content, "text/dns")},
    )

    assert imported.status_code == 201, imported.text
    assert imported.json()["imported_count"] == 2
    source_records = _custom_records(alice, source)
    destination_records = _custom_records(alice, destination)
    assert destination_records == source_records


def _custom_records(
    client: TestClient,
    zone: dict[str, Any],
) -> list[tuple[str, str, int, tuple[str, ...]]]:
    response = client.get(
        f"{ZONES}/{zone['id']}/records",
        params={"page_size": 100},
    )
    assert response.status_code == 200
    records = [
        (
            record["name"],
            record["type"],
            record["ttl"],
            tuple(record["values"]),
        )
        for record in response.json()["items"]
        if not (record["name"] == zone["name"] and record["type"] in {"NS", "SOA"})
    ]
    return sorted(records)

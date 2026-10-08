from typing import Any

from fastapi.testclient import TestClient

ZONES = "/api/v1/hosted-zones"

ZONE_FILE = b"""\
$ORIGIN example.com.
$TTL 300
@ IN SOA ns-1.example.net. hostmaster.example.com. (
  1 7200 900 1209600 86400
)
@ IN NS ns-1.example.net.
www IN A 192.0.2.10
www IN A 192.0.2.11
mail 600 IN MX 10 mail.example.com.
message IN TXT ("hello " "world")
"""

UNSUPPORTED_ZONE_FILE = (
    ZONE_FILE
    + b"""\
key IN DNSKEY 256 3 8 AwEAAQ==
"""
)


def create_zone(client: TestClient) -> dict[str, Any]:
    response = client.post(ZONES, json={"name": "example.com"})
    assert response.status_code == 201, response.text
    zone: dict[str, Any] = response.json()
    return zone


def upload(client: TestClient, url: str, content: bytes = ZONE_FILE) -> Any:
    return client.post(
        url,
        files={"file": ("example.zone", content, "text/plain")},
    )


def test_preview_parses_bind_features_and_classifies_records(
    alice: TestClient,
) -> None:
    zone = create_zone(alice)

    response = upload(
        alice,
        f"{ZONES}/{zone['id']}/records/import/preview",
        UNSUPPORTED_ZONE_FILE,
    )

    assert response.status_code == 200, response.text
    preview = response.json()
    assert preview["file_name"] == "example.zone"
    assert preview["add_count"] == 3
    assert preview["already_present_count"] == 2
    assert preview["unsupported_count"] == 1
    records = {(record["name"], record["type"]): record for record in preview["records"]}
    assert records[("www.example.com.", "A")] == {
        "name": "www.example.com.",
        "type": "A",
        "ttl": 300,
        "values": ["192.0.2.10", "192.0.2.11"],
        "status": "add",
        "reason": None,
    }
    assert records[("example.com.", "SOA")]["status"] == "already_present"
    assert records[("key.example.com.", "DNSKEY")]["status"] == "unsupported"


def test_import_adds_all_new_record_sets_in_one_request(alice: TestClient) -> None:
    zone = create_zone(alice)

    response = upload(alice, f"{ZONES}/{zone['id']}/records/import")

    assert response.status_code == 201, response.text
    assert response.json() == {"imported_count": 3, "skipped_count": 2}
    records = alice.get(f"{ZONES}/{zone['id']}/records", params={"page_size": 100})
    assert records.status_code == 200
    items = {(record["name"], record["type"]): record for record in records.json()["items"]}
    assert items[("www.example.com.", "A")]["values"] == [
        "192.0.2.10",
        "192.0.2.11",
    ]
    assert items[("mail.example.com.", "MX")]["ttl"] == 600
    assert items[("message.example.com.", "TXT")]["values"] == ['"hello " "world"']


def test_unsupported_record_blocks_the_whole_import(alice: TestClient) -> None:
    zone = create_zone(alice)

    response = upload(
        alice,
        f"{ZONES}/{zone['id']}/records/import",
        UNSUPPORTED_ZONE_FILE,
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "BindImportBlocked"
    records = alice.get(
        f"{ZONES}/{zone['id']}/records",
        params={"q": "www", "page_size": 100},
    )
    assert records.json()["total"] == 0


def test_invalid_and_oversized_files_are_rejected(alice: TestClient) -> None:
    zone = create_zone(alice)
    url = f"{ZONES}/{zone['id']}/records/import/preview"

    invalid = upload(alice, url, b"this is not a zone file")
    oversized = upload(alice, url, b"x" * (1024 * 1024 + 1))

    assert invalid.status_code == 422
    assert invalid.json()["error"]["code"] == "InvalidBindFile"
    assert oversized.status_code == 422
    assert oversized.json()["error"]["code"] == "BindFileTooLarge"

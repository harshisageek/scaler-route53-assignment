import pytest
from app.services import hosted_zones, record_sets
from fastapi.testclient import TestClient

from tests.api.test_bind_import import ZONE_FILE, create_zone, upload

ZONES = "/api/v1/hosted-zones"


def test_an_account_cannot_exceed_its_hosted_zone_quota(
    alice: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(hosted_zones, "MAX_HOSTED_ZONES_PER_ACCOUNT", 1)
    assert alice.post(ZONES, json={"name": "one.example"}).status_code == 201

    response = alice.post(ZONES, json={"name": "two.example"})

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "TooManyHostedZones"


def test_a_zone_cannot_exceed_its_record_set_quota(
    alice: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The NS and SOA defaults already use two of the three.
    monkeypatch.setattr(record_sets, "MAX_RECORD_SETS_PER_ZONE", 3)
    zone = create_zone(alice)
    url = f"{ZONES}/{zone['id']}/records"
    record = {"type": "A", "ttl": 300, "values": ["192.0.2.1"]}
    assert alice.post(url, json={**record, "name": "a"}).status_code == 201

    response = alice.post(url, json={**record, "name": "b"})

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "TooManyRecordSets"


def test_an_import_cannot_exceed_the_record_set_quota(
    alice: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(record_sets, "MAX_RECORD_SETS_PER_ZONE", 3)
    zone = create_zone(alice)

    response = upload(alice, f"{ZONES}/{zone['id']}/records/import", ZONE_FILE)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "TooManyRecordSets"

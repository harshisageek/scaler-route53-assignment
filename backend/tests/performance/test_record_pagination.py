from time import perf_counter

from app.models import RecordSet
from fastapi.testclient import TestClient
from sqlalchemy import insert
from sqlalchemy.orm import Session

RECORD_COUNT = 10_000
MAX_LIST_SECONDS = 2.0


def test_a_zone_with_ten_thousand_records_stays_paginated_and_fast(
    alice: TestClient,
    db_session: Session,
) -> None:
    zone_response = alice.post(
        "/api/v1/hosted-zones",
        json={"name": "load.example.com"},
    )
    assert zone_response.status_code == 201
    zone_id = zone_response.json()["id"]

    db_session.execute(
        insert(RecordSet),
        [
            {
                "hosted_zone_id": zone_id,
                "name": f"record-{number:05}.load.example.com.",
                "type": "A",
                "ttl": 300,
                "values": [f"192.0.2.{number % 255}"],
                "routing_policy": "simple",
                "set_identifier": "",
                "alias": False,
                "evaluate_target_health": False,
            }
            for number in range(RECORD_COUNT)
        ],
    )
    db_session.commit()

    started = perf_counter()
    response = alice.get(
        f"/api/v1/hosted-zones/{zone_id}/records",
        params={"page": 1, "page_size": 100, "sort": "name"},
    )
    elapsed = perf_counter() - started

    assert response.status_code == 200
    assert response.json()["total"] == RECORD_COUNT + 2
    assert len(response.json()["items"]) == 100
    assert elapsed < MAX_LIST_SECONDS

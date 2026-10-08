from app.models import HostedZone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def add_zone(db: Session, zone_id: str, name: str, *, private: bool = False) -> None:
    db.add(HostedZone(id=zone_id, name=name, comment=f"{name} zone", private_zone=private))
    db.commit()


def test_list_is_empty_on_a_fresh_database(client: TestClient) -> None:
    response = client.get("/api/v1/hosted-zones")

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0}


def test_list_returns_every_field_the_console_shows(
    client: TestClient, db_session: Session
) -> None:
    add_zone(db_session, "ZAAAAAAAAAAAAAAAAAAAA", "example.com.")

    body = client.get("/api/v1/hosted-zones").json()

    assert body["total"] == 1
    zone = body["items"][0]
    assert zone["id"] == "ZAAAAAAAAAAAAAAAAAAAA"
    assert zone["name"] == "example.com."
    assert zone["comment"] == "example.com. zone"
    assert zone["private_zone"] is False
    assert "created_at" in zone


def test_timestamps_carry_a_utc_offset(client: TestClient, db_session: Session) -> None:
    add_zone(db_session, "ZAAAAAAAAAAAAAAAAAAAA", "example.com.")

    created_at = client.get("/api/v1/hosted-zones").json()["items"][0]["created_at"]

    # SQLite drops the offset; without it a browser would read UTC as local time.
    assert created_at.endswith(("Z", "+00:00"))


def test_list_is_sorted_by_name(client: TestClient, db_session: Session) -> None:
    add_zone(db_session, "ZBBBBBBBBBBBBBBBBBBBB", "zeta.example.")
    add_zone(db_session, "ZCCCCCCCCCCCCCCCCCCCC", "alpha.example.")

    names = [zone["name"] for zone in client.get("/api/v1/hosted-zones").json()["items"]]

    assert names == ["alpha.example.", "zeta.example."]

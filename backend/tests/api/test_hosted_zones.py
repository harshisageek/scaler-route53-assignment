from app.models import HostedZone, User
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session


def add_zone(db: Session, owner_email: str, zone_id: str, name: str) -> None:
    owner = db.scalars(select(User).where(User.email == owner_email)).one()
    db.add(HostedZone(id=zone_id, owner_id=owner.id, name=name, comment=f"{name} zone"))
    db.commit()


def test_zones_require_a_signed_in_user(client: TestClient) -> None:
    response = client.get("/api/v1/hosted-zones")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "NotAuthenticated"


def test_a_new_account_has_no_zones(alice: TestClient) -> None:
    assert alice.get("/api/v1/hosted-zones").json() == {
        "items": [],
        "total": 0,
        "page": 1,
        "page_size": 100,
    }


def test_list_returns_every_field_the_console_shows(alice: TestClient, db_session: Session) -> None:
    add_zone(db_session, "alice@example.com", "ZAAAAAAAAAAAAAAAAAAAA", "example.com.")

    body = alice.get("/api/v1/hosted-zones").json()

    assert body["total"] == 1
    zone = body["items"][0]
    assert zone["id"] == "ZAAAAAAAAAAAAAAAAAAAA"
    assert zone["name"] == "example.com."
    assert zone["comment"] == "example.com. zone"
    assert zone["private_zone"] is False
    # SQLite drops the offset; without it a browser would read UTC as local time.
    assert zone["created_at"].endswith(("Z", "+00:00"))


def test_list_is_sorted_by_name(alice: TestClient, db_session: Session) -> None:
    add_zone(db_session, "alice@example.com", "ZBBBBBBBBBBBBBBBBBBBB", "zeta.example.")
    add_zone(db_session, "alice@example.com", "ZCCCCCCCCCCCCCCCCCCCC", "alpha.example.")

    names = [zone["name"] for zone in alice.get("/api/v1/hosted-zones").json()["items"]]

    assert names == ["alpha.example.", "zeta.example."]


# --- Isolation between users ---------------------------------------------------


def test_users_only_see_their_own_zones(
    alice: TestClient, bob: TestClient, db_session: Session
) -> None:
    add_zone(db_session, "alice@example.com", "ZAAAAAAAAAAAAAAAAAAAA", "alice.example.")
    add_zone(db_session, "bob@example.com", "ZBBBBBBBBBBBBBBBBBBBB", "bob.example.")

    alice_names = [z["name"] for z in alice.get("/api/v1/hosted-zones").json()["items"]]
    bob_names = [z["name"] for z in bob.get("/api/v1/hosted-zones").json()["items"]]

    assert alice_names == ["alice.example."]
    assert bob_names == ["bob.example."]


def test_a_zone_can_be_read_by_its_owner(alice: TestClient, db_session: Session) -> None:
    add_zone(db_session, "alice@example.com", "ZAAAAAAAAAAAAAAAAAAAA", "alice.example.")

    response = alice.get("/api/v1/hosted-zones/ZAAAAAAAAAAAAAAAAAAAA")

    assert response.status_code == 200
    assert response.json()["name"] == "alice.example."


def test_another_users_zone_looks_like_it_does_not_exist(
    alice: TestClient, bob: TestClient, db_session: Session
) -> None:
    add_zone(db_session, "alice@example.com", "ZAAAAAAAAAAAAAAAAAAAA", "alice.example.")

    theirs = bob.get("/api/v1/hosted-zones/ZAAAAAAAAAAAAAAAAAAAA")
    missing = bob.get("/api/v1/hosted-zones/ZNOSUCHZONEXXXXXXXXXX")

    # 404, not 403: a 403 would confirm the ID exists.
    assert theirs.status_code == missing.status_code == 404
    assert theirs.json()["error"]["code"] == missing.json()["error"]["code"] == "NoSuchHostedZone"

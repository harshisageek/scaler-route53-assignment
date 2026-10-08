from typing import Any

import pytest
from app.models import HostedZone, RecordSet
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

URL = "/api/v1/hosted-zones"


def create(client: TestClient, name: str, comment: str | None = None) -> dict[str, Any]:
    response = client.post(URL, json={"name": name, "comment": comment})
    assert response.status_code == 201, response.text
    zone: dict[str, Any] = response.json()
    return zone


def names(client: TestClient, **params: Any) -> list[str]:
    response = client.get(URL, params=params)
    assert response.status_code == 200, response.text
    return [zone["name"] for zone in response.json()["items"]]


def add_record(db: Session, zone_id: str, name: str, record_type: str = "A") -> None:
    db.add(
        RecordSet(hosted_zone_id=zone_id, name=name, type=record_type, ttl=300, values=["1.2.3.4"])
    )
    db.commit()


# --- Edit ----------------------------------------------------------------------


def test_the_comment_can_be_changed(alice: TestClient) -> None:
    zone = create(alice, "example.com", "Old")

    response = alice.patch(f"{URL}/{zone['id']}", json={"comment": "  New  "})

    assert response.status_code == 200
    assert response.json()["comment"] == "New"
    assert response.json()["updated_at"] >= zone["updated_at"]
    assert alice.get(f"{URL}/{zone['id']}").json()["comment"] == "New"


def test_the_comment_can_be_cleared(alice: TestClient) -> None:
    zone = create(alice, "example.com", "Old")

    assert alice.patch(f"{URL}/{zone['id']}", json={"comment": ""}).json()["comment"] is None


def test_the_name_cannot_be_changed(alice: TestClient) -> None:
    zone = create(alice, "example.com")

    response = alice.patch(f"{URL}/{zone['id']}", json={"comment": "x", "name": "other.com"})

    assert response.status_code == 200
    assert response.json()["name"] == "example.com."


def test_an_over_long_comment_is_rejected(alice: TestClient) -> None:
    zone = create(alice, "example.com")

    assert alice.patch(f"{URL}/{zone['id']}", json={"comment": "x" * 257}).status_code == 422


def test_another_users_zone_cannot_be_edited(alice: TestClient, bob: TestClient) -> None:
    zone = create(alice, "example.com", "Mine")

    response = bob.patch(f"{URL}/{zone['id']}", json={"comment": "Yours now"})

    assert response.status_code == 404
    assert alice.get(f"{URL}/{zone['id']}").json()["comment"] == "Mine"


# --- Delete --------------------------------------------------------------------


def test_a_zone_with_only_its_default_records_can_be_deleted(
    alice: TestClient, db_session: Session
) -> None:
    zone = create(alice, "example.com")

    response = alice.delete(f"{URL}/{zone['id']}")

    assert response.status_code == 204
    assert alice.get(f"{URL}/{zone['id']}").status_code == 404
    db_session.expire_all()
    assert db_session.scalars(select(RecordSet)).all() == []


def test_a_zone_with_other_records_is_not_deleted(alice: TestClient, db_session: Session) -> None:
    zone = create(alice, "example.com")
    add_record(db_session, zone["id"], "www.example.com.")
    add_record(db_session, zone["id"], "api.example.com.")

    response = alice.delete(f"{URL}/{zone['id']}")

    assert response.status_code == 409
    error = response.json()["error"]
    assert error["code"] == "HostedZoneNotEmpty"
    assert error["details"] == {"record_count": 2}
    assert "2 record sets" in error["message"]
    assert alice.get(f"{URL}/{zone['id']}").status_code == 200


def test_ns_records_below_the_apex_count_as_extra_records(
    alice: TestClient, db_session: Session
) -> None:
    zone = create(alice, "example.com")
    add_record(db_session, zone["id"], "sub.example.com.", "NS")

    response = alice.delete(f"{URL}/{zone['id']}")

    assert response.status_code == 409
    assert "1 record set " in response.json()["error"]["message"]


def test_another_users_zone_cannot_be_deleted(
    alice: TestClient, bob: TestClient, db_session: Session
) -> None:
    zone = create(alice, "example.com")

    assert bob.delete(f"{URL}/{zone['id']}").status_code == 404
    db_session.expire_all()
    assert db_session.get(HostedZone, zone["id"]) is not None


def test_deleting_a_missing_zone_is_a_404(alice: TestClient) -> None:
    response = alice.delete(f"{URL}/ZDOESNOTEXIST")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NoSuchHostedZone"


# --- Search, sort and pages ------------------------------------------------------


@pytest.fixture
def three_zones(alice: TestClient, db_session: Session) -> dict[str, dict[str, Any]]:
    zones = {
        "beta": create(alice, "beta.example.org", "Staging"),
        "alpha": create(alice, "alpha.example.com", "Production site"),
        "gamma": create(alice, "gamma.test", None),
    }
    add_record(db_session, zones["gamma"]["id"], "www.gamma.test.")
    return zones


@pytest.mark.usefixtures("three_zones")
def test_the_list_is_sorted_by_name_by_default(alice: TestClient) -> None:
    assert names(alice) == ["alpha.example.com.", "beta.example.org.", "gamma.test."]


@pytest.mark.usefixtures("three_zones")
@pytest.mark.parametrize(
    ("sort", "expected"),
    [
        ("-name", ["gamma.test.", "beta.example.org.", "alpha.example.com."]),
        ("-record_count", ["gamma.test.", "alpha.example.com.", "beta.example.org."]),
        ("created_at", ["beta.example.org.", "alpha.example.com.", "gamma.test."]),
        ("-created_at", ["gamma.test.", "alpha.example.com.", "beta.example.org."]),
    ],
)
def test_the_list_can_be_sorted(alice: TestClient, sort: str, expected: list[str]) -> None:
    assert names(alice, sort=sort) == expected


def test_type_sort_puts_public_zones_first(alice: TestClient) -> None:
    alice.post(
        URL,
        json={
            "name": "a-private.example",
            "private_zone": True,
            "vpc": {"region": "us-east-1", "vpc_id": "vpc-0a1b2c3d"},
        },
    )
    create(alice, "z-public.example")

    assert names(alice, sort="type") == ["z-public.example.", "a-private.example."]
    assert names(alice, sort="-type") == ["a-private.example.", "z-public.example."]


@pytest.mark.usefixtures("three_zones")
@pytest.mark.parametrize(
    ("q", "expected"),
    [
        ("EXAMPLE", ["alpha.example.com.", "beta.example.org."]),
        ("staging", ["beta.example.org."]),
        ("  gamma ", ["gamma.test."]),
        ("nothing-matches", []),
    ],
)
def test_search_matches_name_and_comment_ignoring_case(
    alice: TestClient, q: str, expected: list[str]
) -> None:
    assert names(alice, q=q) == expected


def test_search_matches_the_zone_id(
    alice: TestClient, three_zones: dict[str, dict[str, Any]]
) -> None:
    assert names(alice, q=three_zones["beta"]["id"].lower()) == ["beta.example.org."]


@pytest.mark.usefixtures("three_zones")
@pytest.mark.parametrize("q", ["%", "_", "\\"])
def test_search_treats_wildcards_as_plain_text(alice: TestClient, q: str) -> None:
    assert names(alice, q=q) == []


@pytest.mark.usefixtures("three_zones")
def test_the_total_counts_matches_not_just_the_page(alice: TestClient) -> None:
    body = alice.get(URL, params={"q": "example", "page_size": 1}).json()

    assert body["total"] == 2
    assert len(body["items"]) == 1
    assert (body["page"], body["page_size"]) == (1, 1)


@pytest.mark.usefixtures("three_zones")
def test_pages_split_the_list_without_overlap(alice: TestClient) -> None:
    pages = [names(alice, page=page, page_size=2) for page in (1, 2, 3)]

    assert pages == [["alpha.example.com.", "beta.example.org."], ["gamma.test."], []]


@pytest.mark.parametrize(
    "params",
    [{"sort": "owner_id"}, {"page": 0}, {"page_size": 0}, {"page_size": 101}, {"color": "red"}],
)
def test_bad_list_parameters_are_rejected(alice: TestClient, params: dict[str, Any]) -> None:
    response = alice.get(URL, params=params)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "ValidationFailed"


def test_search_never_crosses_accounts(
    alice: TestClient, bob: TestClient, three_zones: dict[str, dict[str, Any]]
) -> None:
    create(bob, "bob.example.com")

    assert names(bob, q="example") == ["bob.example.com."]
    assert names(alice, q="bob") == []

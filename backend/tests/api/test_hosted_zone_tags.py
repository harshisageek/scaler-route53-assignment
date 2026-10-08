from typing import Any

from app.models import HostedZoneTag
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

URL = "/api/v1/hosted-zones"


def create(
    client: TestClient,
    name: str,
    tags: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    response = client.post(URL, json={"name": name, "tags": tags or []})
    assert response.status_code == 201, response.text
    zone: dict[str, Any] = response.json()
    return zone


def test_tags_are_created_and_returned_on_list_and_detail(alice: TestClient) -> None:
    zone = create(
        alice,
        "example.com",
        [{"key": "Environment", "value": "Production"}, {"key": "Owner", "value": "DNS"}],
    )

    assert zone["tags"] == [
        {"key": "Environment", "value": "Production"},
        {"key": "Owner", "value": "DNS"},
    ]
    assert alice.get(URL).json()["items"][0]["tags"] == zone["tags"]
    assert alice.get(f"{URL}/{zone['id']}").json()["tags"] == zone["tags"]


def test_tags_can_be_replaced_and_cleared(alice: TestClient) -> None:
    zone = create(alice, "example.com", [{"key": "Old", "value": "value"}])

    replaced = alice.patch(
        f"{URL}/{zone['id']}",
        json={"comment": None, "tags": [{"key": "New", "value": "value"}]},
    )
    assert replaced.status_code == 200
    assert replaced.json()["tags"] == [{"key": "New", "value": "value"}]

    cleared = alice.patch(f"{URL}/{zone['id']}", json={"comment": None, "tags": []})
    assert cleared.status_code == 200
    assert cleared.json()["tags"] == []


def test_updating_only_the_comment_keeps_tags(alice: TestClient) -> None:
    zone = create(alice, "example.com", [{"key": "Owner", "value": "DNS"}])

    response = alice.patch(f"{URL}/{zone['id']}", json={"comment": "Updated"})

    assert response.status_code == 200
    assert response.json()["tags"] == [{"key": "Owner", "value": "DNS"}]


def test_list_can_filter_by_tag_key_and_value(alice: TestClient) -> None:
    create(
        alice,
        "production.example",
        [{"key": "Environment", "value": "Production"}],
    )
    create(
        alice,
        "staging.example",
        [
            {"key": "Environment", "value": "Staging"},
            {"key": "Owner", "value": "Production"},
        ],
    )

    by_key = alice.get(URL, params={"tag_key": "Owner"}).json()
    assert [zone["name"] for zone in by_key["items"]] == ["staging.example."]

    by_pair = alice.get(
        URL,
        params={"tag_key": "Environment", "tag_value": "Production"},
    ).json()
    assert [zone["name"] for zone in by_pair["items"]] == ["production.example."]


def test_tag_filters_never_cross_accounts(alice: TestClient, bob: TestClient) -> None:
    create(alice, "alice.example", [{"key": "Owner", "value": "Alice"}])
    create(bob, "bob.example", [{"key": "Owner", "value": "Bob"}])

    assert alice.get(URL, params={"tag_key": "Owner"}).json()["total"] == 1
    assert alice.get(URL, params={"tag_value": "Bob"}).json()["total"] == 0


def test_tag_keys_are_unique_and_cannot_use_the_aws_prefix(alice: TestClient) -> None:
    duplicate = alice.post(
        URL,
        json={
            "name": "duplicate.example",
            "tags": [
                {"key": "Owner", "value": "one"},
                {"key": "Owner", "value": "two"},
            ],
        },
    )
    reserved = alice.post(
        URL,
        json={
            "name": "reserved.example",
            "tags": [{"key": "aws:service", "value": "Route 53"}],
        },
    )

    assert duplicate.status_code == 422
    assert reserved.status_code == 422


def test_no_more_than_fifty_tags_are_allowed(alice: TestClient) -> None:
    response = alice.post(
        URL,
        json={
            "name": "too-many.example",
            "tags": [{"key": f"key-{index}", "value": ""} for index in range(51)],
        },
    )

    assert response.status_code == 422


def test_another_user_cannot_change_zone_tags(alice: TestClient, bob: TestClient) -> None:
    zone = create(alice, "example.com", [{"key": "Owner", "value": "Alice"}])

    response = bob.patch(
        f"{URL}/{zone['id']}",
        json={"comment": None, "tags": [{"key": "Owner", "value": "Bob"}]},
    )

    assert response.status_code == 404
    assert alice.get(f"{URL}/{zone['id']}").json()["tags"] == [{"key": "Owner", "value": "Alice"}]


def test_deleting_a_zone_cascades_to_its_tags(alice: TestClient, db_session: Session) -> None:
    zone = create(alice, "example.com", [{"key": "Owner", "value": "DNS"}])

    assert alice.delete(f"{URL}/{zone['id']}").status_code == 204
    db_session.expire_all()
    assert db_session.scalars(select(HostedZoneTag)).all() == []

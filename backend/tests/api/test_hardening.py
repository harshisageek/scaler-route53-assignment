from app.core.config import Settings
from app.core.middleware import REQUEST_ID_HEADER
from app.main import create_app
from fastapi import FastAPI
from fastapi.testclient import TestClient


def test_every_response_has_security_and_request_headers(client: TestClient) -> None:
    response = client.get(
        "/api/v1/health",
        headers={REQUEST_ID_HEADER: "trace-from-client"},
    )

    assert response.status_code == 200
    assert response.headers[REQUEST_ID_HEADER] == "trace-from-client"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert response.headers["permissions-policy"] == "camera=(), geolocation=(), microphone=()"
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]


def test_an_unsafe_request_id_is_replaced(client: TestClient) -> None:
    response = client.get(
        "/api/v1/health",
        headers={REQUEST_ID_HEADER: "not safe because it contains spaces"},
    )

    request_id = response.headers[REQUEST_ID_HEADER]
    assert request_id != "not safe because it contains spaces"
    assert len(request_id) == 32


def test_unhandled_errors_use_the_standard_error_shape(app: FastAPI) -> None:
    @app.get("/explode")
    def explode() -> None:
        raise RuntimeError("sensitive implementation detail")

    with TestClient(app) as client:
        response = client.get("/explode")

    assert response.status_code == 500
    assert response.json() == {
        "error": {
            "code": "InternalServerError",
            "message": "An unexpected error occurred.",
            "details": {},
        }
    }
    assert REQUEST_ID_HEADER in response.headers
    assert "sensitive implementation detail" not in response.text


def test_production_responses_enable_hsts(settings: Settings) -> None:
    production = settings.model_copy(
        update={"app_env": "production", "session_cookie_secure": True},
    )
    with TestClient(create_app(production)) as client:
        response = client.get("/api/v1/health")

    assert response.headers["strict-transport-security"] == ("max-age=31536000; includeSubDomains")

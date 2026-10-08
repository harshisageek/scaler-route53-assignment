import pytest
from app.core.config import Settings
from pydantic import ValidationError


def test_cors_origins_accept_a_comma_separated_env_var(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "http://a.test, http://b.test")

    assert Settings().cors_allowed_origins == ["http://a.test", "http://b.test"]


def test_cors_origins_accept_a_single_origin_env_var(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000")

    assert Settings().cors_allowed_origins == ["http://localhost:3000"]


def test_log_level_is_normalised_to_upper_case() -> None:
    assert Settings(log_level="debug").log_level == "DEBUG"


def test_startup_fails_on_an_unknown_log_level() -> None:
    with pytest.raises(ValidationError):
        Settings(log_level="chatty")


def test_startup_fails_on_an_out_of_range_session_ttl() -> None:
    with pytest.raises(ValidationError):
        Settings(session_ttl_hours=0)


@pytest.mark.parametrize(
    ("rate", "expected"),
    [("5/minute", (5, 60)), ("10/hour", (10, 3600)), (" 3 / second ", (3, 1))],
)
def test_login_rate_limit_is_parsed(rate: str, expected: tuple[int, int]) -> None:
    assert Settings(login_rate_limit=rate).login_attempts_per_window == expected


@pytest.mark.parametrize("rate", ["5", "five/minute", "0/minute", "5/fortnight"])
def test_startup_fails_on_a_malformed_login_rate_limit(rate: str) -> None:
    with pytest.raises(ValidationError):
        Settings(login_rate_limit=rate)


def test_production_refuses_to_send_the_session_cookie_over_plain_http() -> None:
    with pytest.raises(ValidationError, match="SESSION_COOKIE_SECURE"):
        Settings(app_env="production", session_cookie_secure=False)

    assert Settings(app_env="production", session_cookie_secure=True).is_production

import json

import pytest
import structlog.contextvars
from app.core.config import Settings
from app.core.logging import configure_logging, get_logger


def test_production_logs_are_json_and_include_the_request_id(
    settings: Settings,
    capsys: pytest.CaptureFixture[str],
) -> None:
    production = settings.model_copy(
        update={"app_env": "production", "session_cookie_secure": True},
    )
    configure_logging(production)
    structlog.contextvars.bind_contextvars(request_id="trace-123")

    get_logger("test").info("request.completed", status_code=200)

    output = capsys.readouterr().out
    payload = json.loads(output.strip().splitlines()[-1])
    assert payload["event"] == "request.completed"
    assert payload["request_id"] == "trace-123"
    assert payload["status_code"] == 200
    assert payload["level"] == "info"
    structlog.contextvars.clear_contextvars()

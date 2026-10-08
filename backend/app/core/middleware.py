"""Request tracing and baseline API security headers."""

import re
from time import perf_counter
from uuid import uuid4

import structlog.contextvars
from starlette.datastructures import Headers, MutableHeaders
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.errors import error_body
from app.core.logging import get_logger

REQUEST_ID_HEADER = "X-Request-ID"
_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")

_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
    "Content-Security-Policy": (
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; "
        "script-src 'self' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "img-src 'self' data: https://fastapi.tiangolo.com; connect-src 'self'"
    ),
}


class RequestContextMiddleware:
    def __init__(self, app: ASGIApp, *, enable_hsts: bool = False) -> None:
        self.app = app
        self.enable_hsts = enable_hsts

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = Headers(scope=scope)
        supplied_id = headers.get(REQUEST_ID_HEADER)
        request_id = (
            supplied_id
            if supplied_id is not None and _SAFE_REQUEST_ID.fullmatch(supplied_id)
            else uuid4().hex
        )
        method = scope.get("method", "")
        path = scope.get("path", "")
        started = perf_counter()
        status_code = 500

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        async def send_with_headers(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                response_headers = MutableHeaders(scope=message)
                response_headers[REQUEST_ID_HEADER] = request_id
                for name, value in _SECURITY_HEADERS.items():
                    response_headers[name] = value
                if self.enable_hsts:
                    response_headers["Strict-Transport-Security"] = (
                        "max-age=31536000; includeSubDomains"
                    )
            await send(message)

        try:
            await self.app(scope, receive, send_with_headers)
        except Exception:
            get_logger(__name__).exception(
                "request.failed",
                method=method,
                path=path,
                duration_ms=round((perf_counter() - started) * 1000, 2),
            )
            response = JSONResponse(
                status_code=500,
                content=error_body(
                    "InternalServerError",
                    "An unexpected error occurred.",
                ),
            )
            await response(scope, receive, send_with_headers)
        else:
            get_logger(__name__).info(
                "request.completed",
                method=method,
                path=path,
                status_code=status_code,
                duration_ms=round((perf_counter() - started) * 1000, 2),
            )
        finally:
            structlog.contextvars.clear_contextvars()

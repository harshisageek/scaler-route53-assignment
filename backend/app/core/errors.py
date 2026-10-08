"""A single error shape for the whole API.

Every failure, whether raised by us, by FastAPI's validation, or by an
unhandled exception, leaves the server as:

    {"error": {"code": ..., "message": ..., "details": ...}}

so the frontend needs exactly one piece of code to render errors.
"""

from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    """Base class for errors we raise deliberately, each with an HTTP status."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "BadRequest"

    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "NotFound"


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "Conflict"


class ValidationFailedError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
    code = "ValidationFailed"


class UnauthorizedError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "Unauthorized"


def error_body(code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details or {}}}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_body(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content=error_body(
                "ValidationFailed",
                "One or more fields are invalid.",
                {"fields": jsonable_encoder(exc.errors())},
            ),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = _STATUS_CODES.get(exc.status_code, "HttpError")
        return JSONResponse(
            status_code=exc.status_code,
            content=error_body(code, str(exc.detail)),
            headers=exc.headers,
        )


_STATUS_CODES: dict[int, str] = {
    status.HTTP_401_UNAUTHORIZED: "Unauthorized",
    status.HTTP_403_FORBIDDEN: "Forbidden",
    status.HTTP_404_NOT_FOUND: "NotFound",
    status.HTTP_405_METHOD_NOT_ALLOWED: "MethodNotAllowed",
    status.HTTP_409_CONFLICT: "Conflict",
    status.HTTP_413_CONTENT_TOO_LARGE: "PayloadTooLarge",
    status.HTTP_422_UNPROCESSABLE_CONTENT: "ValidationFailed",
    status.HTTP_429_TOO_MANY_REQUESTS: "TooManyRequests",
    status.HTTP_500_INTERNAL_SERVER_ERROR: "InternalServerError",
}

ErrorHandler = Callable[[Request, Exception], Awaitable[JSONResponse]]

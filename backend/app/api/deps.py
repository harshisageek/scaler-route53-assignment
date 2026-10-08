"""Dependencies shared by the API routes."""

from fastapi import Depends, Request, Response
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import UnauthorizedError
from app.db.session import get_db
from app.models import User
from app.services import auth
from app.services.login_throttle import LoginThrottle


def set_session_cookie(response: Response, settings: Settings, token: str) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.session_ttl_hours * 3600,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path="/",
    )


def get_login_throttle(request: Request) -> LoginThrottle:
    throttle: LoginThrottle = request.app.state.login_throttle
    return throttle


def get_current_user(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User:
    token = request.cookies.get(settings.session_cookie_name)
    active = auth.resolve_session(db, settings, token) if token else None
    if active is None:
        raise UnauthorizedError("Sign in to continue.", code="NotAuthenticated")
    if active.renewed and token:
        set_session_cookie(response, settings, token)
    return active.user

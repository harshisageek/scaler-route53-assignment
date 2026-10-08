from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import (
    clear_session_cookie,
    get_current_user,
    get_demo_throttle,
    get_login_throttle,
    get_sign_up_throttle,
    set_session_cookie,
)
from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.models import User
from app.schemas.auth import SignInRequest, SignUpRequest, UserOut
from app.services import auth, demo
from app.services.login_throttle import LoginThrottle

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/sign-up",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create an account and sign in",
)
def sign_up(
    body: SignUpRequest,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    throttle: LoginThrottle = Depends(get_sign_up_throttle),
) -> User:
    user = auth.sign_up(db, throttle, body.email, body.password)
    set_session_cookie(response, settings, auth.create_session(db, settings, user))
    return user


@router.post("/sign-in", response_model=UserOut, summary="Sign in with email and password")
def sign_in(
    body: SignInRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    throttle: LoginThrottle = Depends(get_login_throttle),
) -> User:
    client_address = request.client.host if request.client else "unknown"
    user = auth.sign_in(db, settings, throttle, body.email, body.password, client_address)
    set_session_cookie(response, settings, auth.create_session(db, settings, user))
    return user


@router.post("/demo", response_model=UserOut, summary="Sign in to a private demo account")
def sign_in_demo(
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    throttle: LoginThrottle = Depends(get_demo_throttle),
) -> User:
    user = demo.create_visitor_account(db, throttle)
    set_session_cookie(response, settings, auth.create_session(db, settings, user))
    return user


@router.post("/sign-out", status_code=status.HTTP_204_NO_CONTENT, summary="Sign out")
def sign_out(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> None:
    if token := request.cookies.get(settings.session_cookie_name):
        auth.sign_out(db, token)
    clear_session_cookie(response, settings)


@router.get("/me", response_model=UserOut, summary="The signed-in user")
def read_me(user: User = Depends(get_current_user)) -> User:
    return user

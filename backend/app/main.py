"""FastAPI application factory."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.api.v1.router import api_router
from app.core.config import Settings, get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging, get_logger
from app.core.middleware import RequestContextMiddleware
from app.db.session import create_db_engine
from app.services.demo import ensure_demo_account
from app.services.login_throttle import LoginThrottle

DESCRIPTION = """
A clone of the AWS Route 53 console: hosted zones and DNS records, with the
same workflows and validation rules as the real service. It stores records,
it does not answer DNS queries.
"""


def _seed_on_startup(settings: Settings) -> None:
    engine = create_db_engine(settings)
    try:
        with Session(engine) as db:
            user = ensure_demo_account(db, settings)
            reset_at = user.demo_data_reset_at
    finally:
        engine.dispose()
    get_logger(__name__).info(
        "demo.ready", data_reset_at=reset_at.isoformat() if reset_at else None
    )


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        if settings.seed_demo_data:
            _seed_on_startup(settings)
        yield

    app = FastAPI(
        title="Route 53 Clone API",
        description=DESCRIPTION,
        version="1.0.0",
        docs_url="/docs",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )
    app.state.login_throttle = LoginThrottle(*settings.login_attempts_per_window)
    app.state.sign_up_throttle = LoginThrottle(*settings.sign_ups_per_window)
    app.state.demo_throttle = LoginThrottle(*settings.demo_visitors_per_window)

    # Local development only: in production Next.js proxies /api/* so the
    # browser never makes a cross-origin request.
    if not settings.is_production:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_allowed_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # Added last so it wraps every response, including CORS preflight failures.
    app.add_middleware(RequestContextMiddleware, enable_hsts=settings.is_production)
    register_exception_handlers(app)
    app.include_router(api_router)

    get_logger(__name__).info("app.started", environment=settings.app_env)
    return app


app = create_app()

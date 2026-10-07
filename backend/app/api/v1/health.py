"""Liveness endpoint.

Also used by the scheduled keep-awake job, because the free hosting tier
sleeps after fifteen idle minutes.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    environment: str
    database: str


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Service and database health",
)
def read_health(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> HealthResponse:
    db.execute(text("SELECT 1"))
    return HealthResponse(status="ok", environment=settings.app_env, database="ok")

"""Every v1 route is mounted here, so main.py stays a one-liner."""

from fastapi import APIRouter

from app.api.v1 import auth, health, hosted_zones, record_sets

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(hosted_zones.router)
api_router.include_router(record_sets.router)

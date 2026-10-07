"""Application settings, read from the environment and validated at import time.

The app refuses to start when a setting is missing or malformed, so a bad
deployment fails immediately instead of halfway through the first request.
"""

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

Environment = Literal["development", "test", "production"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: Environment = "development"
    log_level: str = "INFO"

    database_url: str = "sqlite:///./data/route53.db"

    session_cookie_name: str = "r53_session"
    session_ttl_hours: int = Field(default=12, ge=1, le=720)
    session_cookie_secure: bool = False

    # Only used in local development, where the browser talks to the backend
    # directly. In production Next.js proxies /api/* so every request is same-origin.
    # NoDecode stops pydantic-settings from requiring JSON for this list in the env.
    cors_allowed_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000"]
    )

    login_rate_limit: str = "5/minute"
    max_import_bytes: int = Field(default=1_048_576, ge=1024)

    seed_demo_data: bool = True
    demo_user_email: str = "demo@route53-clone.dev"
    demo_user_password: str = "DemoPassw0rd!"
    demo_reset_interval_hours: int = Field(default=24, ge=1)

    @field_validator("cors_allowed_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        """Accept a comma-separated string, which is how hosting dashboards store lists."""
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("log_level")
    @classmethod
    def _valid_log_level(cls, value: str) -> str:
        allowed = {"CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"}
        upper = value.upper()
        if upper not in allowed:
            raise ValueError(f"log_level must be one of {sorted(allowed)}")
        return upper

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()

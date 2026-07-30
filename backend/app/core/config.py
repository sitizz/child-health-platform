from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: Literal["development", "staging", "production"] = "development"
    app_name: str = "Child Guard API"
    app_version: str = "1.0.0"
    log_level: str = "INFO"

    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["*"]
    )
    api_key: str | None = None
    rate_limit: str = "60/minute"

    database_url: str = (
        "postgresql+asyncpg://childguard:childguard@localhost:5432/childguard"
    )
    redis_url: str | None = "redis://localhost:6379/0"

    jwt_secret: str = "dev-only-change-me-use-openssl-rand-hex-32"
    jwt_algorithm: str = "HS256"
    jwt_access_ttl_min: int = 60
    jwt_refresh_ttl_days: int = 7

    cache_ttl_seconds: int = 300
    open_meteo_timeout_seconds: float = 5.0
    open_meteo_api_key: str | None = None
    open_meteo_forecast_url: str = "https://api.open-meteo.com/v1/forecast"
    open_meteo_air_url: str = "https://air-quality-api.open-meteo.com/v1/air-quality"

    enable_docs: bool | None = None
    model_version: str = "env-risk-heuristic-v2"
    disclaimer: str = (
        "Child Guard Health provides environmental health guidance and is not "
        "intended to diagnose, treat, or replace professional medical advice. "
        "Users should seek advice from qualified healthcare professionals for "
        "medical concerns."
    )
    disclaimer_version: str = "disclaimer-v1"
    consent_version: str = "consent-v1"
    privacy_policy_url: str = "https://child-health-platform.onrender.com/privacy"
    terms_url: str = "https://child-health-platform.onrender.com/terms"

    expo_access_token: str | None = None
    expo_push_url: str = "https://exp.host/--/api/v2/push/send"
    notification_cooldown_minutes: int = 180
    max_children_per_caregiver: int = 10

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> object:
        if isinstance(value, str):
            items = [item.strip() for item in value.split(",") if item.strip()]
            return items or ["*"]
        return value

    @field_validator(
        "api_key",
        "expo_access_token",
        "redis_url",
        "open_meteo_api_key",
        mode="before",
    )
    @classmethod
    def empty_str_as_none(cls, value: object) -> object:
        if value == "":
            return None
        return value

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def resolved_open_meteo_forecast_url(self) -> str:
        if self.open_meteo_api_key and "customer-" not in self.open_meteo_forecast_url:
            return "https://customer-api.open-meteo.com/v1/forecast"
        return self.open_meteo_forecast_url

    @property
    def resolved_open_meteo_air_url(self) -> str:
        if self.open_meteo_api_key and "customer-" not in self.open_meteo_air_url:
            return "https://customer-air-quality-api.open-meteo.com/v1/air-quality"
        return self.open_meteo_air_url

    @property
    def docs_enabled(self) -> bool:
        if self.enable_docs is not None:
            return self.enable_docs
        return not self.is_production

    @property
    def api_key_required(self) -> bool:
        return bool(self.api_key) or self.is_production


@lru_cache
def get_settings() -> Settings:
    return Settings()

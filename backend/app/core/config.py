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

    # NoDecode: allow comma-separated env values like "*" or "http://a,http://b"
    # instead of requiring JSON lists.
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["*"]
    )
    api_key: str | None = None
    rate_limit: str = "60/minute"

    cache_ttl_seconds: int = 300
    redis_url: str | None = None

    open_meteo_timeout_seconds: float = 5.0
    open_meteo_forecast_url: str = "https://api.open-meteo.com/v1/forecast"
    open_meteo_air_url: str = "https://air-quality-api.open-meteo.com/v1/air-quality"

    enable_docs: bool | None = None
    model_version: str = "env-risk-heuristic-v1"
    disclaimer: str = (
        "Child Guard provides environmental risk guidance based on weather, "
        "air quality, rainfall, and child profile information. It does not "
        "diagnose, treat, or replace medical advice."
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> object:
        if isinstance(value, str):
            items = [item.strip() for item in value.split(",") if item.strip()]
            return items or ["*"]
        return value

    @field_validator("api_key", mode="before")
    @classmethod
    def empty_api_key_as_none(cls, value: object) -> object:
        if value == "":
            return None
        return value

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

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

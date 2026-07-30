from __future__ import annotations

import asyncio
from typing import Any

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

from app.core.config import Settings
from app.core.errors import UpstreamServiceError
from app.core.logging import get_logger
from app.domain.scoring import EnvironmentObservation

logger = get_logger(__name__)


class OpenMeteoClient:
    def __init__(self, client: httpx.AsyncClient, settings: Settings) -> None:
        self._client = client
        self._settings = settings

    def _with_api_key(self, params: dict[str, Any]) -> dict[str, Any]:
        if self._settings.open_meteo_api_key:
            return {**params, "apikey": self._settings.open_meteo_api_key}
        return params

    @retry(
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.TransportError)),
        stop=stop_after_attempt(3),
        wait=wait_exponential_jitter(initial=0.2, max=2.0),
        reraise=True,
    )
    async def _get(self, url: str, params: dict[str, Any]) -> dict[str, Any]:
        response = await self._client.get(url, params=self._with_api_key(params))
        response.raise_for_status()
        return response.json()

    async def fetch_observation(self, lat: float, lon: float) -> EnvironmentObservation:
        weather_params = {
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,relative_humidity_2m,precipitation",
            "daily": "temperature_2m_max,precipitation_sum",
            "forecast_days": 7,
        }
        air_params = {
            "latitude": lat,
            "longitude": lon,
            "current": "us_aqi,pm2_5,pm10",
        }

        try:
            weather, air = await asyncio.gather(
                self._get(
                    self._settings.resolved_open_meteo_forecast_url, weather_params
                ),
                self._get(self._settings.resolved_open_meteo_air_url, air_params),
            )
        except httpx.HTTPStatusError as exc:
            logger.error(
                "open_meteo_http_error",
                status_code=exc.response.status_code,
                url=str(exc.request.url),
            )
            raise UpstreamServiceError(
                "Weather upstream returned an error",
                details={"status_code": exc.response.status_code},
            ) from exc
        except httpx.HTTPError as exc:
            logger.error("open_meteo_transport_error", error=str(exc))
            raise UpstreamServiceError(
                "Weather upstream is unavailable",
                details={"reason": str(exc)},
            ) from exc

        try:
            current = weather["current"]
            daily = weather["daily"]
            air_current = air["current"]
            return EnvironmentObservation(
                temperature=float(current["temperature_2m"]),
                humidity=float(current["relative_humidity_2m"]),
                rainfall=float(current["precipitation"]),
                aqi=_optional_float(air_current.get("us_aqi")),
                pm2_5=_optional_float(air_current.get("pm2_5")),
                pm10=_optional_float(air_current.get("pm10")),
                daily_temp_max=[float(v) for v in daily["temperature_2m_max"]],
                daily_rain=[float(v) for v in daily["precipitation_sum"]],
            )
        except (KeyError, TypeError, ValueError) as exc:
            logger.error("open_meteo_parse_error", error=str(exc))
            raise UpstreamServiceError(
                "Weather upstream returned an unexpected payload",
                details={"reason": str(exc)},
            ) from exc

    async def ping(self) -> bool:
        try:
            response = await self._client.get(
                self._settings.resolved_open_meteo_forecast_url,
                params=self._with_api_key(
                    {
                        "latitude": 0,
                        "longitude": 0,
                        "current": "temperature_2m",
                    }
                ),
            )
            return response.status_code < 500
        except httpx.HTTPError:
            return False


def _optional_float(value: Any) -> float | None:
    if value is None:
        return None
    return float(value)

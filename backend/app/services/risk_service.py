from __future__ import annotations

from app.clients.open_meteo import OpenMeteoClient
from app.core.config import Settings
from app.core.logging import get_logger
from app.domain.recommendations import (
    build_action_message,
    build_escalation,
    build_guidance,
    build_recommended_actions,
    build_trend,
)
from app.domain.scoring import ChildFactors, assess_risks
from app.ml.llm_communicator import LLMCommunicator
from app.ml.symptom_classifier import predict_triage
from app.ml.text_simplifier import simplify_list, simplify_text
from app.schemas.risk import (
    BatchLocation,
    BatchRiskItem,
    BatchRiskRequest,
    BatchRiskResponse,
    ChildVulnerability,
    DomainLabels,
    DomainRisks,
    EnvironmentMetrics,
    EnvironmentRiskResponse,
    Escalation,
    ForecastDay,
    Guidance,
    MLPredictionSummary,
    PredictiveDomains,
    RecommendedAction,
    RiskQueryParams,
    RiskReasons,
    SimplifiedActions,
    StakeholderGuidance,
    Trend,
)
from app.schemas.common import Location
from app.services.cache import CacheBackend, geohash_cache_key

logger = get_logger(__name__)


class RiskService:
    def __init__(
        self,
        open_meteo: OpenMeteoClient,
        cache: CacheBackend,
        settings: Settings,
        llm: LLMCommunicator | None = None,
    ) -> None:
        self._open_meteo = open_meteo
        self._cache = cache
        self._settings = settings
        self._llm = llm

    async def evaluate(self, query: RiskQueryParams) -> EnvironmentRiskResponse:
        factors = ChildFactors(
            age_group=query.age_group,
            asthma=query.asthma,
            fever=query.fever,
            cough=query.cough,
            dehydration=query.dehydration,
            mosquito_exposure=query.mosquito_exposure,
            flood_exposure=query.flood_exposure,
        )

        obs = await self._get_observation(query.lat, query.lon)
        assessment = assess_risks(obs, factors)
        recommended = build_recommended_actions(assessment, factors)
        trend = build_trend(assessment.forecast)
        escalation = build_escalation(assessment.forecast)
        guidance = build_guidance(assessment, factors)

        risks = DomainRisks(
            heat_stress=assessment.heat.level,
            respiratory=assessment.respiratory.level,
            dengue=assessment.dengue.level,
            flood=assessment.flood.level,
        )
        ml = predict_triage(
            age_group=query.age_group,
            asthma=query.asthma,
            fever=query.fever,
            cough=query.cough,
            dehydration=query.dehydration,
            mosquito_exposure=query.mosquito_exposure,
            flood_exposure=query.flood_exposure,
            temperature=obs.temperature,
            humidity=obs.humidity,
            rainfall=obs.rainfall,
            aqi=obs.aqi,
            pm2_5=obs.pm2_5,
            pm10=obs.pm10,
        )
        action_text = build_action_message(assessment.priority_alert)
        if self._llm is not None:
            simplified_raw = await self._llm.simplify_risk_actions(
                summary=action_text,
                immediate=recommended.immediate,
                when_to_escalate=recommended.when_to_escalate,
                language="en",
            )
        else:
            simplified_immediate = simplify_list(recommended.immediate)
            simplified_escalate = simplify_list(recommended.when_to_escalate)
            simplified_action = simplify_text(action_text)
            grades = [
                simplify_text(item).flesch_kincaid_grade
                for item in [
                    *recommended.immediate,
                    *recommended.when_to_escalate,
                    action_text,
                ]
            ]
            simplified_raw = {
                "summary": simplified_action.simplified,
                "immediate": simplified_immediate,
                "when_to_escalate": simplified_escalate,
                "average_flesch_kincaid_grade": (
                    round(sum(grades) / len(grades), 2) if grades else None
                ),
                "source": "rules",
                "llm_model": None,
            }

        return EnvironmentRiskResponse(
            location=Location(lat=query.lat, lon=query.lon),
            age_group=query.age_group,
            environment=EnvironmentMetrics(
                temperature=obs.temperature,
                humidity=obs.humidity,
                rainfall=obs.rainfall,
                aqi=obs.aqi,
                pm2_5=obs.pm2_5,
                pm10=obs.pm10,
            ),
            risks=risks,
            risk_reasons=RiskReasons(
                heat_stress=assessment.heat.reasons,
                respiratory=assessment.respiratory.reasons,
                dengue=assessment.dengue.reasons,
                flood=assessment.flood.reasons,
            ),
            child_vulnerability=ChildVulnerability(
                level=assessment.vulnerability.level,
                reasons=assessment.vulnerability.reasons,
            ),
            predictive_domains=PredictiveDomains(
                heat_stress=assessment.predictive_heat.level,
                respiratory=assessment.predictive_respiratory.level,
                dengue=assessment.predictive_dengue.level,
                flood=assessment.predictive_flood.level,
            ),
            priority_alert=assessment.priority_alert,
            forecast=[
                ForecastDay(
                    day=day.day,
                    max_temperature=day.max_temperature,
                    rainfall=day.rainfall,
                    predicted_risk=day.predicted_risk,
                )
                for day in assessment.forecast
            ],
            action=action_text,
            recommended_action=RecommendedAction(
                immediate=recommended.immediate,
                caregiver=recommended.caregiver,
                school=recommended.school,
                community=recommended.community,
                when_to_escalate=recommended.when_to_escalate,
            ),
            trend=Trend(direction=trend.direction, message=trend.message),
            escalation=Escalation(level=escalation.level, reason=escalation.reason),
            guidance=Guidance(
                group=query.age_group,
                summary=guidance.summary,
                key_points=guidance.key_points,
            ),
            stakeholder_guidance=StakeholderGuidance(
                caregiver=guidance.caregiver,
                school=guidance.school,
                community=guidance.community,
            ),
            domain_labels=DomainLabels(),
            model_version=self._settings.model_version,
            disclaimer=self._settings.disclaimer,
            ml_prediction=MLPredictionSummary(
                predicted_domain=ml.predicted_domain,
                confidence=ml.confidence,
                agrees_with_engine=ml.agrees_with_engine,
                engine_primary_domain=ml.engine_primary_domain,
                model_version=ml.model_version,
                note=ml.note,
            ),
            simplified=SimplifiedActions(
                summary=simplified_raw["summary"],
                immediate=simplified_raw["immediate"],
                when_to_escalate=simplified_raw["when_to_escalate"],
                average_flesch_kincaid_grade=simplified_raw.get(
                    "average_flesch_kincaid_grade"
                ),
                source=simplified_raw.get("source", "rules"),
                llm_model=simplified_raw.get("llm_model"),
            ),
            language="en",
        )

    async def evaluate_batch(self, request: BatchRiskRequest) -> BatchRiskResponse:
        results: list[BatchRiskItem] = []
        for location in request.locations:
            item = await self._evaluate_batch_item(location, request)
            results.append(item)
        return BatchRiskResponse(
            results=results,
            model_version=self._settings.model_version,
        )

    async def _evaluate_batch_item(
        self, location: BatchLocation, request: BatchRiskRequest
    ) -> BatchRiskItem:
        try:
            query = RiskQueryParams(
                lat=location.lat,
                lon=location.lon,
                age_group=request.age_group,
                asthma=request.asthma,
                fever=request.fever,
                cough=request.cough,
                dehydration=request.dehydration,
                mosquito_exposure=request.mosquito_exposure,
                flood_exposure=request.flood_exposure,
            )
            result = await self.evaluate(query)
            return BatchRiskItem(id=location.id, result=result)
        except Exception as exc:
            logger.warning(
                "batch_item_failed",
                lat=location.lat,
                lon=location.lon,
                error=str(exc),
            )
            return BatchRiskItem(id=location.id, error=str(exc))

    async def _get_observation(self, lat: float, lon: float):
        cache_key = geohash_cache_key(lat, lon)
        cached = await self._cache.get(cache_key)
        if cached:
            logger.info("cache_hit", key=cache_key)
            from app.domain.scoring import EnvironmentObservation

            return EnvironmentObservation(**cached)

        logger.info("cache_miss", key=cache_key)
        obs = await self._open_meteo.fetch_observation(lat, lon)
        await self._cache.set(
            cache_key,
            {
                "temperature": obs.temperature,
                "humidity": obs.humidity,
                "rainfall": obs.rainfall,
                "aqi": obs.aqi,
                "pm2_5": obs.pm2_5,
                "pm10": obs.pm10,
                "daily_temp_max": obs.daily_temp_max,
                "daily_rain": obs.daily_rain,
            },
            self._settings.cache_ttl_seconds,
        )
        return obs

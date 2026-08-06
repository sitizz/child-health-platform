from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.open_meteo import OpenMeteoClient
from app.core.config import Settings
from app.domain.ai_engine import age_to_group, build_explainable_recommendation
from app.ml.i18n import parse_accept_language, translate_key
from app.ml.llm_communicator import LLMCommunicator
from app.ml.symptom_classifier import predict_triage
from app.models.assessment import RiskAssessment
from app.schemas.ml import MLPredictionResult, SimplifiedRecommendation
from app.schemas.recommendation import (
    RecommendationEvaluateRequest,
    RecommendationResult,
)
from app.services.child_service import ChildService


class RecommendationService:
    def __init__(
        self,
        db: AsyncSession,
        settings: Settings,
        open_meteo: OpenMeteoClient,
        llm: LLMCommunicator | None = None,
    ) -> None:
        self.db = db
        self.settings = settings
        self.open_meteo = open_meteo
        self.llm = llm
        self.children = ChildService(db, settings)

    async def evaluate(
        self,
        caregiver_id: UUID | None,
        payload: RecommendationEvaluateRequest,
        *,
        persist: bool = True,
        accept_language: str | None = None,
    ) -> RecommendationResult:
        age = payload.age
        conditions = payload.conditions
        allergies = payload.allergies
        symptoms = payload.symptoms
        exposures = payload.exposures
        child_id = payload.child_id
        language = payload.language or parse_accept_language(accept_language)

        if child_id is not None:
            if caregiver_id is None:
                raise HTTPException(status_code=401, detail="Authentication required")
            child = await self.children.get(caregiver_id, child_id)
            age = child.age
            conditions = child.conditions or {}
            allergies = child.allergies or {}
            symptoms = child.symptoms or {}
            exposures = child.exposures or {}

        if age is None:
            raise HTTPException(status_code=422, detail="age is required")

        obs = await self.open_meteo.fetch_observation(payload.lat, payload.lon)
        result = build_explainable_recommendation(
            obs,
            age=age,
            conditions=conditions,
            allergies=allergies,
            symptoms=symptoms,
            exposures=exposures,
        )

        risks = {
            "heat_stress": result.assessment.heat.level,
            "respiratory": result.assessment.respiratory.level,
            "dengue": result.assessment.dengue.level,
            "flood": result.assessment.flood.level,
        }
        age_group = age_to_group(age)
        ml = predict_triage(
            age_group=age_group,
            asthma=bool(
                conditions.get("asthma") or conditions.get("history_of_asthma")
            ),
            fever=bool(symptoms.get("fever")),
            cough=bool(symptoms.get("cough") or symptoms.get("wheezing")),
            dehydration=bool(
                symptoms.get("dehydration")
                or symptoms.get("signs_of_dehydration")
                or symptoms.get("reduced_fluid_intake")
            ),
            mosquito_exposure=bool(exposures.get("mosquito_exposure")),
            flood_exposure=bool(
                exposures.get("floodwater") or exposures.get("flood_exposure")
            ),
            temperature=obs.temperature,
            humidity=obs.humidity,
            rainfall=obs.rainfall,
            aqi=obs.aqi,
            pm2_5=obs.pm2_5,
            pm10=obs.pm10,
        )
        note_key = "ml.agrees" if ml.agrees_with_engine else "ml.differs"
        ml_prediction = MLPredictionResult(
            predicted_domain=ml.predicted_domain,
            confidence=ml.confidence,
            agrees_with_engine=ml.agrees_with_engine,
            engine_primary_domain=ml.engine_primary_domain,
            probabilities=ml.probabilities,
            model_version=ml.model_version,
            note=translate_key(note_key, language),
        )

        if self.llm is not None:
            simplified_raw = await self.llm.simplify_recommendation_bundle(
                why=result.why,
                priority_actions=result.priority_actions,
                secondary_actions=result.secondary_actions,
                monitoring_advice=result.monitoring_advice,
                escalation_advice=result.escalation_advice,
                language=language,
            )
        else:
            from app.ml.text_simplifier import simplify_recommendation_bundle

            simplified_raw = simplify_recommendation_bundle(
                why=result.why,
                priority_actions=result.priority_actions,
                secondary_actions=result.secondary_actions,
                monitoring_advice=result.monitoring_advice,
                escalation_advice=result.escalation_advice,
            )
            simplified_raw["source"] = "rules"
            simplified_raw["llm_model"] = None
        simplified = SimplifiedRecommendation(**simplified_raw)

        assessment_id = None
        if persist and child_id is not None:
            row = RiskAssessment(
                id=uuid4(),
                child_id=child_id,
                lat=payload.lat,
                lon=payload.lon,
                priority=result.overall_risk,
                summary={
                    "primary_hazards": result.primary_hazards,
                    "why": result.why,
                    "environmental_factors": result.environmental_factors,
                    "child_factors": result.child_factors,
                    "priority_actions": result.priority_actions,
                    "secondary_actions": result.secondary_actions,
                    "monitoring_advice": result.monitoring_advice,
                    "escalation_advice": result.escalation_advice,
                    "data_completeness": result.data_completeness,
                    "model_version": self.settings.model_version,
                    "ml_prediction": ml_prediction.model_dump(),
                    "simplified": simplified.model_dump(),
                    "language": language,
                    "environment": {
                        "temperature": obs.temperature,
                        "humidity": obs.humidity,
                        "rainfall": obs.rainfall,
                        "aqi": obs.aqi,
                        "pm2_5": obs.pm2_5,
                        "pm10": obs.pm10,
                    },
                    "risks": risks,
                },
            )
            self.db.add(row)
            await self.db.commit()
            await self.db.refresh(row)
            assessment_id = row.id

        return RecommendationResult(
            overall_risk=result.overall_risk,
            primary_hazards=result.primary_hazards,
            explanation={
                "why": result.why,
                "environmental_factors": result.environmental_factors,
                "child_factors": result.child_factors,
            },
            priority_actions=result.priority_actions,
            secondary_actions=result.secondary_actions,
            monitoring_advice=result.monitoring_advice,
            escalation_advice=result.escalation_advice,
            disclaimer=self.settings.disclaimer,
            model_version=self.settings.model_version,
            data_completeness=result.data_completeness,
            environment={
                "temperature": obs.temperature,
                "humidity": obs.humidity,
                "rainfall": obs.rainfall,
                "aqi": obs.aqi,
                "pm2_5": obs.pm2_5,
                "pm10": obs.pm10,
            },
            risks=risks,
            child_id=child_id,
            assessment_id=assessment_id,
            ml_prediction=ml_prediction,
            simplified=simplified,
            language=language,
        )

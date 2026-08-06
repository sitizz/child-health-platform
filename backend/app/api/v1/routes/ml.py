from fastapi import APIRouter, Depends, Header, Query, Request, Response, status

from app.api.deps import require_api_key
from app.core.config import Settings, get_settings
from app.ml.i18n import SUPPORTED_LANGUAGES, parse_accept_language, translate_key
from app.ml.symptom_classifier import MODEL_VERSION, get_classifier, predict_triage
from app.ml.training_data import FEATURE_NAMES, RISK_DOMAINS
from app.ml.audio.schemas import AudioAnalysisRequest, AudioAnalysisResponse
from app.ml.vision.schemas import ImageAnalysisRequest, ImageAnalysisResponse
from app.schemas.ml import (
    MLPredictRequest,
    MLPredictResponse,
    MLPredictionResult,
    MLStatusResponse,
)

router = APIRouter(prefix="/ml", tags=["Machine Learning"])


@router.get(
    "/status",
    response_model=MLStatusResponse,
    summary="ML module status",
)
async def ml_status(
    settings: Settings = Depends(get_settings),
    _: None = Depends(require_api_key),
) -> MLStatusResponse:
    get_classifier()  # ensure model is loaded (trains on first use if missing)
    return MLStatusResponse(
        classifier_loaded=True,
        classifier_version=MODEL_VERSION,
        feature_names=FEATURE_NAMES,
        risk_domains=RISK_DOMAINS,
        supported_languages=list(SUPPORTED_LANGUAGES),
        llm_enabled=bool(settings.gemini_api_key),
        llm_provider="gemini",
        llm_model=settings.gemini_model if settings.gemini_api_key else None,
    )


@router.post(
    "/predict",
    response_model=MLPredictResponse,
    summary="Symptom triage ML prediction",
)
async def ml_predict(
    payload: MLPredictRequest,
    settings: Settings = Depends(get_settings),
    _: None = Depends(require_api_key),
    accept_language: str | None = Header(default=None, alias="Accept-Language"),
    language: str | None = Query(
        default=None,
        description="Override language (en, ms, ur, id)",
    ),
) -> MLPredictResponse:
    lang = language or parse_accept_language(accept_language)
    prediction = predict_triage(
        age_group=payload.age_group,
        asthma=payload.asthma,
        fever=payload.fever,
        cough=payload.cough,
        dehydration=payload.dehydration,
        mosquito_exposure=payload.mosquito_exposure,
        flood_exposure=payload.flood_exposure,
        temperature=payload.temperature,
        humidity=payload.humidity,
        rainfall=payload.rainfall,
        aqi=payload.aqi,
        pm2_5=payload.pm2_5,
        pm10=payload.pm10,
        engine_primary_domain=payload.engine_primary_domain,
    )
    note_key = "ml.agrees" if prediction.agrees_with_engine else "ml.differs"
    return MLPredictResponse(
        prediction=MLPredictionResult(
            predicted_domain=prediction.predicted_domain,
            confidence=prediction.confidence,
            agrees_with_engine=prediction.agrees_with_engine,
            engine_primary_domain=prediction.engine_primary_domain,
            probabilities=prediction.probabilities,
            model_version=prediction.model_version,
            note=translate_key(note_key, lang),
        ),
        disclaimer=translate_key("ml.disclaimer", lang),
    )


@router.post(
    "/vision/analyze",
    response_model=ImageAnalysisResponse,
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
    summary="Vision analysis (planned)",
)
async def vision_analyze(
    payload: ImageAnalysisRequest,
    response: Response,
    _: None = Depends(require_api_key),
    accept_language: str | None = Header(default=None, alias="Accept-Language"),
    language: str | None = Query(default=None),
) -> ImageAnalysisResponse:
    lang = language or parse_accept_language(accept_language)
    response.status_code = status.HTTP_501_NOT_IMPLEMENTED
    return ImageAnalysisResponse(
        message=translate_key("vision.coming_soon", lang),
        analysis_type=payload.analysis_type,
        planned_capabilities=[
            "wound classification",
            "rash classification",
            "nutrition photo guidance",
        ],
    )


@router.post(
    "/audio/analyze",
    response_model=AudioAnalysisResponse,
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
    summary="Audio analysis (planned)",
)
async def audio_analyze(
    payload: AudioAnalysisRequest,
    response: Response,
    _: None = Depends(require_api_key),
    accept_language: str | None = Header(default=None, alias="Accept-Language"),
    language: str | None = Query(default=None),
) -> AudioAnalysisResponse:
    lang = language or parse_accept_language(accept_language)
    response.status_code = status.HTTP_501_NOT_IMPLEMENTED
    return AudioAnalysisResponse(
        message=translate_key("audio.coming_soon", lang),
        planned_capabilities=[
            "cough type classification (dry / wet / allergic)",
            "caregiver guidance from cough cues",
        ],
    )


@router.get(
    "/languages",
    summary="Supported languages",
)
async def list_languages(
    request: Request,
    _: None = Depends(require_api_key),
) -> dict[str, object]:
    negotiated = getattr(request.state, "language", DEFAULT_FALLBACK)
    return {
        "supported": list(SUPPORTED_LANGUAGES),
        "default": "en",
        "negotiated": negotiated,
    }


DEFAULT_FALLBACK = "en"

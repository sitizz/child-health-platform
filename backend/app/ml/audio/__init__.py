"""Audio analysis module (roadmap).

Planned: cough sound classification (dry / wet / allergic).
Not implemented yet — API returns 501 until a trained audio model is added.
"""

from app.ml.audio.schemas import AudioAnalysisRequest, AudioAnalysisResponse

__all__ = ["AudioAnalysisRequest", "AudioAnalysisResponse"]

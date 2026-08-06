"""Vision analysis module (roadmap).

Planned: wound/rash image classification and food/nutrition photo guidance.
Not implemented yet — API returns 501 until a trained vision model is added.
"""

from app.ml.vision.schemas import ImageAnalysisRequest, ImageAnalysisResponse

__all__ = ["ImageAnalysisRequest", "ImageAnalysisResponse"]

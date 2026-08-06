"""Language negotiation and translation key structure.

English is fully populated. Other locales are scaffolded for future LLM/local
translation fills (Bahasa Melayu, Urdu, etc.).
"""

from __future__ import annotations

from typing import Literal

SupportedLanguage = Literal["en", "ms", "ur", "id"]

SUPPORTED_LANGUAGES: tuple[str, ...] = ("en", "ms", "ur", "id")

DEFAULT_LANGUAGE: SupportedLanguage = "en"

# Translation key structure — English populated; others fall back to English.
TRANSLATIONS: dict[str, dict[str, str]] = {
    "en": {
        "ml.disclaimer": (
            "ML predictions augment guidance and do not replace the "
            "deterministic risk engine or professional medical advice."
        ),
        "ml.agrees": "ML triage agrees with the deterministic engine.",
        "ml.differs": (
            "ML triage differs from the deterministic engine; "
            "engine remains the decision-maker."
        ),
        "vision.coming_soon": (
            "Vision analysis is planned but not yet available. "
            "Camera-based wound/rash/nutrition guidance is on the roadmap."
        ),
        "audio.coming_soon": (
            "Audio analysis is planned but not yet available. "
            "Cough-sound classification is on the roadmap."
        ),
        "risk.summary_prefix": "Overall environmental health risk",
    },
    "ms": {
        # Bahasa Melayu — scaffold (falls back to English when missing)
        "ml.disclaimer": (
            "Ramalan ML menambah panduan dan tidak menggantikan enjin risiko "
            "deterministik atau nasihat perubatan profesional."
        ),
    },
    "ur": {
        # Urdu — scaffold
    },
    "id": {
        # Bahasa Indonesia — scaffold
    },
}


def default_language() -> str:
    return DEFAULT_LANGUAGE


def parse_accept_language(header: str | None) -> str:
    """Parse Accept-Language header into a supported language code."""
    if not header:
        return DEFAULT_LANGUAGE
    # Example: "ms-MY,ms;q=0.9,en;q=0.8"
    candidates: list[tuple[str, float]] = []
    for part in header.split(","):
        piece = part.strip()
        if not piece:
            continue
        lang_tag, _, rest = piece.partition(";")
        lang = lang_tag.strip().lower().replace("_", "-")
        primary = lang.split("-", 1)[0]
        q = 1.0
        if rest.startswith("q="):
            try:
                q = float(rest[2:])
            except ValueError:
                q = 0.0
        candidates.append((primary, q))
    candidates.sort(key=lambda item: item[1], reverse=True)
    for primary, _ in candidates:
        if primary in SUPPORTED_LANGUAGES:
            return primary
    return DEFAULT_LANGUAGE


def translate_key(key: str, language: str | None = None) -> str:
    lang = language if language in SUPPORTED_LANGUAGES else DEFAULT_LANGUAGE
    if key in TRANSLATIONS.get(lang, {}):
        return TRANSLATIONS[lang][key]
    return TRANSLATIONS[DEFAULT_LANGUAGE].get(key, key)

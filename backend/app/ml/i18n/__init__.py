"""Lightweight multilingual support skeleton."""

from app.ml.i18n.languages import (
    SUPPORTED_LANGUAGES,
    default_language,
    parse_accept_language,
    translate_key,
)

__all__ = [
    "SUPPORTED_LANGUAGES",
    "default_language",
    "parse_accept_language",
    "translate_key",
]

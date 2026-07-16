"""ASGI entrypoint for local runs and hosts that expect `main:app`."""

from app.main import app

__all__ = ["app"]

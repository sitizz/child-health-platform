import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging import get_logger
from app.ml.i18n import parse_accept_language

logger = get_logger(__name__)


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        language = parse_accept_language(request.headers.get("Accept-Language"))
        request.state.request_id = request_id
        request.state.language = language
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        response.headers["Content-Language"] = language
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Frame-Options"] = "DENY"
        return response

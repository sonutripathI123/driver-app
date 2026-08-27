import time
from collections import defaultdict
from typing import Dict, List, Tuple
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from app.core.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Appends OWASP recommended HTTP Security Response Headers to every outgoing response.
    """
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)

        if settings.ENABLE_SECURITY_HEADERS:
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["X-XSS-Protection"] = "1; mode=block"
            response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none';"
            )
            response.headers["Permissions-Policy"] = "geolocation=(self), microphone=(), camera=()"

            if not settings.DEBUG:
                response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

        return response


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """
    In-Memory sliding window rate limiter protecting against brute-force and DoS floods.
    Tracks requests per client IP with distinct threshold for authentication endpoints.
    """
    def __init__(self, app):
        super().__init__(app)
        # Store IP -> list of request timestamps
        self.general_requests: Dict[str, List[float]] = defaultdict(list)
        self.auth_requests: Dict[str, List[float]] = defaultdict(list)

    def _get_client_ip(self, request: Request) -> str:
        # Check X-Forwarded-For if behind reverse proxy
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "127.0.0.1"

    def _is_rate_limited(self, ip: str, is_auth: bool) -> Tuple[bool, int, int]:
        now = time.time()
        window_seconds = 60.0
        limit = settings.AUTH_RATE_LIMIT_PER_MINUTE if is_auth else settings.RATE_LIMIT_REQUESTS_PER_MINUTE
        req_store = self.auth_requests if is_auth else self.general_requests

        # Filter timestamps outside 60s sliding window
        valid_timestamps = [t for t in req_store[ip] if (now - t) < window_seconds]
        req_store[ip] = valid_timestamps

        if len(valid_timestamps) >= limit:
            oldest = valid_timestamps[0]
            retry_after = int(window_seconds - (now - oldest)) + 1
            return True, limit, retry_after

        # Record this request
        req_store[ip].append(now)
        remaining = max(0, limit - len(req_store[ip]))
        return False, limit, remaining

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if not settings.RATE_LIMIT_ENABLED:
            return await call_next(request)

        # Exclude static docs and health checks from rate limiting
        path = request.url.path
        if path in ("/health", "/api/health", "/docs", "/redoc", f"{settings.API_V1_STR}/openapi.json"):
            return await call_next(request)

        client_ip = self._get_client_ip(request)
        is_auth = path.startswith(f"{settings.API_V1_STR}/auth/login") or path.startswith(f"{settings.API_V1_STR}/auth/register")

        is_limited, limit, val = self._is_rate_limited(client_ip, is_auth)

        if is_limited:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Rate limit exceeded. Please slow down your requests.",
                    "retry_after_seconds": val
                },
                headers={
                    "Retry-After": str(val),
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0"
                }
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(val)
        return response

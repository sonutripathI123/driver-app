import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import AsyncSessionLocal, engine, init_db
from app.core.security_middleware import RateLimiterMiddleware, SecurityHeadersMiddleware
from app.services.auth_service import AuthService

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize DB and seed default administrator
    await init_db()
    async with AsyncSessionLocal() as session:
        try:
            await AuthService.seed_default_admin(session)
        except Exception as e:
            logger.warning(f"[Startup Warning] Could not seed admin: {e}")

    yield

    # Shutdown: Dispose engine connections
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Enterprise Chauffeur Booking, Operations, Dispatch, Driver, CRM, Payment, Automation, Accounting & Reporting Platform",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan
)

# 1. OWASP HTTP Security Headers
app.add_middleware(SecurityHeadersMiddleware)

# 2. In-Memory Sliding Window Rate Limiter
app.add_middleware(RateLimiterMiddleware)

# 3. CORS Policy
origins = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else [settings.CORS_ORIGINS]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining", "Content-Disposition"]
)


# Global Sanitized Error Handler for Unhandled Exceptions
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled Exception at {request.method} {request.url.path}: {exc}", exc_info=True)
    if settings.DEBUG:
        detail = str(exc)
    else:
        detail = "An internal server error occurred. Please contact system support."

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": detail}
    )


# Global Health Check Endpoints
@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "version": "1.0.0"
    }


# Mount API v1 Routers
app.include_router(api_router, prefix=settings.API_V1_STR)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )

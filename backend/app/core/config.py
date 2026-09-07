import os
from typing import List, Optional, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    PROJECT_NAME: str = "Chauffeur Operations Platform"
    API_V1_STR: str = "/api/v1"

    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Security & JWT Tokens
    JWT_SECRET_KEY: str = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Shared secret that lets an external scheduler (UptimeRobot, cron-job.org,
    # a cron job) trigger the automation run over GET. Empty means the cron
    # route refuses to run rather than running unprotected.
    AUTOMATIONS_CRON_TOKEN: str = ""

    # Business identity used in automated notifications. These were previously
    # hardcoded across notification_service.py against three domains this
    # business does not own (chauffeurplatform.com, crownchauffeurs.com.au),
    # and the manager alert number was the lead chauffeur's mobile.
    OPS_EMAIL: str = "book@opalchauffeurs.com.au"
    MANAGER_EMAIL: str = "book@opalchauffeurs.com.au"
    MANAGER_PHONE: str = "+61432000718"
    CONCIERGE_PHONE: str = "+61 432 000 718"
    COMPANY_NAME: str = "Opal Chauffeurs Australia Pty Ltd"
    COMPANY_ABN: str = "68 642 908 112"
    COMPANY_WEBSITE: str = "https://www.opalchauffeurs.com.au"

    # Outbound Email.
    # EMAIL_PROVIDER selects the transport: "resend", "brevo" or "smtp". Leave
    # it as "auto" to use whichever one is configured. With nothing configured
    # the gateway records the message and reports that it was not delivered,
    # rather than claiming success.
    EMAIL_PROVIDER: str = "auto"
    EMAIL_FROM_ADDRESS: str = "book@opalchauffeurs.com.au"
    EMAIL_FROM_NAME: str = "Opal Chauffeurs Australia"
    EMAIL_REPLY_TO: str = ""

    # Resend (HTTP API)
    RESEND_API_KEY: str = ""
    RESEND_API_URL: str = "https://api.resend.com/emails"

    # Brevo, formerly Sendinblue (HTTP API)
    BREVO_API_KEY: str = ""
    BREVO_API_URL: str = "https://api.brevo.com/v3/smtp/email"

    # Direct SMTP (business mailbox, Gmail app password, cPanel, ...)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    # STARTTLS on 587; set false and use port 465 for implicit SSL
    SMTP_USE_TLS: bool = True

    # Default Seed Admin
    DEFAULT_ADMIN_EMAIL: str = "admin@chauffeurplatform.com"
    DEFAULT_ADMIN_PASSWORD: str = "AdminSecurePassword123!"
    DEFAULT_ADMIN_NAME: str = "System Administrator"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./chauffeur_dev.db"
    TEST_DATABASE_URL: str = "sqlite+aiosqlite:///:memory:"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10

    # Redis (Optional in local dev, recommended in production)
    REDIS_URL: Optional[str] = None

    # Security & Rate Limiting
    ENABLE_SECURITY_HEADERS: bool = True
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = 120
    AUTH_RATE_LIMIT_PER_MINUTE: int = 30
    MAX_REQUEST_BODY_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB

    # CORS
    CORS_ORIGINS: Union[List[str], str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, (list, str)):
            return v
        return []

    # External Integrations (Optional)
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    AEROAPI_KEY: Optional[str] = None

    # Live flight tracking.
    # FLIGHT_PROVIDER: flightaware | aerodatabox | aviationstack | auto
    #   auto = whichever has a key, in that order. With none configured the
    #   flight endpoints answer 503 rather than inventing arrival times.
    FLIGHT_PROVIDER: str = "auto"
    AERODATABOX_API_KEY: str = ""
    AERODATABOX_API_HOST: str = "aerodatabox.p.rapidapi.com"
    AVIATIONSTACK_API_KEY: str = ""
    # AviationStack's free plan is HTTP-only; set this to the http:// endpoint
    # if you are on it. HTTPS by default so the key is not sent in clear text.
    AVIATIONSTACK_API_URL: str = "https://api.aviationstack.com/v1/flights"
    # Web Push VAPID Keys for Background Chrome/Safari Mobile Push
    VAPID_PUBLIC_KEY: str = "BC83SPc-2FsmI9kDBZWw_JiVvYLhGONl_In6RaUZDwpgWF-JPhjiB9qh3Cn8YgN5VWwVMOFYCGi26mExGvTwyqY"
    VAPID_PRIVATE_KEY: str = "8aVp7hlfMtpQX5W_S14oeoMZLqD7QG4GA0-8G_Q_r6k"
    VAPID_CLAIMS_EMAIL: str = "mailto:book@opalchauffeurs.com.au"

    # Business Defaults
    DEFAULT_CURRENCY: str = "AUD"
    DEFAULT_TIMEZONE: str = "Australia/Melbourne"
    DEFAULT_GST_PERCENTAGE: float = 10.0


settings = Settings()


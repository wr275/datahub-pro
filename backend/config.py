from pydantic_settings import BaseSettings
from typing import Optional
import sys

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://datahub:password@localhost:5432/datahub_pro"

    # JWT — F21: No default; must be set via env var in production
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Stripe
    STRIPE_SECRET_KEY: str = "sk_test_your_stripe_key_here"
    STRIPE_WEBHOOK_SECRET: str = "whsec_your_webhook_secret_here"
    STRIPE_STARTER_PRICE_ID: str = "price_starter_monthly"
    STRIPE_GROWTH_PRICE_ID: str = "price_growth_monthly"
    STRIPE_ENTERPRISE_PRICE_ID: str = "price_enterprise_monthly"

    # Storage
    STORAGE_TYPE: str = "local"
    LOCAL_UPLOAD_DIR: str = "./uploads"
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_BUCKET_NAME: Optional[str] = None
    AWS_REGION: str = "auto"
    AWS_ENDPOINT_URL: Optional[str] = None  # R2: https://<account_id>.r2.cloudflarestorage.com

    # Email (SendGrid)
    SENDGRID_API_KEY: Optional[str] = None
    FROM_EMAIL: str = "noreply@datahubpro.io"

    # AI — F14: Centralised key management
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None

    # Encryption — F24: Fernet key for encrypting stored connector tokens
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    FERNET_KEY: Optional[str] = None

    # Microsoft / SharePoint OAuth
    MICROSOFT_CLIENT_ID: Optional[str] = None
    MICROSOFT_CLIENT_SECRET: Optional[str] = None
    MICROSOFT_REDIRECT_URI: str = "http://localhost:8000/api/sharepoint/callback"

    # App
    FRONTEND_URL: str = "http://localhost:3000"
    TRIAL_DAYS: int = 14

    class Config:
        env_file = ".env"

settings = Settings()

# F21 — Abort startup if SECRET_KEY looks like the insecure placeholder.
_INSECURE_DEFAULTS = {
    "change-this-to-a-secure-random-string-in-production",
    "secret",
    "changeme",
}
if settings.SECRET_KEY in _INSECURE_DEFAULTS:
    print(
        "FATAL: SECRET_KEY is set to an insecure default value. "
        "Generate a strong random key and set it as the SECRET_KEY environment variable.",
        file=sys.stderr,
    )
    sys.exit(1)

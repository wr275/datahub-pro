from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://datahub:password@localhost:5432/datahub_pro"

    # JWT
    SECRET_KEY: str = "change-this-to-a-secure-random-string-in-production"
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
    AWS_REGION: str = "eu-west-2"

    # Email (SendGrid)
    SENDGRID_API_KEY: Optional[str] = None
    FROM_EMAIL: str = "noreply@datahubpro.io"

    # App
    FRONTEND_URL: str = "http://localhost:3000"
    TRIAL_DAYS: int = 14

    class Config:
        env_file = ".env"

settings = Settings()

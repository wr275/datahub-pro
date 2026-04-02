from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from limiter import limiter
import uvicorn
import logging

from routers import auth, files, analytics, billing, users, connectors, pipelines, budget, calculated_fields, sharepoint, ai, dashboards
from routers import scheduled_reports
from database import engine, Base
from config import settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure ORM-mapped tables exist (idempotent)
    Base.metadata.create_all(bind=engine)

    # Add columns that may be missing on existing deployments
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE data_files ADD COLUMN IF NOT EXISTS source_url TEXT"))
            conn.execute(text("ALTER TABLE data_files ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP"))
            conn.commit()
    except Exception as exc:
        logger.warning("Column migration skipped: %s", exc)

    # Start APScheduler and register saved jobs
    from scheduler import scheduler, load_jobs_from_db
    scheduler.start()
    n = load_jobs_from_db()
    logger.info("APScheduler started — %d scheduled report job(s) registered", n)

    yield

    scheduler.shutdown(wait=False)
    logger.info("APScheduler shut down")


app = FastAPI(
    title="DataHub Pro API",
    description="Enterprise analytics platform for SMEs",
    version="2.0.0",
    lifespan=lifespan,
)

# Rate limiting (F05)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


# ── N12: CORS ─────────────────────────────────────────────────────────────────
_origins_raw = settings.FRONTEND_URL
allowed_origins = [o.strip() for o in _origins_raw.split(",") if o.strip()]
_always_allowed = [
    "https://datahubpro.co.uk",
    "https://www.datahubpro.co.uk",
    "http://localhost:3000",
    "http://localhost:5173",
]
for _origin in _always_allowed:
    if _origin not in allowed_origins:
        allowed_origins.append(_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization", "Content-Type", "Accept",
        "Origin", "X-Requested-With", "Cache-Control",
    ],
    expose_headers=["Content-Disposition"],
)


# ── N13 + CSP: Security headers ───────────────────────────────────────────────
_csp_connect_extra = " ".join(o for o in allowed_origins if o.startswith("https://"))
_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: https:; "
    f"connect-src 'self' {_csp_connect_extra} https://api.anthropic.com; "
    "font-src 'self' data:; "
    "frame-ancestors 'none'; "
    "object-src 'none'; "
    "base-uri 'self'"
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["Content-Security-Policy"] = _CSP
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    if request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# ── N14: Dual API prefix (/api/v1 + /api legacy) ──────────────────────────────
API_V1 = "/api/v1"
API_LEGACY = "/api"

def _include(router, path: str, **kwargs):
    app.include_router(router, prefix=f"{API_V1}{path}", **kwargs)
    app.include_router(router, prefix=f"{API_LEGACY}{path}", **kwargs)


_include(auth.router,                  "/auth",               tags=["Authentication"])
_include(users.router,                 "/users",              tags=["Users"])
_include(files.router,                 "/files",              tags=["Files"])
_include(analytics.router,             "/analytics",          tags=["Analytics"])
_include(billing.router,               "/billing",            tags=["Billing"])
_include(connectors.router,            "/connectors",         tags=["Connectors"])
_include(pipelines.router,             "/pipelines",          tags=["Pipelines"])
_include(budget.router,                "/budget",             tags=["Budget"])
_include(calculated_fields.router,     "/calculated-fields",  tags=["Calculated Fields"])
_include(sharepoint.router,            "/sharepoint",         tags=["SharePoint"])
_include(ai.router,                    "/ai",                 tags=["AI"])
_include(dashboards.router,            "/dashboards",         tags=["Dashboards"])
_include(scheduled_reports.router,     "/scheduled-reports",  tags=["Scheduled Reports"])


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "version": "2.0.0"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
import uvicorn

from routers import (
    auth, files, analytics, billing, users, connectors, pipelines, budget,
    calculated_fields, sharepoint, ai, dashboards, sheets, scheduled_reports,
    organisation, admin,
)
from database import engine, Base, SessionLocal
from config import settings
import scheduler as app_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    # Migration: add columns if they don't exist
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE data_files ADD COLUMN IF NOT EXISTS file_content BYTEA"))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS connectors (
                    id VARCHAR PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    connector_type VARCHAR(50) NOT NULL,
                    config_json TEXT,
                    status VARCHAR(50) DEFAULT 'active',
                    last_sync_at TIMESTAMP,
                    last_file_id VARCHAR,
                    organisation_id VARCHAR NOT NULL REFERENCES organisations(id),
                    created_by VARCHAR NOT NULL REFERENCES users(id),
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS pipelines (
                    id VARCHAR PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    steps_json TEXT NOT NULL DEFAULT '[]',
                    run_count INTEGER DEFAULT 0,
                    last_run_at TIMESTAMP,
                    organisation_id VARCHAR NOT NULL REFERENCES organisations(id),
                    created_by VARCHAR NOT NULL REFERENCES users(id),
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS budget_entries (
                    id VARCHAR PRIMARY KEY,
                    budget_name VARCHAR(255) NOT NULL,
                    category VARCHAR(255) NOT NULL,
                    department VARCHAR(255),
                    period VARCHAR(50) NOT NULL,
                    budgeted FLOAT DEFAULT 0,
                    actual FLOAT,
                    line_type VARCHAR(50) DEFAULT 'expense',
                    organisation_id VARCHAR NOT NULL REFERENCES organisations(id),
                    created_by VARCHAR NOT NULL REFERENCES users(id),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS calculated_field_sets (
                    id VARCHAR PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    file_id VARCHAR NOT NULL REFERENCES data_files(id) ON DELETE CASCADE,
                    fields_json TEXT NOT NULL DEFAULT '[]',
                    organisation_id VARCHAR NOT NULL REFERENCES organisations(id),
                    created_by VARCHAR NOT NULL REFERENCES users(id),
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
            # SharePoint OAuth tables
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS sharepoint_tokens (
                    id VARCHAR PRIMARY KEY,
                    organisation_id VARCHAR UNIQUE NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
                    access_token TEXT NOT NULL,
                    refresh_token TEXT NOT NULL,
                    expires_at VARCHAR(50) NOT NULL,
                    tenant_id VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS oauth_states (
                    state VARCHAR PRIMARY KEY,
                    organisation_id VARCHAR NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
                    tenant_id VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW(),
                    expires_at VARCHAR(50) NOT NULL
                )
            """))
            # Migrations for existing deployments — add tenant_id if missing
            conn.execute(text("ALTER TABLE sharepoint_tokens ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(255)"))
            conn.execute(text("ALTER TABLE oauth_states ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(255)"))

            # Dashboard public-share columns
            conn.execute(text("ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE NOT NULL"))
            conn.execute(text("ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS share_token VARCHAR(64)"))
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_dashboards_share_token ON dashboards (share_token)"))

            # DataFile source-tracking columns (Google Sheets etc.)
            conn.execute(text("ALTER TABLE data_files ADD COLUMN IF NOT EXISTS source_url VARCHAR(2000)"))
            conn.execute(text("ALTER TABLE data_files ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP"))

            # AI add-on entitlement on organisations — off by default
            conn.execute(text("ALTER TABLE organisations ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT FALSE NOT NULL"))
            conn.execute(text("ALTER TABLE organisations ADD COLUMN IF NOT EXISTS ai_enabled_at TIMESTAMP"))

            # Platform super-admin flag — completely separate from org `role`.
            # Only hand-granted via scripts/grant_superuser.py; off by default
            # so legacy rows land in the correct state automatically.
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_superuser BOOLEAN DEFAULT FALSE NOT NULL"))

            # AI access request queue (surface for /admin/ai-requests)
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS ai_access_requests (
                    id VARCHAR PRIMARY KEY,
                    organisation_id VARCHAR NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
                    requested_by_user_id VARCHAR NOT NULL REFERENCES users(id),
                    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
                    reviewed_by_user_id VARCHAR REFERENCES users(id),
                    reviewed_at TIMESTAMP,
                    review_note TEXT,
                    requester_note TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_ai_requests_org ON ai_access_requests (organisation_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_ai_requests_status ON ai_access_requests (status)"))

            # Unified usage/metering ledger (feeds /admin/usage)
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS usage_events (
                    id VARCHAR PRIMARY KEY,
                    organisation_id VARCHAR NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
                    user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
                    kind VARCHAR(50) NOT NULL,
                    quantity INTEGER DEFAULT 0 NOT NULL,
                    cost_cents INTEGER DEFAULT 0 NOT NULL,
                    meta_json TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_usage_events_org ON usage_events (organisation_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_usage_events_kind ON usage_events (kind)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_usage_events_created ON usage_events (created_at)"))

            # Scheduled reports table — relies on SQLAlchemy create_all above,
            # but keep an IF NOT EXISTS guard for older deployments.
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS scheduled_reports (
                    id VARCHAR PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    report_type VARCHAR(50) DEFAULT 'data_summary',
                    frequency VARCHAR(20) NOT NULL,
                    day_of_week VARCHAR(20),
                    day_of_month INTEGER,
                    send_time VARCHAR(10) DEFAULT '08:00',
                    recipients TEXT NOT NULL,
                    file_id VARCHAR REFERENCES data_files(id) ON DELETE SET NULL,
                    status VARCHAR(20) DEFAULT 'active',
                    last_run_at TIMESTAMP,
                    organisation_id VARCHAR NOT NULL REFERENCES organisations(id),
                    created_by VARCHAR NOT NULL REFERENCES users(id),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            """))

            conn.commit()
    except Exception:
        pass

    # Start background scheduler and rehydrate active scheduled reports
    try:
        app_scheduler.start()
        _db = SessionLocal()
        try:
            app_scheduler.rehydrate_all(_db)
        finally:
            _db.close()
    except Exception:
        pass

    yield

    # Clean shutdown
    try:
        app_scheduler.shutdown()
    except Exception:
        pass

app = FastAPI(
    title="DataHub Pro API",
    description="Enterprise analytics platform for SMEs",
    version="1.0.0",
    lifespan=lifespan
)

# Build allowed origins from env â supports comma-separated list
# e.g. FRONTEND_URL=https://frontend.up.railway.app,https://myapp.com
_origins_raw = settings.FRONTEND_URL
allowed_origins = [o.strip() for o in _origins_raw.split(",") if o.strip()]
# Always include production domain and localhost
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
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(files.router, prefix="/api/files", tags=["Files"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(billing.router, prefix="/api/billing", tags=["Billing"])
app.include_router(connectors.router, prefix="/api/connectors", tags=["Connectors"])
app.include_router(pipelines.router, prefix="/api/pipelines", tags=["Pipelines"])
app.include_router(budget.router, prefix="/api/budget", tags=["Budget"])
app.include_router(calculated_fields.router, prefix="/api/calculated-fields", tags=["Calculated Fields"])
app.include_router(sharepoint.router,        prefix="/api/sharepoint",        tags=["SharePoint"])
app.include_router(ai.router,                prefix="/api",                    tags=["AI"])
app.include_router(dashboards.router,        prefix="/api/dashboards",         tags=["Dashboards"])
app.include_router(dashboards.share_router,  prefix="/api/share",              tags=["Public Share"])
app.include_router(sheets.router,            prefix="/api/sheets",             tags=["Google Sheets"])
app.include_router(scheduled_reports.router, prefix="/api/scheduled-reports",  tags=["Scheduled Reports"])
app.include_router(organisation.router,      prefix="/api/organisation",       tags=["Organisation"])
app.include_router(admin.router,             prefix="/api/admin",              tags=["Admin"])

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "DataHub Pro API"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

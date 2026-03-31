from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
import uvicorn

from routers import auth, files, analytics, billing, users, connectors, pipelines, budget, calculated_fields, sharepoint
from database import engine, Base
from config import settings

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
            conn.commit()
    except Exception:
        pass
    yield

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

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "DataHub Pro API"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

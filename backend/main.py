from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
import uvicorn
from routers import auth, files, analytics, billing, users, ai, sheets, dashboards, connectors, pipelines
from database import engine, Base
from config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    # Run safe migrations for columns added after initial deploy
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            # file_content column (original)
            conn.execute(text("ALTER TABLE data_files ADD COLUMN IF NOT EXISTS file_content BYTEA"))
            # Google Sheets connector columns
            conn.execute(text("ALTER TABLE data_files ADD COLUMN IF NOT EXISTS source_url TEXT"))
            conn.execute(text("ALTER TABLE data_files ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP"))
            # Dashboard sharing columns
            conn.execute(text("ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS share_token VARCHAR(36)"))
            # Connectors table
            conn.execute(text("""CREATE TABLE IF NOT EXISTS connectors (id VARCHAR PRIMARY KEY, name VARCHAR(255) NOT NULL, connector_type VARCHAR(50) NOT NULL, config_json TEXT, status VARCHAR(50) DEFAULT 'active', last_sync_at TIMESTAMP, last_file_id VARCHAR, organisation_id VARCHAR REFERENCES organisations(id), created_by VARCHAR REFERENCES users(id), created_at TIMESTAMP DEFAULT now())"""))
            # Pipelines table
            conn.execute(text("""CREATE TABLE IF NOT EXISTS pipelines (id VARCHAR PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT, steps_json TEXT NOT NULL DEFAULT '[]', run_count INTEGER DEFAULT 0, last_run_at TIMESTAMP, organisation_id VARCHAR REFERENCES organisations(id), created_by VARCHAR REFERENCES users(id), created_at TIMESTAMP DEFAULT now())"""))
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
_origins_raw = settings.FRONTEND_URL
allowed_origins = [o.strip() for o in _origins_raw.split(",") if o.strip()]
if "http://localhost:3000" not in allowed_origins:
    allowed_origins.append("http://localhost:3000")

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
app.include_router(sheets.router, prefix="/api/sheets", tags=["Sheets"])
app.include_router(dashboards.router, prefix="/api/dashboards", tags=["Dashboards"])
app.include_router(dashboards.share_router, prefix="/api/share", tags=["Share"])
app.include_router(ai.router, prefix="", tags=["AI"])
app.include_router(connectors.router, prefix="/api/connectors", tags=["Connectors"])
app.include_router(pipelines.router, prefix="/api/pipelines", tags=["Pipelines"])


def _health_response():
    return {"status": "healthy", "service": "DataHub Pro API"}


@app.get("/health", tags=["Health"], summary="Root health check")
def health_check():
    return _health_response()


@app.get("/api/health", tags=["Health"], summary="API health check")
def api_health_check():
    return _health_response()


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

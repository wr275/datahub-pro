from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
import uvicorn
from routers import auth, files, analytics, billing, users
from database import engine, Base
from config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE data_files ADD COLUMN IF NOT EXISTS file_content BYTEA"))
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

# Build allowed origins from env — supports comma-separated list
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

app.include_router(auth.router,      prefix="/api/auth",      tags=["Authentication"])
app.include_router(users.router,     prefix="/api/users",     tags=["Users"])
app.include_router(files.router,     prefix="/api/files",     tags=["Files"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(billing.router,   prefix="/api/billing",   tags=["Billing"])


def _health_response():
    return {"status": "healthy", "service": "DataHub Pro API"}


@app.get("/health", tags=["Health"], summary="Root health check")
def health_check():
    """Liveness probe — returns 200 when the service is up."""
    return _health_response()


@app.get("/api/health", tags=["Health"], summary="API-prefixed health check")
def api_health_check():
    """Same liveness probe at the /api prefix for CI pipelines and monitoring."""
    return _health_response()


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

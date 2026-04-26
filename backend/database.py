from sqlalchemy import create_engine, Column, String, Integer, Boolean, DateTime, Text, Float, ForeignKey, Enum, LargeBinary
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.sql import func
import os
import enum

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./datahub_pro.db")

# Railway provides postgres:// but SQLAlchemy 1.4+ requires postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite needs different engine args than PostgreSQL
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=10, max_overflow=20)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class SubscriptionTier(enum.Enum):
    starter = "starter"
    growth = "growth"
    enterprise = "enterprise"

class Organisation(Base):
    __tablename__ = "organisations"
    id = Column(String, primary_key=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    subscription_tier = Column(Enum(SubscriptionTier), default=SubscriptionTier.starter)
    stripe_customer_id = Column(String, nullable=True)
    stripe_subscription_id = Column(String, nullable=True)
    subscription_status = Column(String(50), default="trialing")
    trial_ends_at = Column(DateTime, nullable=True)
    max_users = Column(Integer, default=3)
    max_uploads_per_month = Column(Integer, default=10)
    # AI add-on: off by default, owner must enable
    ai_enabled = Column(Boolean, default=False, nullable=False)
    ai_enabled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    users = relationship("User", back_populates="organisation")
    files = relationship("DataFile", back_populates="organisation")

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    role = Column(String(50), default="member")
    # Platform-level super-admin. Completely separate from org `role`.
    # A superuser can reach the /admin dashboard and approve AI requests
    # for any org. Granted manually via scripts/grant_superuser.py.
    is_superuser = Column(Boolean, default=False, nullable=False)
    organisation_id = Column(String, ForeignKey("organisations.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    last_login = Column(DateTime, nullable=True)
    organisation = relationship("Organisation", back_populates="users")
    files = relationship("DataFile", back_populates="uploaded_by_user")
    audit_logs = relationship("AuditLog", back_populates="user")

class DataFile(Base):
    __tablename__ = "data_files"
    id = Column(String, primary_key=True)
    filename = Column(String(500), nullable=False)
    original_filename = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=True)
    row_count = Column(Integer, nullable=True)
    column_count = Column(Integer, nullable=True)
    columns_json = Column(Text, nullable=True)
    s3_key = Column(String(1000), nullable=True)
    storage_type = Column(String(50), default="local")
    file_content = Column(LargeBinary, nullable=True)
    # Google Sheets / SharePoint / external source tracking
    source_url = Column(String(2000), nullable=True)
    last_synced_at = Column(DateTime, nullable=True)
    # Google Sheets 2.0 + SharePoint 2.0 — scheduled/linked refresh
    sync_frequency = Column(String(20), default="off", nullable=False)  # off|hourly|daily
    last_sync_error = Column(Text, nullable=True)
    # SharePoint 2.0 linked-file pointers so we can re-stream from Graph
    sharepoint_drive_id = Column(String(500), nullable=True)
    sharepoint_item_id = Column(String(500), nullable=True)
    organisation_id = Column(String, ForeignKey("organisations.id"), nullable=False)
    uploaded_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    organisation = relationship("Organisation", back_populates="files")
    uploaded_by_user = relationship("User", back_populates="files")

class Dashboard(Base):
    __tablename__ = "dashboards"
    id = Column(String, primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    config_json = Column(Text, nullable=True)
    file_id = Column(String, ForeignKey("data_files.id"), nullable=True)
    # Public-share support
    is_public = Column(Boolean, default=False, nullable=False)
    share_token = Column(String(64), unique=True, nullable=True, index=True)
    organisation_id = Column(String, ForeignKey("organisations.id"), nullable=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    organisation_id = Column(String, nullable=True)
    action = Column(String(255), nullable=False)
    detail = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    user = relationship("User", back_populates="audit_logs")


class PasswordResetToken(Base):
    """One-time password reset tokens. We store sha256(token) instead of the
    raw token so a DB snapshot can't be used to take over accounts. The raw
    token only lives in the email we send."""
    __tablename__ = "password_reset_tokens"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class Connector(Base):
    __tablename__ = "connectors"
    id = Column(String, primary_key=True)
    name = Column(String(255), nullable=False)
    connector_type = Column(String(50), nullable=False)
    config_json = Column(Text, nullable=True)
    status = Column(String(50), default="active")
    last_sync_at = Column(DateTime, nullable=True)
    last_file_id = Column(String, nullable=True)
    organisation_id = Column(String, ForeignKey("organisations.id"), nullable=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

class Pipeline(Base):
    __tablename__ = "pipelines"
    id = Column(String, primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    steps_json = Column(Text, nullable=False, default="[]")
    run_count = Column(Integer, default=0)
    last_run_at = Column(DateTime, nullable=True)
    organisation_id = Column(String, ForeignKey("organisations.id"), nullable=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

class BudgetEntry(Base):
    __tablename__ = "budget_entries"
    id = Column(String, primary_key=True)
    budget_name = Column(String(255), nullable=False)
    category = Column(String(255), nullable=False)
    department = Column(String(255), nullable=True)
    period = Column(String(50), nullable=False)
    budgeted = Column(Float, default=0.0)
    actual = Column(Float, nullable=True)
    line_type = Column(String(50), default="expense")
    organisation_id = Column(String, ForeignKey("organisations.id"), nullable=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now())


class CalculatedFieldSet(Base):
    __tablename__ = "calculated_field_sets"
    id = Column(String, primary_key=True)
    name = Column(String(255), nullable=False)
    file_id = Column(String, ForeignKey("data_files.id"), nullable=False)
    fields_json = Column(Text, nullable=False, default="[]")
    organisation_id = Column(String, ForeignKey("organisations.id"), nullable=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class ScheduledReport(Base):
    __tablename__ = "scheduled_reports"
    id = Column(String, primary_key=True)
    name = Column(String(255), nullable=False)
    # 2.0 templates: data_summary | kpi_digest | alerts_digest | raw_attachment
    report_type = Column(String(50), default="data_summary")
    frequency = Column(String(20), nullable=False)           # daily | weekly | monthly
    day_of_week = Column(String(20), nullable=True)          # Monday..Sunday
    day_of_month = Column(Integer, nullable=True)            # 1..31
    send_time = Column(String(10), default="08:00")          # HH:MM (24h)
    recipients = Column(Text, nullable=False)                # comma-separated emails
    file_id = Column(String, ForeignKey("data_files.id"), nullable=True)
    status = Column(String(20), default="active")            # active | paused
    last_run_at = Column(DateTime, nullable=True)
    # 2.0: attach the source CSV to outgoing emails.
    attach_csv = Column(Boolean, default=False, nullable=False)
    # 2.0: max retries for transient email failures (exponential backoff, per-send).
    max_retries = Column(Integer, default=2, nullable=False)
    organisation_id = Column(String, ForeignKey("organisations.id"), nullable=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class ScheduledReportDelivery(Base):
    """Single send-attempt record. One row per delivery (initial + retries).

    Enables an audit log in the UI and lets the backend reason about retry
    counts without parsing log files.
    """
    __tablename__ = "scheduled_report_deliveries"
    id = Column(String, primary_key=True)
    report_id = Column(String, ForeignKey("scheduled_reports.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(20), nullable=False)  # sent | failed | retrying | skipped
    attempted_at = Column(DateTime, server_default=func.now(), nullable=False)
    recipients = Column(Text, nullable=True)      # snapshot at send time
    attempt = Column(Integer, default=1, nullable=False)
    error_message = Column(Text, nullable=True)
    rows_included = Column(Integer, nullable=True)
    # 'scheduled' = fired by cron, 'manual' = fired from Send-now button
    trigger = Column(String(20), default="scheduled", nullable=False)


# ─── Admin / Platform-level tables ─────────────────────────────────
#
# These are for the super-admin dashboard (/admin/*). Nothing here is
# org-scoped in the usual sense: a superuser sees across every workspace.

class AiAccessRequest(Base):
    """A workspace has asked for the AI add-on to be switched on.

    The request lifecycle is pending → approved | denied. Approval flips
    Organisation.ai_enabled=True and emails the requester. Only the
    platform superuser (not org owners) can approve. Deduped per org at
    the router level — one pending row per organisation at a time.
    """
    __tablename__ = "ai_access_requests"
    id = Column(String, primary_key=True)
    organisation_id = Column(String, ForeignKey("organisations.id"), nullable=False, index=True)
    requested_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), default="pending", nullable=False, index=True)  # pending | approved | denied
    # Populated when status transitions out of pending.
    reviewed_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    # Optional free-text from the approver — shown in the notification email.
    review_note = Column(Text, nullable=True)
    # Optional free-text from the requester (e.g. "we want this for the
    # Q2 reporting workstream"). Reserved for future UI; nullable today.
    requester_note = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class UsageEvent(Base):
    """Unified usage/metering ledger.

    Every billable or rate-limited event gets one row. `kind` decides
    what the row represents and what `quantity` / `cost_cents` mean:
      - ai_tokens   → quantity is (prompt+completion) tokens, cost_cents
                      is the Anthropic $ estimate at the then-current price
      - file_upload → quantity = 1, cost_cents = 0 (uploads are flat-billed)
      - api_call    → generic bucket for future rate-limited endpoints
    Extending to new kinds is additive; old rows stay interpretable.
    """
    __tablename__ = "usage_events"
    id = Column(String, primary_key=True)
    organisation_id = Column(String, ForeignKey("organisations.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    kind = Column(String(50), nullable=False, index=True)
    quantity = Column(Integer, default=0, nullable=False)
    # Stored in cents (USD) to avoid float rounding. Nullable for free events.
    cost_cents = Column(Integer, default=0, nullable=False)
    # JSON-encoded extras: model name, endpoint path, file id, etc.
    meta_json = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), index=True)

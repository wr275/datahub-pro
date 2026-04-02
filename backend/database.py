from sqlalchemy import create_engine, Column, String, Integer, Boolean, DateTime, Text, Float, ForeignKey, Enum, LargeBinary
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.sql import func
import os
import enum

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./datahub_pro.db")

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

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
    organisation_id = Column(String, ForeignKey("organisations.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    last_login = Column(DateTime, nullable=True)
    organisation = relationship("Organisation", back_populates="users")
    files = relationship("DataFile", back_populates="uploaded_by_user")
    audit_logs = relationship("AuditLog", back_populates="user")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    invite_tokens = relationship("InviteToken", back_populates="user", cascade="all, delete-orphan")

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(64), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    user = relationship("User", back_populates="refresh_tokens")

class InviteToken(Base):
    __tablename__ = "invite_tokens"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    user = relationship("User", back_populates="invite_tokens")

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
    # Google Sheets / URL-synced files
    source_url = Column(Text, nullable=True)
    last_synced_at = Column(DateTime, nullable=True)
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
    """A recurring report email schedule."""
    __tablename__ = "scheduled_reports"
    id = Column(String, primary_key=True)
    name = Column(String(255), nullable=False)
    report_type = Column(String(100), nullable=False, default="data_summary")
    frequency = Column(String(20), nullable=False)        # daily | weekly | monthly
    day_of_week = Column(String(20), nullable=True)       # Monday … Sunday (weekly only)
    day_of_month = Column(Integer, nullable=True)         # 1-28 (monthly only)
    send_time = Column(String(10), nullable=False)        # HH:MM (UTC)
    recipients = Column(Text, nullable=False)             # comma-separated emails
    file_id = Column(String, ForeignKey("data_files.id"), nullable=True)
    status = Column(String(20), nullable=False, default="active")   # active | paused
    last_run_at = Column(DateTime, nullable=True)
    organisation_id = Column(String, ForeignKey("organisations.id"), nullable=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

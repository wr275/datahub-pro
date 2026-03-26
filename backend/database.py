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

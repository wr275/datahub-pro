-- DataHub Pro Database Schema
-- PostgreSQL 14+
-- Last updated: 2026-04-01
-- Reflects ORM models in backend/database.py (including F05-F09 security additions)

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- ORGANISATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS organisations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) UNIQUE NOT NULL,
    subscription_tier VARCHAR(50) DEFAULT 'trial' CHECK (subscription_tier IN ('trial', 'starter', 'growth', 'enterprise')),
    subscription_status VARCHAR(50) DEFAULT 'trialing' CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'cancelled', 'paused')),
    stripe_customer_id      VARCHAR(255),
    stripe_subscription_id  VARCHAR(255),
    trial_ends_at   TIMESTAMPTZ,
    max_users       INTEGER DEFAULT 3,
    max_uploads_per_month INTEGER DEFAULT 10,
    settings_json   JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_organisations_slug ON organisations(slug);
CREATE INDEX idx_organisations_stripe_customer ON organisations(stripe_customer_id);

-- ============================================
-- USERS
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(500) NOT NULL,
    full_name       VARCHAR(255),
    role            VARCHAR(50) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    is_active       BOOLEAN DEFAULT TRUE,
    is_verified     BOOLEAN DEFAULT FALSE,
    organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
    avatar_url      VARCHAR(1000),
    last_login      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_organisation ON users(organisation_id);

-- ============================================
-- REFRESH TOKENS  (added: F06 — server-side token persistence)
-- Stores SHA-256 hash of issued refresh tokens (never the raw JWT).
-- Deleted on logout; rotated (old deleted, new inserted) on /auth/refresh.
-- ============================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          VARCHAR(36) PRIMARY KEY,
    user_id     VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL,
    expires_at  TIMESTAMP NOT NULL,
    revoked_at  TIMESTAMP,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- ============================================
-- INVITE TOKENS  (added: F08 — secure team-invite flow)
-- Stores SHA-256 hash of the raw invite token emailed to invitees.
-- Valid for 72 hours; marked used_at on acceptance.
-- ============================================
CREATE TABLE IF NOT EXISTS invite_tokens (
    id          VARCHAR(36) PRIMARY KEY,
    user_id     VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL,
    expires_at  TIMESTAMP NOT NULL,
    used_at     TIMESTAMP,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_invite_tokens_token_hash ON invite_tokens(token_hash);
CREATE INDEX idx_invite_tokens_user_id ON invite_tokens(user_id);

-- ============================================
-- DATA FILES
-- ============================================
CREATE TABLE IF NOT EXISTS data_files (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename        VARCHAR(500) NOT NULL,
    original_filename VARCHAR(500) NOT NULL,
    file_size       BIGINT,
    mime_type       VARCHAR(100),
    row_count       INTEGER,
    column_count    INTEGER,
    columns_json    JSONB DEFAULT '[]',
    s3_key          VARCHAR(1000),        -- NULL for local-disk uploads (F17)
    storage_type    VARCHAR(50) DEFAULT 'local' CHECK (storage_type IN ('local', 's3', 'shopify')),
    file_content    BYTEA,                -- NULL for R2/S3 and local-disk (F23)
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    uploaded_by     UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    is_archived     BOOLEAN DEFAULT FALSE,
    tags            TEXT[],
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_data_files_organisation ON data_files(organisation_id);
CREATE INDEX idx_data_files_uploaded_by ON data_files(uploaded_by);
CREATE INDEX idx_data_files_created_at ON data_files(created_at DESC);

-- ============================================
-- DASHBOARDS
-- ============================================
CREATE TABLE IF NOT EXISTS dashboards (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    config_json     JSONB DEFAULT '{}',
    is_shared       BOOLEAN DEFAULT FALSE,
    share_token     VARCHAR(100) UNIQUE,
    file_id         UUID REFERENCES data_files(id) ON DELETE SET NULL,
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dashboards_organisation ON dashboards(organisation_id);
CREATE INDEX idx_dashboards_file ON dashboards(file_id);
CREATE INDEX idx_dashboards_share_token ON dashboards(share_token);

-- ============================================
-- SAVED REPORTS
-- ============================================
CREATE TABLE IF NOT EXISTS saved_reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    report_type     VARCHAR(100) NOT NULL,
    config_json     JSONB DEFAULT '{}',
    result_json     JSONB,
    file_id         UUID REFERENCES data_files(id) ON DELETE SET NULL,
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_saved_reports_organisation ON saved_reports(organisation_id);

-- ============================================
-- GOALS / KPI TARGETS
-- ============================================
CREATE TABLE IF NOT EXISTS goals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    metric_column   VARCHAR(255) NOT NULL,
    target_value    DECIMAL(20,4) NOT NULL,
    current_value   DECIMAL(20,4),
    file_id         UUID REFERENCES data_files(id) ON DELETE SET NULL,
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES users(id),
    due_date        DATE,
    is_achieved     BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_goals_organisation ON goals(organisation_id);

-- ============================================
-- SCHEDULED REPORTS
-- ============================================
CREATE TABLE IF NOT EXISTS scheduled_reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    report_config   JSONB NOT NULL,
    schedule_cron   VARCHAR(100) NOT NULL,
    recipients      TEXT[] NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    last_run_at     TIMESTAMPTZ,
    next_run_at     TIMESTAMPTZ,
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_reports_organisation ON scheduled_reports(organisation_id);
CREATE INDEX idx_scheduled_reports_next_run ON scheduled_reports(next_run_at) WHERE is_active = TRUE;

-- ============================================
-- AUDIT LOG
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
    action          VARCHAR(255) NOT NULL,
    detail          TEXT,
    resource_type   VARCHAR(100),
    resource_id     VARCHAR(255),
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_organisation ON audit_logs(organisation_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Partition hint: in production, consider partitioning by month

-- ============================================
-- CONNECTORS  (Shopify, etc.)
-- Sensitive fields such as access_token are Fernet-encrypted (F24).
-- ============================================
CREATE TABLE IF NOT EXISTS connectors (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    connector_type  VARCHAR(100) NOT NULL,
    config_json     JSONB DEFAULT '{}',   -- access_token stored encrypted (F24)
    status          VARCHAR(50) DEFAULT 'active',
    last_sync_at    TIMESTAMPTZ,
    last_file_id    UUID REFERENCES data_files(id) ON DELETE SET NULL,
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_connectors_organisation ON connectors(organisation_id);

-- ============================================
-- PIPELINES
-- ============================================
CREATE TABLE IF NOT EXISTS pipelines (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    steps_json      JSONB DEFAULT '[]',
    is_active       BOOLEAN DEFAULT TRUE,
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pipelines_organisation ON pipelines(organisation_id);

-- ============================================
-- BUDGET ENTRIES
-- ============================================
CREATE TABLE IF NOT EXISTS budget_entries (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    budget_name     VARCHAR(255) NOT NULL,
    category        VARCHAR(255) NOT NULL,
    department      VARCHAR(255),
    period          VARCHAR(50) NOT NULL,
    budgeted        DECIMAL(20,4) DEFAULT 0,
    actual          DECIMAL(20,4),
    line_type       VARCHAR(50) DEFAULT 'expense',
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_budget_entries_organisation ON budget_entries(organisation_id);

-- ============================================
-- CALCULATED FIELD SETS
-- ============================================
CREATE TABLE IF NOT EXISTS calculated_field_sets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    file_id         UUID REFERENCES data_files(id) ON DELETE CASCADE,
    fields_json     JSONB DEFAULT '[]',
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calculated_field_sets_organisation ON calculated_field_sets(organisation_id);
CREATE INDEX idx_calculated_field_sets_file ON calculated_field_sets(file_id);

-- ============================================
-- INTEGRATIONS  (legacy — Microsoft/SharePoint OAuth state)
-- ============================================
CREATE TABLE IF NOT EXISTS integrations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider        VARCHAR(100) NOT NULL,
    config_json     JSONB DEFAULT '{}',
    is_active       BOOLEAN DEFAULT TRUE,
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TRIGGERS: auto-update updated_at columns
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organisations_updated_at BEFORE UPDATE ON organisations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboards_updated_at BEFORE UPDATE ON dashboards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- USEFUL VIEWS
-- ============================================
CREATE OR REPLACE VIEW organisation_stats AS
SELECT
    o.id,
    o.name,
    o.subscription_tier,
    o.subscription_status,
    COUNT(DISTINCT u.id) AS user_count,
    COUNT(DISTINCT df.id) AS file_count,
    COUNT(DISTINCT d.id) AS dashboard_count,
    o.created_at
FROM organisations o
LEFT JOIN users u ON u.organisation_id = o.id
LEFT JOIN data_files df ON df.organisation_id = o.id
LEFT JOIN dashboards d ON d.organisation_id = o.id
GROUP BY o.id;

CREATE OR REPLACE VIEW monthly_upload_counts AS
SELECT
    organisation_id,
    DATE_TRUNC('month', created_at) AS month,
    COUNT(*) AS upload_count,
    SUM(file_size) AS total_bytes
FROM data_files
GROUP BY organisation_id, DATE_TRUNC('month', created_at);

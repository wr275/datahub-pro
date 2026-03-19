-- DataHub Pro Database Schema
-- PostgreSQL 14+

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- ORGANISATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS organisations (
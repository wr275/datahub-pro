"""Initial schema — baseline for all existing tables.

This migration is a no-op when applied to an existing database (all tables
already exist) but establishes the Alembic version history so future
migrations can track changes incrementally.

Revision ID: 0001
Revises: (none — first migration)
Create Date: 2026-04-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # All tables are created by database.py on startup via Base.metadata.create_all().
    # This migration records the baseline state so Alembic can track future changes.
    # On a fresh DB the tables will already exist; on an existing DB they are untouched.
    pass


def downgrade() -> None:
    # Dropping all tables is intentionally not automated here.
    # Use `psql` and a DROP TABLE script if a full schema teardown is needed.
    pass

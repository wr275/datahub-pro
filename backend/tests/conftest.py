"""Pytest configuration for DataHub Pro backend tests."""
import os
import sys

# Point to backend directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set required env vars for test runs
os.environ.setdefault("SECRET_KEY", "TestOnlyKey-NotForProduction-XY7!")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("FRONTEND_URL", "http://localhost:3000")

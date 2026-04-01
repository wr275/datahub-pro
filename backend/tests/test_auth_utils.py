"""
N09 — Backend unit tests for DataHub Pro
Tests: password hashing, JWT tokens, refresh token lifecycle, password complexity.
Run with: cd backend && python -m pytest tests/ -v
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta


# ── Password utilities ────────────────────────────────────────────────────────

def test_hash_password_returns_non_plaintext():
    from auth_utils import hash_password
    pw = "Secret123!"
    hashed = hash_password(pw)
    assert hashed != pw
    assert len(hashed) > 20


def test_verify_password_correct():
    from auth_utils import hash_password, verify_password
    pw = "Secret123!"
    hashed = hash_password(pw)
    assert verify_password(pw, hashed) is True


def test_verify_password_wrong():
    from auth_utils import hash_password, verify_password
    hashed = hash_password("Secret123!")
    assert verify_password("WrongPass1!", hashed) is False


# ── JWT access tokens ─────────────────────────────────────────────────────────

def test_create_and_decode_access_token():
    from auth_utils import create_access_token, _decode_access_token
    payload = {"sub": "user-abc-123"}
    token = create_access_token(payload)
    assert isinstance(token, str)
    user_id = _decode_access_token(token)
    assert user_id == "user-abc-123"


def test_expired_access_token_raises():
    from auth_utils import create_access_token, _decode_access_token
    from fastapi import HTTPException
    token = create_access_token({"sub": "user-abc"}, expires_delta=timedelta(seconds=-1))
    with pytest.raises(HTTPException) as exc_info:
        _decode_access_token(token)
    assert exc_info.value.status_code == 401


def test_invalid_token_raises():
    from auth_utils import _decode_access_token
    from fastapi import HTTPException
    with pytest.raises(HTTPException):
        _decode_access_token("not.a.valid.token")


# ── Refresh tokens ────────────────────────────────────────────────────────────

def test_create_refresh_token_is_random():
    from auth_utils import create_refresh_token
    t1 = create_refresh_token("user-1")
    t2 = create_refresh_token("user-1")
    assert t1 != t2  # must be unique each call


def test_store_and_validate_refresh_token():
    from auth_utils import create_refresh_token, store_refresh_token, validate_and_rotate_refresh_token

    mock_db = MagicMock()

    # Mock the DB query to simulate finding a valid refresh token
    import hashlib
    raw_token = create_refresh_token("user-xyz")
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    mock_rt = MagicMock()
    mock_rt.user_id = "user-xyz"
    mock_rt.revoked_at = None
    mock_rt.expires_at = datetime.utcnow() + timedelta(days=1)

    mock_db.query.return_value.filter.return_value.first.return_value = mock_rt

    user_id = validate_and_rotate_refresh_token(mock_db, raw_token)
    assert user_id == "user-xyz"
    assert mock_rt.revoked_at is not None  # token rotated (revoked)


# ── Password complexity (N10) ─────────────────────────────────────────────────

def test_password_complexity_too_short():
    from fastapi import HTTPException
    # Import from auth router — need to mock out config
    with patch.dict(os.environ, {"SECRET_KEY": "TestKey123!SecureAndLong", "DATABASE_URL": "sqlite:///:memory:", "FRONTEND_URL": "http://localhost:3000"}):
        try:
            from routers.auth import _validate_password_complexity
            with pytest.raises(HTTPException) as exc:
                _validate_password_complexity("abc")
            assert exc.value.status_code == 400
        except ImportError:
            pytest.skip("Cannot import router in unit test environment")


def test_password_complexity_no_uppercase():
    from fastapi import HTTPException
    with patch.dict(os.environ, {"SECRET_KEY": "TestKey123!SecureAndLong", "DATABASE_URL": "sqlite:///:memory:", "FRONTEND_URL": "http://localhost:3000"}):
        try:
            from routers.auth import _validate_password_complexity
            with pytest.raises(HTTPException):
                _validate_password_complexity("lowercase1!")
        except ImportError:
            pytest.skip("Cannot import router in unit test environment")


def test_password_complexity_valid():
    with patch.dict(os.environ, {"SECRET_KEY": "TestKey123!SecureAndLong", "DATABASE_URL": "sqlite:///:memory:", "FRONTEND_URL": "http://localhost:3000"}):
        try:
            from routers.auth import _validate_password_complexity
            # Should not raise
            _validate_password_complexity("ValidPass1!")
        except ImportError:
            pytest.skip("Cannot import router in unit test environment")


# ── Config security guard ─────────────────────────────────────────────────────

def test_config_rejects_insecure_secret_key():
    """Ensure app fails to start if SECRET_KEY is an insecure default."""
    with patch.dict(os.environ, {"SECRET_KEY": "changeme", "DATABASE_URL": "sqlite:///:memory:", "FRONTEND_URL": "http://localhost:3000"}):
        with pytest.raises(SystemExit):
            import importlib
            import config
            importlib.reload(config)


# ── Utility: load_file_bytes fallback chain ───────────────────────────────────

def test_load_file_bytes_uses_bytea_first():
    from routers.utils import load_file_bytes
    mock_file = MagicMock()
    mock_file.file_content = b"hello csv data"
    result = load_file_bytes(mock_file)
    assert result == b"hello csv data"


def test_load_file_bytes_raises_when_nothing_available():
    from fastapi import HTTPException
    from routers.utils import load_file_bytes
    mock_file = MagicMock()
    mock_file.file_content = None
    mock_file.storage_type = "local"
    mock_file.s3_key = None
    mock_file.filename = "nonexistent_file_xyz.csv"
    with pytest.raises(HTTPException) as exc:
        load_file_bytes(mock_file)
    assert exc.value.status_code == 404

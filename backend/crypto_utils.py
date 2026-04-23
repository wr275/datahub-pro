"""
Symmetric encryption helpers for secrets at rest (OAuth tokens, API keys).

Key derivation
--------------
- If env var ENCRYPTION_KEY is set, it is used directly.
  Must be a 32-byte url-safe base64 string (output of Fernet.generate_key()).
- Otherwise the key is derived deterministically from settings.SECRET_KEY via
  SHA-256 -> url-safe base64. This lets us ship encryption everywhere without
  requiring a new env var, while still supporting key rotation in production
  by setting ENCRYPTION_KEY explicitly.

Rotation
--------
To rotate: set ENCRYPTION_KEY to the NEW key, and keep the OLD key in
ENCRYPTION_KEY_OLD. decrypt() will fall back to the old key on failure so
existing records keep working until they're re-encrypted on next write.
"""
from __future__ import annotations

import base64
import hashlib
import os
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from config import settings


def _derive_from_secret(secret: str) -> bytes:
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _load_fernet() -> MultiFernet:
    keys = []
    primary = os.environ.get("ENCRYPTION_KEY")
    if primary:
        keys.append(Fernet(primary.encode("utf-8")))
    else:
        keys.append(Fernet(_derive_from_secret(settings.SECRET_KEY)))
    old = os.environ.get("ENCRYPTION_KEY_OLD")
    if old:
        try:
            keys.append(Fernet(old.encode("utf-8")))
        except Exception:
            pass
    return MultiFernet(keys)


_fernet: Optional[MultiFernet] = None


def _get_fernet() -> MultiFernet:
    global _fernet
    if _fernet is None:
        _fernet = _load_fernet()
    return _fernet


def encrypt_secret(plaintext: str) -> str:
    if not plaintext:
        return ""
    token = _get_fernet().encrypt(plaintext.encode("utf-8"))
    return token.decode("utf-8")


def decrypt_secret(ciphertext: str) -> str:
    """Decrypt; return empty string on any failure (never raise)."""
    if not ciphertext:
        return ""
    try:
        return _get_fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError, TypeError):
        return ""


def looks_encrypted(value: str) -> bool:
    """Cheap check: does this value look like a Fernet token? Used to
    transparently migrate legacy plaintext tokens on first read."""
    if not value:
        return False
    # Fernet tokens start with 'gAAAA' (version byte + timestamp) after b64 decode
    return value.startswith("gAAAA")

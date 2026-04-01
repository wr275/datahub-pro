"""
N11 — Account lockout after repeated failed login attempts.
Uses an in-memory store (resets on restart; acceptable for single-instance Railway deployments).
For multi-replica setups, swap _store for a Redis-backed implementation.
"""
import time
from threading import Lock

_MAX_ATTEMPTS = 5          # lock after this many consecutive failures
_WINDOW_SECONDS = 300      # rolling 5-minute window
_LOCKOUT_SECONDS = 900     # 15-minute lockout

_store: dict[str, dict] = {}   # { email_lower: { "attempts": int, "window_start": float, "locked_until": float | None } }
_lock = Lock()


def _now() -> float:
    return time.monotonic()


def record_failed_attempt(email: str) -> None:
    """Call this after every failed login attempt."""
    key = email.lower()
    with _lock:
        entry = _store.get(key) or {"attempts": 0, "window_start": _now(), "locked_until": None}
        # Reset window if it has expired
        if _now() - entry["window_start"] > _WINDOW_SECONDS:
            entry = {"attempts": 0, "window_start": _now(), "locked_until": None}
        entry["attempts"] += 1
        if entry["attempts"] >= _MAX_ATTEMPTS:
            entry["locked_until"] = _now() + _LOCKOUT_SECONDS
        _store[key] = entry


def record_successful_login(email: str) -> None:
    """Clear failed attempt counter after a successful login."""
    key = email.lower()
    with _lock:
        _store.pop(key, None)


def is_locked(email: str) -> bool:
    """Return True if the account is currently locked out."""
    key = email.lower()
    with _lock:
        entry = _store.get(key)
        if not entry or entry.get("locked_until") is None:
            return False
        if _now() < entry["locked_until"]:
            return True
        # Lock has expired — clear it
        _store.pop(key, None)
        return False


def lockout_seconds_remaining(email: str) -> int:
    """How many seconds until the lockout expires (0 if not locked)."""
    key = email.lower()
    with _lock:
        entry = _store.get(key)
        if not entry or entry.get("locked_until") is None:
            return 0
        remaining = entry["locked_until"] - _now()
        return max(0, int(remaining))

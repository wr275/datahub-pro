"""
N11-upgrade — Redis-backed account lockout with in-memory fallback.

If REDIS_URL is set in the environment, lockout state is persisted to Redis
(survives restarts, works across multiple Railway replicas).  When Redis is
not configured or unreachable the module falls back to the original
threading.Lock + dict store, so the service never fails to start.
"""
import os
import time
from threading import Lock

# ── Configuration ──────────────────────────────────────────────────────────────
_MAX_ATTEMPTS = 5       # consecutive failures before lockout
_WINDOW_SECONDS = 300   # 5-minute rolling window
_LOCKOUT_SECONDS = 900  # 15-minute lockout

# ── Redis bootstrap (optional) ─────────────────────────────────────────────────
_redis_client = None


def _init_redis() -> None:
    global _redis_client
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        return
    try:
        import redis as _redis_lib  # type: ignore
        client = _redis_lib.from_url(
            redis_url, decode_responses=True, socket_connect_timeout=3
        )
        client.ping()            # fail fast if Redis is unreachable
        _redis_client = client
    except Exception:
        _redis_client = None     # graceful fallback to in-memory


_init_redis()

# ── In-memory fallback store ───────────────────────────────────────────────────
_store: dict[str, dict] = {}
_lock = Lock()


def _now() -> float:
    return time.monotonic()


# ── Lua script for atomic read-modify-write in Redis ──────────────────────────
_LUA_RECORD_FAILED = """
local key          = KEYS[1]
local now          = tonumber(ARGV[1])
local window       = tonumber(ARGV[2])
local max_attempts = tonumber(ARGV[3])
local lockout_secs = tonumber(ARGV[4])

local attempts  = tonumber(redis.call('HGET', key, 'attempts')    or 0)
local win_start = tonumber(redis.call('HGET', key, 'window_start') or now)
local locked    = tonumber(redis.call('HGET', key, 'locked_until') or 0)

if (now - win_start) > window then
    attempts  = 0
    win_start = now
    locked    = 0
end

attempts = attempts + 1
if attempts >= max_attempts then
    locked = now + lockout_secs
end

redis.call('HMSET', key, 'attempts', attempts, 'window_start', win_start, 'locked_until', locked)
redis.call('EXPIRE', key, lockout_secs + window)
return locked
"""

_KEY_PREFIX = "lockout:"


# ── Redis helpers ──────────────────────────────────────────────────────────────
def _redis_record_failed(email: str) -> None:
    key = f"{_KEY_PREFIX}{email.lower()}"
    _redis_client.eval(
        _LUA_RECORD_FAILED, 1, key,
        _now(), _WINDOW_SECONDS, _MAX_ATTEMPTS, _LOCKOUT_SECONDS
    )


def _redis_record_success(email: str) -> None:
    _redis_client.delete(f"{_KEY_PREFIX}{email.lower()}")


def _redis_is_locked(email: str) -> bool:
    locked_until = _redis_client.hget(f"{_KEY_PREFIX}{email.lower()}", "locked_until")
    if not locked_until:
        return False
    if _now() < float(locked_until):
        return True
    _redis_client.delete(f"{_KEY_PREFIX}{email.lower()}")
    return False


def _redis_seconds_remaining(email: str) -> int:
    locked_until = _redis_client.hget(f"{_KEY_PREFIX}{email.lower()}", "locked_until")
    if not locked_until:
        return 0
    return max(0, int(float(locked_until) - _now()))


# ── In-memory helpers ──────────────────────────────────────────────────────────
def _mem_record_failed(email: str) -> None:
    key = email.lower()
    with _lock:
        entry = _store.get(key) or {
            "attempts": 0, "window_start": _now(), "locked_until": None
        }
        if _now() - entry["window_start"] > _WINDOW_SECONDS:
            entry = {"attempts": 0, "window_start": _now(), "locked_until": None}
        entry["attempts"] += 1
        if entry["attempts"] >= _MAX_ATTEMPTS:
            entry["locked_until"] = _now() + _LOCKOUT_SECONDS
        _store[key] = entry


def _mem_record_success(email: str) -> None:
    with _lock:
        _store.pop(email.lower(), None)


def _mem_is_locked(email: str) -> bool:
    key = email.lower()
    with _lock:
        entry = _store.get(key)
        if not entry or entry.get("locked_until") is None:
            return False
        if _now() < entry["locked_until"]:
            return True
        _store.pop(key, None)
        return False


def _mem_seconds_remaining(email: str) -> int:
    key = email.lower()
    with _lock:
        entry = _store.get(key)
        if not entry or entry.get("locked_until") is None:
            return 0
        return max(0, int(entry["locked_until"] - _now()))


# ── Public API ─────────────────────────────────────────────────────────────────
def record_failed_attempt(email: str) -> None:
    """Call after every failed login attempt."""
    if _redis_client:
        try:
            _redis_record_failed(email)
            return
        except Exception:
            pass
    _mem_record_failed(email)


def record_successful_login(email: str) -> None:
    """Clear the failed attempt counter after a successful login."""
    if _redis_client:
        try:
            _redis_record_success(email)
            return
        except Exception:
            pass
    _mem_record_success(email)


def is_locked(email: str) -> bool:
    """Return True if the account is currently locked out."""
    if _redis_client:
        try:
            return _redis_is_locked(email)
        except Exception:
            pass
    return _mem_is_locked(email)


def lockout_seconds_remaining(email: str) -> int:
    """How many seconds until the lockout expires (0 if not locked)."""
    if _redis_client:
        try:
            return _redis_seconds_remaining(email)
        except Exception:
            pass
    return _mem_seconds_remaining(email)

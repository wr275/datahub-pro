"""Shared rate-limiter instance used across routers."""
from slowapi import Limiter
from fastapi import Request

def _get_real_ip(request: Request) -> str:
    """
    Resolve client IP behind Railway's reverse proxy.
    Checks X-Forwarded-For first; falls back to request.client.host.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "127.0.0.1"  # Fallback — unknown IPs share one bucket

limiter = Limiter(key_func=_get_real_ip)

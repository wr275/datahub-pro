"""Organisation-level settings and add-on entitlements.

Currently houses the AI add-on toggle. Designed to grow into a general
org-settings namespace (branding, retention, feature flags, etc.).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
import uuid

from database import get_db, User, AuditLog
from auth_utils import get_current_user

router = APIRouter()


class AiToggleRequest(BaseModel):
    enabled: bool


def _require_owner_or_admin(user: User) -> None:
    if user.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can change organisation settings")


@router.get("/")
def get_organisation(current_user: User = Depends(get_current_user)):
    """Return the current user's organisation — includes entitlements."""
    org = current_user.organisation
    if not org:
        raise HTTPException(status_code=404, detail="No organisation associated with this user")
    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "subscription_tier": org.subscription_tier.value if org.subscription_tier else None,
        "subscription_status": org.subscription_status,
        "trial_ends_at": org.trial_ends_at.isoformat() if org.trial_ends_at else None,
        "max_users": org.max_users,
        "max_uploads_per_month": org.max_uploads_per_month,
        "ai_enabled": bool(getattr(org, "ai_enabled", False)),
        "ai_enabled_at": org.ai_enabled_at.isoformat() if getattr(org, "ai_enabled_at", None) else None,
    }


@router.patch("/ai-enabled")
def set_ai_enabled(
    body: AiToggleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Turn the AI add-on on or off for the caller's organisation.

    Owner/admin only. This is a pure boolean flag today — Stripe wiring
    (metered add-on) will hook in here later without changing the contract.
    """
    _require_owner_or_admin(current_user)
    org = current_user.organisation
    if not org:
        raise HTTPException(status_code=400, detail="No organisation associated with this user")

    prev = bool(getattr(org, "ai_enabled", False))
    org.ai_enabled = bool(body.enabled)
    # Record when it was first flipped on (or re-flipped) so we can show
    # "AI enabled on X" in settings and — later — use it for usage windows.
    if body.enabled and not prev:
        org.ai_enabled_at = datetime.utcnow()
    db.add(AuditLog(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        organisation_id=org.id,
        action="ai_toggle",
        detail=f"ai_enabled: {prev} → {bool(body.enabled)}",
    ))
    db.commit()
    db.refresh(org)

    return {
        "ai_enabled": bool(org.ai_enabled),
        "ai_enabled_at": org.ai_enabled_at.isoformat() if org.ai_enabled_at else None,
    }

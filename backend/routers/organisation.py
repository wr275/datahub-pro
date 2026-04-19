"""Organisation-level settings and add-on entitlements.

Currently houses the AI add-on toggle. Designed to grow into a general
org-settings namespace (branding, retention, feature flags, etc.).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
import uuid
import logging

from database import get_db, User, AuditLog
from auth_utils import get_current_user
from config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


class AiToggleRequest(BaseModel):
    enabled: bool


def _require_owner_or_admin(user: User) -> None:
    if user.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can change organisation settings")


def _send_ai_access_request_email(to_email: str, requester_name: str,
                                   org_name: str, hub_url: str) -> bool:
    """Email the workspace owner that a member has asked for AI access.

    Returns True on success, False if SendGrid isn't configured or the
    request fails. The request row/audit is still created either way — the
    owner can always flip the toggle directly from Settings.
    """
    if not settings.SENDGRID_API_KEY:
        logger.warning("SENDGRID_API_KEY not set — ai-access request email not sent to %s", to_email)
        return False

    html = f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0c1446,#1a2a6c);padding:28px 32px;">
      <div style="color:#fff;font-weight:700;font-size:1rem;opacity:0.9;margin-bottom:12px;">DataHub Pro</div>
      <div style="color:#fff;font-size:1.4rem;font-weight:800;">AI access request</div>
    </div>
    <div style="padding:28px 32px;color:#374151;font-size:0.95rem;line-height:1.55;">
      <p><strong>{requester_name}</strong> has requested AI access for <strong>{org_name}</strong> on DataHub Pro.</p>
      <p>The AI add-on unlocks Ask Your Data, AI Insights, AI Narrative, Auto Report, Formula Builder AI and AI Settings for the whole workspace.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="{hub_url}" style="display:inline-block;background:#e91e8c;color:#fff;font-weight:700;font-size:0.95rem;padding:13px 32px;border-radius:8px;text-decoration:none;">Open DataHub Pro →</a>
      </div>
      <p style="color:#6b7280;font-size:0.85rem;">You can turn AI on from <strong>Settings → AI Add-on</strong> or the AI tab on the Hub. It takes effect immediately for everyone in the workspace.</p>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:0.78rem;text-align:center;">
      If you didn't expect this request, you can ignore this email — nothing has been enabled.
    </div>
  </div>
</body></html>"""

    try:
        import sendgrid as sg_lib
        from sendgrid.helpers.mail import Mail
        msg = Mail(
            from_email=settings.FROM_EMAIL,
            to_emails=to_email,
            subject=f"{requester_name} is requesting AI access for {org_name}",
            html_content=html,
        )
        client = sg_lib.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
        resp = client.send(msg)
        ok = resp.status_code in (200, 201, 202)
        if not ok:
            logger.error("SendGrid returned %d for ai-access request to %s", resp.status_code, to_email)
        return ok
    except Exception as exc:
        logger.error("ai-access request email send failed for %s: %s", to_email, exc)
        return False


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


@router.post("/request-ai-access")
def request_ai_access(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send the workspace owner an email asking them to enable the AI add-on.

    Intended for members (role == "member"). Owners/admins can self-enable
    via PATCH /ai-enabled so we short-circuit them with a hint.
    If the add-on is already on we return a no-op success — the UI shouldn't
    even be showing the request button in that case.
    """
    org = current_user.organisation
    if not org:
        raise HTTPException(status_code=400, detail="No organisation associated with this user")

    if current_user.role in ("owner", "admin"):
        raise HTTPException(
            status_code=400,
            detail="You can enable AI yourself from Settings — no request needed.",
        )

    if bool(getattr(org, "ai_enabled", False)):
        return {"email_sent": False, "already_enabled": True, "owner_email": None}

    owner = (
        db.query(User)
        .filter(User.organisation_id == org.id, User.role == "owner")
        .order_by(User.created_at.asc())
        .first()
    )
    if not owner:
        raise HTTPException(status_code=404, detail="Could not find the workspace owner")

    frontend = (settings.FRONTEND_URL or "").split(",")[0].strip().rstrip("/")
    hub_url = f"{frontend}/hub" if frontend else "/hub"

    sent = _send_ai_access_request_email(
        to_email=owner.email,
        requester_name=current_user.full_name or current_user.email,
        org_name=org.name,
        hub_url=hub_url,
    )

    db.add(AuditLog(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        organisation_id=org.id,
        action="ai_access_requested",
        detail=f"requested from owner={owner.email}, email_sent={sent}",
    ))
    db.commit()

    return {
        "email_sent": sent,
        "already_enabled": False,
        "owner_email": owner.email,
    }

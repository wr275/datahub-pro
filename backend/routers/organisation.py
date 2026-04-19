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

from database import get_db, User, AuditLog, AiAccessRequest
from auth_utils import get_current_user
from config import settings

# Platform operator who receives new AI-access-request notifications.
# Keeping this as a single constant for now; if it ever needs to be
# configurable per deployment, move to config.settings.PLATFORM_ADMIN_EMAIL.
PLATFORM_ADMIN_EMAIL = "waqas114@gmail.com"

router = APIRouter()
logger = logging.getLogger(__name__)


class AiToggleRequest(BaseModel):
    enabled: bool


def _require_owner_or_admin(user: User) -> None:
    if user.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can change organisation settings")


def _send_ai_access_request_email(to_email: str, requester_name: str,
                                   requester_email: str, org_name: str,
                                   org_plan: str, admin_url: str) -> bool:
    """Email the DataHub Pro operator that a workspace wants AI access.

    Returns True on success, False if SendGrid isn't configured or the
    request fails. The AiAccessRequest row is created regardless — the
    admin dashboard is the source of truth and the email is a nudge.
    """
    if not settings.SENDGRID_API_KEY:
        logger.warning("SENDGRID_API_KEY not set — ai-access request email not sent to %s", to_email)
        return False

    plan_badge = f"<span style='padding:2px 10px;background:#e8eaf6;color:#0c1446;border-radius:12px;font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;'>{org_plan or 'trial'}</span>"

    html = f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0c1446,#1a2a6c);padding:28px 32px;">
      <div style="color:#fff;font-weight:700;font-size:1rem;opacity:0.9;margin-bottom:12px;">DataHub Pro · Admin</div>
      <div style="color:#fff;font-size:1.4rem;font-weight:800;">New AI access request</div>
    </div>
    <div style="padding:28px 32px;color:#374151;font-size:0.95rem;line-height:1.55;">
      <p>A workspace has asked to enable the AI add-on.</p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;margin:20px 0;">
        <div style="margin-bottom:10px;"><strong>Workspace:</strong> {org_name} {plan_badge}</div>
        <div style="margin-bottom:10px;"><strong>Requested by:</strong> {requester_name} &lt;{requester_email}&gt;</div>
      </div>
      <div style="text-align:center;margin:28px 0;">
        <a href="{admin_url}" style="display:inline-block;background:#e91e8c;color:#fff;font-weight:700;font-size:0.95rem;padding:13px 32px;border-radius:8px;text-decoration:none;">Review in admin →</a>
      </div>
      <p style="color:#6b7280;font-size:0.85rem;">Opens the Admin → AI Requests queue where you can approve or deny with one click.</p>
    </div>
  </div>
</body></html>"""

    try:
        import sendgrid as sg_lib
        from sendgrid.helpers.mail import Mail
        msg = Mail(
            from_email=settings.FROM_EMAIL,
            to_emails=to_email,
            subject=f"AI access request: {org_name} ({requester_name})",
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
    """Queue an AI-add-on request for platform-admin review.

    Vendor-gated model: any workspace member (owner, admin, or regular
    member) can submit a request, but only the platform super-admin can
    approve it. We create an AiAccessRequest row, email the operator,
    and return the request id so the UI can show status.

    Deduped at the org level: if a pending request already exists, we
    return it without creating a new row (and skip the email to avoid
    spamming the operator).
    """
    org = current_user.organisation
    if not org:
        raise HTTPException(status_code=400, detail="No organisation associated with this user")

    if bool(getattr(org, "ai_enabled", False)):
        return {
            "status": "already_enabled",
            "request_id": None,
            "email_sent": False,
        }

    # Dedupe: only one pending request per org at a time.
    existing = (
        db.query(AiAccessRequest)
        .filter(AiAccessRequest.organisation_id == org.id,
                AiAccessRequest.status == "pending")
        .order_by(AiAccessRequest.created_at.desc())
        .first()
    )
    if existing:
        return {
            "status": "already_pending",
            "request_id": existing.id,
            "email_sent": False,
        }

    req = AiAccessRequest(
        id=str(uuid.uuid4()),
        organisation_id=org.id,
        requested_by_user_id=current_user.id,
        status="pending",
    )
    db.add(req)

    # Platform-admin notification (best-effort; doesn't affect the row).
    frontend = (settings.FRONTEND_URL or "").split(",")[0].strip().rstrip("/")
    admin_url = f"{frontend}/admin/ai-requests" if frontend else "/admin/ai-requests"
    sent = _send_ai_access_request_email(
        to_email=PLATFORM_ADMIN_EMAIL,
        requester_name=current_user.full_name or current_user.email,
        requester_email=current_user.email,
        org_name=org.name,
        org_plan=org.subscription_tier.value if org.subscription_tier else "trial",
        admin_url=admin_url,
    )

    db.add(AuditLog(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        organisation_id=org.id,
        action="ai_access_requested",
        detail=f"request_id={req.id}, email_sent={sent}",
    ))
    db.commit()
    db.refresh(req)

    return {
        "status": "pending",
        "request_id": req.id,
        "email_sent": sent,
    }

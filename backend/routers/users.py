from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
from jose import jwt
import uuid
import logging

from database import get_db, User, AuditLog
from auth_utils import get_current_user
from config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

INVITE_TOKEN_TTL_DAYS = 7


# ─── Schemas ──────────────────────────────────────────────────────────────────

class InviteRequest(BaseModel):
    email: EmailStr
    full_name: str = ""
    role: str = "member"


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _make_invite_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=INVITE_TOKEN_TTL_DAYS)
    payload = {"sub": user_id, "exp": expire, "type": "invite"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _send_invite_email(to_email: str, inviter_name: str, org_name: str,
                        accept_url: str) -> bool:
    """Send the invite email via SendGrid. Returns True on success, False
    if SendGrid isn't configured or the request fails. The invite row is
    still created either way — the link can be copied from server logs if
    email delivery isn't available."""
    if not settings.SENDGRID_API_KEY:
        logger.warning("SENDGRID_API_KEY not set — invite email not sent to %s. Link: %s",
                       to_email, accept_url)
        return False

    html = f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0c1446,#1a2a6c);padding:28px 32px;">
      <div style="color:#fff;font-weight:700;font-size:1rem;opacity:0.9;margin-bottom:12px;">DataHub Pro</div>
      <div style="color:#fff;font-size:1.4rem;font-weight:800;">You've been invited to {org_name}</div>
    </div>
    <div style="padding:28px 32px;color:#374151;font-size:0.95rem;line-height:1.55;">
      <p><strong>{inviter_name}</strong> has invited you to join <strong>{org_name}</strong> on DataHub Pro.</p>
      <p>Click the button below to set your password and activate your account. This invite will expire in {INVITE_TOKEN_TTL_DAYS} days.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="{accept_url}" style="display:inline-block;background:#e91e8c;color:#fff;font-weight:700;font-size:0.95rem;padding:13px 32px;border-radius:8px;text-decoration:none;">Accept invite →</a>
      </div>
      <p style="color:#6b7280;font-size:0.8rem;">Or copy this link into your browser:<br>
      <span style="color:#6b7280;word-break:break-all;">{accept_url}</span></p>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:0.78rem;text-align:center;">
      If you weren't expecting this invite, you can safely ignore it.
    </div>
  </div>
</body></html>"""

    try:
        import sendgrid as sg_lib
        from sendgrid.helpers.mail import Mail
        msg = Mail(
            from_email=settings.FROM_EMAIL,
            to_emails=to_email,
            subject=f"{inviter_name} invited you to {org_name} on DataHub Pro",
            html_content=html,
        )
        client = sg_lib.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
        resp = client.send(msg)
        ok = resp.status_code in (200, 201, 202)
        if not ok:
            logger.error("SendGrid returned %d for invite to %s", resp.status_code, to_email)
        return ok
    except Exception as exc:
        logger.error("Invite email send failed for %s: %s", to_email, exc)
        return False


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/team")
def get_team(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    members = db.query(User).filter(User.organisation_id == current_user.organisation_id).all()
    return [
        {
            "id": m.id,
            "email": m.email,
            "full_name": m.full_name,
            "role": m.role,
            "is_active": m.is_active,
            "status": "active" if m.is_active else "pending",
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "last_login": m.last_login.isoformat() if m.last_login else None,
        }
        for m in members
    ]


@router.post("/invite")
def invite_user(
    body: InviteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Only owners and admins can invite users")

    org = current_user.organisation
    if not org:
        raise HTTPException(status_code=400, detail="Inviter has no organisation")

    team_count = db.query(User).filter(User.organisation_id == org.id).count()
    if team_count >= org.max_users:
        raise HTTPException(status_code=429, detail="Team member limit reached. Please upgrade your plan.")

    email = body.email
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    role = body.role if body.role in ("owner", "admin", "member") else "member"

    new_user = User(
        id=str(uuid.uuid4()),
        email=email,
        hashed_password="pending_invite",  # placeholder — replaced on accept
        full_name=body.full_name,
        role=role,
        organisation_id=org.id,
        is_active=False,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = _make_invite_token(new_user.id)
    frontend = (settings.FRONTEND_URL or "").split(",")[0].strip().rstrip("/")
    accept_url = f"{frontend}/accept-invite?token={token}"

    sent = _send_invite_email(
        to_email=email,
        inviter_name=current_user.full_name or current_user.email,
        org_name=org.name,
        accept_url=accept_url,
    )

    # Audit
    db.add(AuditLog(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        organisation_id=org.id,
        action="invite_user",
        detail=f"Invited {email} as {role}; email_sent={sent}",
    ))
    db.commit()

    return {
        "message": (f"Invitation sent to {email}" if sent
                    else f"Invite created for {email}. Email delivery is not configured — "
                         f"share this link manually."),
        "email_sent": sent,
        "accept_url": accept_url if not sent else None,  # expose only when email failed
        "user_id": new_user.id,
    }


@router.get("/audit-log")
def get_audit_log(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    logs = (
        db.query(AuditLog)
        .filter(AuditLog.organisation_id == current_user.organisation_id)
        .order_by(AuditLog.created_at.desc())
        .limit(500)
        .all()
    )
    return [
        {
            "id": l.id,
            "action": l.action,
            "detail": l.detail,
            "user_id": l.user_id,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]

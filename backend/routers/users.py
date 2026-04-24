"""
Team & invites router.

Team 2.0 adds: invite expiry surfaced in the UI, resend-invite, role change on
existing members (audited), bulk invite, cancel-pending-invite. All mutations
write to AuditLog so the Team page can show who did what.

No schema migration required — pending invites are existing User rows with
`is_active=False` and `hashed_password="pending_invite"`; `created_at` doubles
as `invited_at`, and `created_at + 7d` is the display-only expiry (the JWT
itself is what actually enforces expiry).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta, timezone
from jose import jwt
from typing import List, Optional
import uuid
import logging

from database import get_db, User, AuditLog
from auth_utils import get_current_user
from config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

INVITE_TOKEN_TTL_DAYS = 7
VALID_ROLES = ("owner", "admin", "member", "viewer")


# ─── Schemas ──────────────────────────────────────────────────────────────────

class InviteRequest(BaseModel):
    email: EmailStr
    full_name: str = ""
    role: str = "member"


class BulkInviteItem(BaseModel):
    email: EmailStr
    full_name: str = ""
    role: str = "member"


class BulkInviteRequest(BaseModel):
    invites: List[BulkInviteItem]


class RoleUpdateRequest(BaseModel):
    role: str


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _make_invite_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=INVITE_TOKEN_TTL_DAYS)
    payload = {"sub": user_id, "exp": expire, "type": "invite"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _is_pending(u: User) -> bool:
    """True if this user is a pending invite (not yet accepted)."""
    return (not u.is_active) and (u.hashed_password == "pending_invite")


def _invite_expires_at(u: User) -> Optional[str]:
    """Display-only invite expiry. The JWT exp is the actual enforcement."""
    if not _is_pending(u) or not u.created_at:
        return None
    exp = u.created_at + timedelta(days=INVITE_TOKEN_TTL_DAYS)
    return exp.isoformat()


def _coerce_role(role: str) -> str:
    r = (role or "").lower().strip()
    return r if r in VALID_ROLES else "member"


def _check_admin(current_user: User):
    if current_user.role not in ("owner", "admin") and not getattr(current_user, "is_superuser", False):
        raise HTTPException(status_code=403, detail="Only owners and admins can manage the team")


def _audit(db: Session, actor_id: str, org_id: str, action: str, detail: str):
    db.add(AuditLog(
        id=str(uuid.uuid4()),
        user_id=actor_id,
        organisation_id=org_id,
        action=action,
        detail=detail[:500],
    ))


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


def _do_invite(db: Session, inviter: User, email: str, full_name: str, role: str):
    """Core invite logic shared between single + bulk endpoints.

    Raises HTTPException on failure; returns a dict on success.
    """
    org = inviter.organisation
    if not org:
        raise HTTPException(status_code=400, detail="Inviter has no organisation")

    team_count = db.query(User).filter(User.organisation_id == org.id).count()
    if team_count >= org.max_users:
        raise HTTPException(status_code=429, detail="Team member limit reached. Please upgrade your plan.")

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    role = _coerce_role(role)
    new_user = User(
        id=str(uuid.uuid4()),
        email=email,
        hashed_password="pending_invite",
        full_name=full_name or "",
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
        inviter_name=inviter.full_name or inviter.email,
        org_name=org.name,
        accept_url=accept_url,
    )

    _audit(db, inviter.id, org.id, "invite_user",
           f"Invited {email} as {role}; email_sent={sent}")
    db.commit()

    return {
        "user_id": new_user.id,
        "email": email,
        "role": role,
        "email_sent": sent,
        "accept_url": accept_url if not sent else None,
    }


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/team")
def get_team(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    members = db.query(User).filter(User.organisation_id == current_user.organisation_id).all()
    now = datetime.utcnow()
    out = []
    for m in members:
        pending = _is_pending(m)
        exp_iso = _invite_expires_at(m) if pending else None
        expired = False
        if pending and m.created_at:
            expired = (m.created_at + timedelta(days=INVITE_TOKEN_TTL_DAYS)) < now
        out.append({
            "id": m.id,
            "email": m.email,
            "full_name": m.full_name,
            "role": m.role,
            "is_active": m.is_active,
            "status": "pending" if pending else ("active" if m.is_active else "disabled"),
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "last_login": m.last_login.isoformat() if m.last_login else None,
            "invited_at": m.created_at.isoformat() if (pending and m.created_at) else None,
            "invite_expires_at": exp_iso,
            "invite_expired": expired,
        })
    return out


@router.post("/invite")
def invite_user(
    body: InviteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_admin(current_user)
    result = _do_invite(db, current_user, body.email, body.full_name, body.role)
    return {
        "message": (f"Invitation sent to {result['email']}" if result["email_sent"]
                    else f"Invite created for {result['email']}. Email delivery is not configured — "
                         f"share this link manually."),
        **result,
    }


@router.post("/invite-bulk")
def invite_bulk(
    body: BulkInviteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Invite multiple users in one request. Each row is tried independently —
    a bad row doesn't fail the whole batch. Response includes a per-row result."""
    _check_admin(current_user)
    if not body.invites:
        raise HTTPException(status_code=400, detail="No invites provided")
    if len(body.invites) > 100:
        raise HTTPException(status_code=400, detail="Max 100 invites per batch")

    results = []
    sent_count = 0
    for item in body.invites:
        try:
            r = _do_invite(db, current_user, item.email, item.full_name, item.role)
            results.append({
                "email": item.email,
                "status": "sent" if r["email_sent"] else "created",
                "email_sent": r["email_sent"],
                "accept_url": r["accept_url"],
                "user_id": r["user_id"],
            })
            if r["email_sent"]:
                sent_count += 1
        except HTTPException as e:
            # Rollback only the failed row — others already committed by _do_invite.
            db.rollback()
            detail = e.detail if isinstance(e.detail, str) else str(e.detail)
            results.append({"email": item.email, "status": "error", "error": detail})
        except Exception as e:
            db.rollback()
            results.append({"email": item.email, "status": "error", "error": str(e)})

    return {
        "total": len(body.invites),
        "sent": sent_count,
        "created": sum(1 for r in results if r["status"] == "created"),
        "errors": sum(1 for r in results if r["status"] == "error"),
        "results": results,
    }


@router.post("/{user_id}/resend-invite")
def resend_invite(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Issue a fresh invite token and re-send the email for a pending invite."""
    _check_admin(current_user)
    target = db.query(User).filter(
        User.id == user_id,
        User.organisation_id == current_user.organisation_id,
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if not _is_pending(target):
        raise HTTPException(status_code=400, detail="Not a pending invite — user has already accepted")

    # Reset created_at so the "invited X days ago" clock restarts and
    # the displayed expiry matches the new JWT.
    target.created_at = datetime.utcnow()
    db.commit()
    db.refresh(target)

    token = _make_invite_token(target.id)
    frontend = (settings.FRONTEND_URL or "").split(",")[0].strip().rstrip("/")
    accept_url = f"{frontend}/accept-invite?token={token}"

    org = current_user.organisation
    sent = _send_invite_email(
        to_email=target.email,
        inviter_name=current_user.full_name or current_user.email,
        org_name=org.name if org else "your team",
        accept_url=accept_url,
    )

    _audit(db, current_user.id, current_user.organisation_id, "resend_invite",
           f"Resent invite to {target.email}; email_sent={sent}")
    db.commit()

    return {
        "message": (f"Invite resent to {target.email}" if sent
                    else f"New invite link generated. Email delivery is not configured — share this link manually."),
        "email_sent": sent,
        "accept_url": accept_url if not sent else None,
        "invite_expires_at": (target.created_at + timedelta(days=INVITE_TOKEN_TTL_DAYS)).isoformat(),
    }


@router.patch("/{user_id}")
def update_user_role(
    user_id: str,
    body: RoleUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change a user's role. Blocks:
    - self-demotion from owner (use the owner-transfer flow instead if needed)
    - demoting the last remaining owner (would lock the org out of admin)
    """
    _check_admin(current_user)
    target = db.query(User).filter(
        User.id == user_id,
        User.organisation_id == current_user.organisation_id,
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    new_role = _coerce_role(body.role)
    old_role = target.role

    if new_role == old_role:
        return {"message": "No change", "role": new_role}

    # Admins can't touch owners; only another owner can.
    if current_user.role == "admin" and (old_role == "owner" or new_role == "owner"):
        raise HTTPException(status_code=403, detail="Admins can't manage owner roles — ask an owner")

    # Last-owner guard: if we're demoting an owner, make sure another owner exists.
    if old_role == "owner" and new_role != "owner":
        remaining_owners = db.query(User).filter(
            User.organisation_id == current_user.organisation_id,
            User.role == "owner",
            User.id != target.id,
            User.is_active == True,  # noqa: E712
        ).count()
        if remaining_owners == 0:
            raise HTTPException(status_code=400, detail="Can't demote the last owner. Promote someone else to owner first.")

    target.role = new_role
    _audit(db, current_user.id, current_user.organisation_id, "role_change",
           f"Changed {target.email} from {old_role} to {new_role}")
    db.commit()
    db.refresh(target)

    return {"message": f"Role updated to {new_role}", "role": new_role, "user_id": target.id}


@router.delete("/{user_id}")
def cancel_invite(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancel a pending invite (removes the placeholder User row).
    Deliberately refuses to delete active members — that's a harder flow
    (reassign files, etc.) and not part of invite management."""
    _check_admin(current_user)
    target = db.query(User).filter(
        User.id == user_id,
        User.organisation_id == current_user.organisation_id,
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if not _is_pending(target):
        raise HTTPException(status_code=400, detail="This user has already accepted. Cancelling active members isn't supported here.")

    email = target.email
    db.delete(target)
    _audit(db, current_user.id, current_user.organisation_id, "cancel_invite",
           f"Cancelled pending invite for {email}")
    db.commit()
    return {"message": f"Invite for {email} cancelled"}


# ─── Client-side event logging ────────────────────────────────────────────────
# Small whitelist-guarded endpoint that lets the frontend append audit events
# for user interactions we can't observe server-side (e.g. which page a user
# first lands on after onboarding). Keeping it whitelisted prevents arbitrary
# payloads from flooding the audit log and makes the funnel analysis
# downstream sane — querying AuditLog for action='first_dashboard_viewed'
# gives a clean register → wow-moment conversion rate.
ALLOWED_CLIENT_EVENTS = {
    "first_dashboard_viewed",  # fired by ExecutiveDashboard when ?first_run=true
}


class ClientEventRequest(BaseModel):
    event: str
    detail: str = ""


@router.post("/events")
def log_client_event(
    body: ClientEventRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.event not in ALLOWED_CLIENT_EVENTS:
        raise HTTPException(status_code=400, detail=f"Unknown event: {body.event}")

    detail = (body.detail or "")[:500]
    db.add(AuditLog(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        organisation_id=current_user.organisation_id,
        action=body.event,
        detail=detail,
    ))
    db.commit()
    return {"logged": True}


@router.get("/audit-log")
def get_audit_log(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role not in ["owner", "admin"] and not getattr(current_user, "is_superuser", False):
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

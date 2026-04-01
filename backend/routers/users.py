from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, User, AuditLog, InviteToken
from auth_utils import get_current_user
from config import settings
from datetime import datetime, timedelta
import uuid
import secrets
import hashlib

router = APIRouter()

# ── Helpers ───────────────────────────────────────────────────────────────────

def _send_invite_email(to_email: str, full_name: str, invited_by: str, org_name: str, token: str) -> bool:
    """Send invite email via SendGrid. Returns True on success, False if not configured."""
    if not settings.SENDGRID_API_KEY:
        return False

    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail

        # Accept-invite URL — frontend must have a route at /accept-invite?token=...
        accept_url = f"{settings.FRONTEND_URL.split(',')[0].strip()}/accept-invite?token={token}"

        message = Mail(
            from_email=settings.FROM_EMAIL,
            to_emails=to_email,
            subject=f"You've been invited to join {org_name} on DataHub Pro",
            html_content=f"""
            <p>Hi {full_name or to_email},</p>
            <p><strong>{invited_by}</strong> has invited you to join <strong>{org_name}</strong> on DataHub Pro.</p>
            <p>Click the link below to set your password and activate your account (expires in 72 hours):</p>
            <p><a href="{accept_url}">{accept_url}</a></p>
            <p>If you weren't expecting this invitation, you can safely ignore this email.</p>
            <p>— The DataHub Pro Team</p>
            """,
        )
        sg = sendgrid.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
        response = sg.send(message)
        return response.status_code in (200, 201, 202)
    except Exception:
        return False

# ── Routes ────────────────────────────────────────────────────────────────────

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
            "created_at": m.created_at.isoformat(),
            "last_login": m.last_login.isoformat() if m.last_login else None
        }
        for m in members
    ]


@router.post("/invite")
def invite_user(body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Only owners and admins can invite users")

    org = current_user.organisation
    team_count = db.query(User).filter(User.organisation_id == org.id).count()
    if team_count >= org.max_users:
        raise HTTPException(status_code=429, detail="Team member limit reached. Please upgrade your plan.")

    email = body.get("email", "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create the inactive placeholder user
    new_user = User(
        id=str(uuid.uuid4()),
        email=email,
        hashed_password="!pending_invite_no_login_possible",  # bcrypt will never match this
        full_name=body.get("full_name", ""),
        role=body.get("role", "member"),
        organisation_id=org.id,
        is_active=False,
        is_verified=False,
    )
    db.add(new_user)
    db.flush()  # get new_user.id without full commit

    # Generate a cryptographically secure invite token
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    invite = InviteToken(
        id=str(uuid.uuid4()),
        user_id=new_user.id,
        token_hash=token_hash,
        expires_at=datetime.utcnow() + timedelta(hours=72),
    )
    db.add(invite)
    db.commit()

    # Attempt email delivery
    email_sent = _send_invite_email(
        to_email=email,
        full_name=body.get("full_name", ""),
        invited_by=current_user.full_name or current_user.email,
        org_name=org.name,
        token=raw_token,
    )

    response: dict = {"message": f"Invitation created for {email}"}
    if email_sent:
        response["email_sent"] = True
    else:
        # Dev / unconfigured SendGrid — return the token so the admin can share it manually
        response["email_sent"] = False
        response["invite_token"] = raw_token  # Only returned when email cannot be sent
        response["accept_url"] = (
            f"{settings.FRONTEND_URL.split(',')[0].strip()}/accept-invite?token={raw_token}"
        )

    return response


@router.delete("/team/{user_id}")
def remove_team_member(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Only owners and admins can remove users")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot remove yourself")

    user = db.query(User).filter(
        User.id == user_id,
        User.organisation_id == current_user.organisation_id,
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = False
    db.commit()
    return {"message": "User deactivated"}


@router.get("/audit-log")
def get_audit_log(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    logs = db.query(AuditLog).filter(AuditLog.organisation_id == current_user.organisation_id).order_by(AuditLog.created_at.desc()).offset(skip).limit(min(limit, 500)).all()
    return [
        {
            "id": l.id,
            "action": l.action,
            "detail": l.detail,
            "user_id": l.user_id,
            "created_at": l.created_at.isoformat()
        }
        for l in logs
    ]

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from jose import jwt, JWTError
from database import get_db, User, Organisation, AuditLog, PasswordResetToken
from auth_utils import hash_password, verify_password, create_access_token, create_refresh_token, get_current_user
from config import settings
from datetime import datetime, timedelta
import uuid
import secrets
import hashlib
import logging

logger = logging.getLogger(__name__)

# Password reset tokens are short-lived on purpose — 1h is plenty for a user
# to click a link from their inbox. Any longer and a stolen inbox becomes a
# free account takeover window.
RESET_TOKEN_TTL_MINUTES = 60

router = APIRouter()

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    organisation_name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict

def log_action(db, user_id, org_id, action, detail, ip=None):
    entry = AuditLog(
        id=str(uuid.uuid4()),
        user_id=user_id,
        organisation_id=org_id,
        action=action,
        detail=detail,
        ip_address=ip
    )
    db.add(entry)
    db.commit()

@router.post("/register", status_code=201)
def register(req: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    org_id = str(uuid.uuid4())
    slug = req.organisation_name.lower().replace(" ", "-")[:50] + "-" + org_id[:8]
    org = Organisation(
        id=org_id,
        name=req.organisation_name,
        slug=slug,
        trial_ends_at=datetime.utcnow() + timedelta(days=settings.TRIAL_DAYS)
    )
    db.add(org)

    user_id = str(uuid.uuid4())
    user = User(
        id=user_id,
        email=req.email,
        hashed_password=hash_password(req.password),
        full_name=req.full_name,
        role="owner",
        organisation_id=org_id,
        is_verified=True
    )
    db.add(user)
    db.commit()

    access_token = create_access_token({"sub": user_id})
    refresh_token = create_refresh_token(user_id)

    log_action(db, user_id, org_id, "register", "New account created", request.client.host if request.client else None)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user={"id": user_id, "email": user.email, "full_name": user.full_name, "role": user.role, "is_superuser": bool(getattr(user, "is_superuser", False)), "organisation": org.name, "ai_enabled": bool(getattr(org, "ai_enabled", False))}
    )

@router.post("/login")
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    user.last_login = datetime.utcnow()
    db.commit()

    org = user.organisation
    access_token = create_access_token({"sub": user.id})
    refresh_token = create_refresh_token(user.id)

    log_action(db, user.id, user.organisation_id, "login", "User logged in", request.client.host if request.client else None)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user={"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role, "is_superuser": bool(getattr(user, "is_superuser", False)), "organisation": org.name if org else None, "subscription": org.subscription_status if org else None, "ai_enabled": bool(getattr(org, "ai_enabled", False)) if org else False}
    )

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = current_user.organisation
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        # Platform-level super-admin. Frontend uses this to unlock the
        # /admin dashboard and the Admin sidebar section. Completely
        # separate from `role`.
        "is_superuser": bool(getattr(current_user, "is_superuser", False)),
        "organisation": {
            "id": org.id,
            "name": org.name,
            "subscription_tier": org.subscription_tier.value if org.subscription_tier else None,
            "subscription_status": org.subscription_status,
            "trial_ends_at": org.trial_ends_at.isoformat() if org.trial_ends_at else None,
            "ai_enabled": bool(getattr(org, "ai_enabled", False)),
            "ai_enabled_at": org.ai_enabled_at.isoformat() if getattr(org, "ai_enabled_at", None) else None,
        } if org else None
    }

class InvitePreviewResponse(BaseModel):
    email: str
    full_name: str
    organisation: str
    role: str


class AcceptInviteRequest(BaseModel):
    token: str
    password: str
    full_name: str = ""


def _decode_invite_token(token: str) -> str:
    """Return the user_id embedded in an invite JWT, or raise 400/401."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired invite link")
    if payload.get("type") != "invite":
        raise HTTPException(status_code=400, detail="Invalid invite link")
    uid = payload.get("sub")
    if not uid:
        raise HTTPException(status_code=400, detail="Invalid invite link")
    return uid


@router.get("/invite-preview", response_model=InvitePreviewResponse)
def invite_preview(token: str, db: Session = Depends(get_db)):
    """Let the accept-invite page show who's being invited without requiring auth."""
    uid = _decode_invite_token(token)
    user = db.query(User).filter(User.id == uid).first()
    if not user or user.is_active:
        raise HTTPException(status_code=400, detail="This invite is no longer valid")
    org = user.organisation
    return InvitePreviewResponse(
        email=user.email,
        full_name=user.full_name or "",
        organisation=org.name if org else "",
        role=user.role or "member",
    )


@router.post("/accept-invite")
def accept_invite(req: AcceptInviteRequest, request: Request, db: Session = Depends(get_db)):
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    uid = _decode_invite_token(req.token)
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invite no longer valid")
    if user.is_active:
        raise HTTPException(status_code=400, detail="This account is already active — please log in")

    user.hashed_password = hash_password(req.password)
    if req.full_name.strip():
        user.full_name = req.full_name.strip()
    user.is_active = True
    user.is_verified = True
    user.last_login = datetime.utcnow()
    db.commit()
    db.refresh(user)

    log_action(db, user.id, user.organisation_id, "accept_invite",
               "User accepted invite and set password",
               request.client.host if request.client else None)

    org = user.organisation
    access_token = create_access_token({"sub": user.id})
    refresh_token = create_refresh_token(user.id)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user={
            "id": user.id, "email": user.email, "full_name": user.full_name,
            "role": user.role,
            "is_superuser": bool(getattr(user, "is_superuser", False)),
            "organisation": org.name if org else None,
            "subscription": org.subscription_status if org else None,
            "ai_enabled": bool(getattr(org, "ai_enabled", False)) if org else False,
        }
    )


# ─── Password reset ──────────────────────────────────────────────────────────
# Two-step flow: (1) forgot-password issues a one-time token and emails it,
# (2) reset-password consumes the token and sets a new password. Tokens are
# stored as sha256 hashes so a DB read can't trigger account takeover — the
# raw token only exists in the email.

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _send_reset_email(to_email: str, reset_url: str) -> bool:
    """Fire-and-forget — caller must not rely on the return value for
    response semantics, because forgot-password always responds 200 to avoid
    leaking which emails are registered."""
    if not settings.SENDGRID_API_KEY:
        logger.warning("SENDGRID_API_KEY not set — reset email not sent to %s. Link: %s",
                       to_email, reset_url)
        return False

    html = f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0c1446,#1a2a6c);padding:28px 32px;">
      <div style="color:#fff;font-weight:700;font-size:1rem;opacity:0.9;margin-bottom:12px;">DataHub Pro</div>
      <div style="color:#fff;font-size:1.4rem;font-weight:800;">Reset your password</div>
    </div>
    <div style="padding:28px 32px;color:#374151;font-size:0.95rem;line-height:1.55;">
      <p>We received a request to reset the password for this account. Click the button below to choose a new one. This link expires in {RESET_TOKEN_TTL_MINUTES} minutes.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="{reset_url}" style="display:inline-block;background:#e91e8c;color:#fff;font-weight:700;font-size:0.95rem;padding:13px 32px;border-radius:8px;text-decoration:none;">Reset password →</a>
      </div>
      <p style="color:#6b7280;font-size:0.8rem;">Or copy this link into your browser:<br>
      <span style="color:#6b7280;word-break:break-all;">{reset_url}</span></p>
      <p style="color:#6b7280;font-size:0.8rem;margin-top:20px;">If you didn't request this, you can safely ignore this email — your password won't be changed.</p>
    </div>
  </div>
</body></html>"""

    try:
        import sendgrid as sg_lib
        from sendgrid.helpers.mail import Mail
        msg = Mail(
            from_email=settings.FROM_EMAIL,
            to_emails=to_email,
            subject="Reset your DataHub Pro password",
            html_content=html,
        )
        client = sg_lib.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
        resp = client.send(msg)
        ok = resp.status_code in (200, 201, 202)
        if not ok:
            logger.error("SendGrid returned %d for reset email to %s", resp.status_code, to_email)
        return ok
    except Exception as exc:
        logger.error("Reset email send failed for %s: %s", to_email, exc)
        return False


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    """Always returns 200 regardless of whether the email exists — prevents
    enumeration attacks. If the account does exist, a token is minted and
    emailed; if not, we silently drop the request."""
    user = db.query(User).filter(User.email == req.email).first()

    if user and user.is_active:
        # Invalidate any outstanding unused tokens for this user — only the
        # latest reset link should work.
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        ).update({"used_at": datetime.utcnow()}, synchronize_session=False)

        raw_token = secrets.token_urlsafe(32)
        row = PasswordResetToken(
            id=str(uuid.uuid4()),
            user_id=user.id,
            token_hash=_hash_token(raw_token),
            expires_at=datetime.utcnow() + timedelta(minutes=RESET_TOKEN_TTL_MINUTES),
        )
        db.add(row)
        db.commit()

        reset_url = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={raw_token}"
        _send_reset_email(user.email, reset_url)

        log_action(db, user.id, user.organisation_id, "password_reset_requested",
                   "Password reset link issued",
                   request.client.host if request.client else None)

    return {"message": "If an account with that email exists, we've sent a reset link."}


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    token_hash = _hash_token(req.token)
    row = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == token_hash
    ).first()

    now = datetime.utcnow()
    if not row or row.used_at is not None or row.expires_at < now:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired. Please request a new one.")

    user = db.query(User).filter(User.id == row.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="This reset link is no longer valid")

    user.hashed_password = hash_password(req.new_password)
    row.used_at = now
    db.commit()

    log_action(db, user.id, user.organisation_id, "password_reset_completed",
               "Password reset via email link",
               request.client.host if request.client else None)

    return {"message": "Password reset successful. You can now sign in with your new password."}


@router.post("/change-password")
def change_password(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not verify_password(body.get("current_password", ""), current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    new_pw = body.get("new_password", "")
    if len(new_pw) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    current_user.hashed_password = hash_password(new_pw)
    db.commit()
    return {"message": "Password changed successfully"}

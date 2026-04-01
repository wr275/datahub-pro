from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from database import get_db, User, Organisation, AuditLog, InviteToken
from auth_utils import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    store_refresh_token, validate_and_rotate_refresh_token, revoke_user_refresh_tokens,
    get_current_user,
)
from config import settings
from limiter import limiter
from datetime import datetime, timedelta
import uuid
import hashlib

router = APIRouter()

# ── Request / response models ─────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    organisation_name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str

class AcceptInviteRequest(BaseModel):
    token: str
    password: str
    full_name: str = ""

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict

# ── Helpers ───────────────────────────────────────────────────────────────────

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

def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

# ── Routes ────────────────────────────────────────────────────────────────────
# NOTE: `request: Request` MUST be the first positional parameter on every
# rate-limited handler so slowapi can locate it via args[0].

@router.post("/register", status_code=201)
@limiter.limit("3/minute")
def register(request: Request, req: RegisterRequest, db: Session = Depends(get_db)):
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
    store_refresh_token(db, user_id, refresh_token)

    log_action(db, user_id, org_id, "register", "New account created", _client_ip(request))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user={"id": user_id, "email": user.email, "full_name": user.full_name, "role": user.role, "organisation": org.name}
    )


@router.post("/login")
@limiter.limit("5/minute")
def login(request: Request, req: LoginRequest, db: Session = Depends(get_db)):
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
    store_refresh_token(db, user.id, refresh_token)

    log_action(db, user.id, user.organisation_id, "login", "User logged in", _client_ip(request))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user={
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "organisation": org.name if org else None,
            "subscription": org.subscription_status if org else None
        }
    )


@router.post("/refresh")
def refresh_tokens(req: RefreshRequest, db: Session = Depends(get_db)):
    """Exchange a valid refresh token for a new access + refresh token pair (rotation)."""
    user_id = validate_and_rotate_refresh_token(db, req.refresh_token)

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or disabled")

    new_access = create_access_token({"sub": user_id})
    new_refresh = create_refresh_token(user_id)
    store_refresh_token(db, user_id, new_refresh)

    org = user.organisation
    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        user={
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "organisation": org.name if org else None,
            "subscription": org.subscription_status if org else None
        }
    )


@router.post("/logout")
def logout(req: RefreshRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Revoke the supplied refresh token so it can no longer be rotated."""
    revoke_user_refresh_tokens(db, current_user.id, token=req.refresh_token)
    return {"message": "Logged out successfully"}


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = current_user.organisation
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "organisation": {
            "id": org.id,
            "name": org.name,
            "subscription_tier": org.subscription_tier.value if org.subscription_tier else None,
            "subscription_status": org.subscription_status,
            "trial_ends_at": org.trial_ends_at.isoformat() if org.trial_ends_at else None,
        } if org else None
    }


@router.post("/change-password")
@limiter.limit("5/minute")
def change_password(
    request: Request,
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
    # Revoke all refresh tokens so all other sessions are logged out
    revoke_user_refresh_tokens(db, current_user.id)
    db.commit()
    return {"message": "Password changed successfully"}


@router.post("/accept-invite")
@limiter.limit("10/minute")
def accept_invite(request: Request, req: AcceptInviteRequest, db: Session = Depends(get_db)):
    """
    Activates an invited user account.
    The raw token from the invite email is hashed and looked up in invite_tokens.
    """
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    token_hash = hashlib.sha256(req.token.encode()).hexdigest()
    invite = db.query(InviteToken).filter(
        InviteToken.token_hash == token_hash,
        InviteToken.used_at == None,  # noqa: E711
        InviteToken.expires_at > datetime.utcnow(),
    ).first()

    if not invite:
        raise HTTPException(status_code=400, detail="Invite link is invalid or has expired")

    user = db.query(User).filter(User.id == invite.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_active:
        raise HTTPException(status_code=400, detail="Account is already active")

    # Activate the user
    user.hashed_password = hash_password(req.password)
    if req.full_name:
        user.full_name = req.full_name
    user.is_active = True
    user.is_verified = True
    invite.used_at = datetime.utcnow()
    db.commit()

    # Issue tokens so the user is immediately logged in
    access_token = create_access_token({"sub": user.id})
    refresh_token = create_refresh_token(user.id)
    store_refresh_token(db, user.id, refresh_token)

    org = user.organisation
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user={
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "organisation": org.name if org else None,
        }
    )

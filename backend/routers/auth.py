from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from jose import jwt, JWTError
from database import get_db, User, Organisation, AuditLog
from auth_utils import hash_password, verify_password, create_access_token, create_refresh_token, get_current_user
from config import settings
from datetime import datetime, timedelta
import uuid

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
        user={"id": user_id, "email": user.email, "full_name": user.full_name, "role": user.role, "organisation": org.name, "ai_enabled": bool(getattr(org, "ai_enabled", False))}
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
        user={"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role, "organisation": org.name if org else None, "subscription": org.subscription_status if org else None, "ai_enabled": bool(getattr(org, "ai_enabled", False)) if org else False}
    )

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
            "organisation": org.name if org else None,
            "subscription": org.subscription_status if org else None,
            "ai_enabled": bool(getattr(org, "ai_enabled", False)) if org else False,
        }
    )


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

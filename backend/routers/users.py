from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, User, AuditLog
from auth_utils import get_current_user
import uuid

router = APIRouter()

@router.get("/team")
def get_team(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    members = db.query(User).filter(User.organisation_id == current_user.organisation_id).all()
    return [
        {
            "id": m.id,
            "email": m.email,
            "full_name": m.full_name,
            "role": m.role,
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

    email = body.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        id=str(uuid.uuid4()),
        email=email,
        hashed_password="pending_invite",
        full_name=body.get("full_name", ""),
        role=body.get("role", "member"),
        organisation_id=org.id,
        is_active=False
    )
    db.add(new_user)
    db.commit()

    return {"message": "Invitation sent to " + email}

@router.get("/audit-log")
def get_audit_log(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    logs = db.query(AuditLog).filter(AuditLog.organisation_id == current_user.organisation_id).order_by(AuditLog.created_at.desc()).limit(500).all()
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

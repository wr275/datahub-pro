from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db, User, RefreshToken
from config import settings
import uuid
import hashlib

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def _hash_token(token: str) -> str:
    """SHA-256 hex digest — used to store/look-up tokens without keeping raw JWTs in DB."""
    return hashlib.sha256(token.encode()).hexdigest()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    data = {"sub": user_id, "exp": expire, "type": "refresh", "jti": str(uuid.uuid4())}
    return jwt.encode(data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

# ── Refresh-token persistence helpers ────────────────────────────────────────

def store_refresh_token(db: Session, user_id: str, token: str) -> None:
    """Persist a hashed refresh token so it can be revoked on logout."""
    expires = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    row = RefreshToken(
        id=str(uuid.uuid4()),
        user_id=user_id,
        token_hash=_hash_token(token),
        expires_at=expires,
    )
    db.add(row)
    db.commit()

def validate_and_rotate_refresh_token(db: Session, token: str) -> str:
    """
    Verify the JWT, confirm it exists in DB (not revoked/deleted), delete the old
    row, and return the user_id.  Raises 401 if anything is wrong.
    """
    exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "refresh":
            raise exc
        user_id: str = payload.get("sub")
        if not user_id:
            raise exc
    except JWTError:
        raise exc

    token_hash = _hash_token(token)
    row = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash,
        RefreshToken.revoked_at == None,  # noqa: E711
        RefreshToken.expires_at > datetime.utcnow(),
    ).first()
    if not row:
        raise exc

    # Delete old row (token rotation — the caller will store the new one)
    db.delete(row)
    db.commit()
    return user_id

def revoke_user_refresh_tokens(db: Session, user_id: str, token: Optional[str] = None) -> None:
    """
    Revoke refresh tokens for a user.
    If `token` is provided, only that specific token is revoked.
    If `token` is None, all tokens for the user are revoked (e.g. force-logout all sessions).
    """
    now = datetime.utcnow()
    if token:
        token_hash = _hash_token(token)
        db.query(RefreshToken).filter(
            RefreshToken.user_id == user_id,
            RefreshToken.token_hash == token_hash,
        ).delete()
    else:
        db.query(RefreshToken).filter(RefreshToken.user_id == user_id).delete()
    db.commit()

# ── Standard request authentication ──────────────────────────────────────────

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        if user_id is None or token_type != "access":
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if user is None:
        raise credentials_exception
    return user

def require_role(allowed_roles: list):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker

"""
Dashboards — custom layouts built on top of a DataFile.

Storage note: share settings (expiry, password hash, embed flag) live inside
`config_json` under a top-level `share` key, so no schema migration is needed.
Shape:

    {
      "widgets": [...],
      "filters": {"date_column": "...", "from": "...", "to": "...", "dimension": "...", "values": [...]},
      "share":   {"expires_at": "2026-05-30T12:00:00Z", "password_hash": "...", "allow_embed": true}
    }
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from database import get_db, Dashboard, DataFile, User
from auth_utils import get_current_user
import uuid
import json
import io
import csv
import hashlib
import secrets

router = APIRouter()
share_router = APIRouter()


# -- Schemas -----------------------------------------------------------------

class DashboardCreate(BaseModel):
    name: str
    description: Optional[str] = None
    config_json: Optional[str] = None
    file_id: Optional[str] = None


class DashboardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    config_json: Optional[str] = None
    file_id: Optional[str] = None


class ShareSettings(BaseModel):
    is_public: Optional[bool] = None
    # Null clears; "never" means no expiry; ISO datetime otherwise.
    expires_at: Optional[str] = None
    # Set to non-empty to require a password. Send "" to clear.
    password: Optional[str] = None
    allow_embed: Optional[bool] = None
    regenerate_token: Optional[bool] = False


# -- Helpers -----------------------------------------------------------------

def _hash_password(pw: str) -> str:
    if not pw:
        return ""
    salt = secrets.token_hex(8)
    h = hashlib.sha256((salt + pw).encode("utf-8")).hexdigest()
    return f"{salt}${h}"


def _verify_password(pw: str, stored: str) -> bool:
    if not stored:
        return True  # no password set
    if not pw:
        return False
    try:
        salt, h = stored.split("$", 1)
    except ValueError:
        return False
    return hashlib.sha256((salt + pw).encode("utf-8")).hexdigest() == h


def _parse_config(raw: Optional[str]) -> dict:
    if not raw:
        return {}
    try:
        cfg = json.loads(raw)
        return cfg if isinstance(cfg, dict) else {}
    except Exception:
        return {}


def _get_share_settings(cfg: dict) -> dict:
    share = cfg.get("share") or {}
    return {
        "expires_at": share.get("expires_at"),
        "has_password": bool(share.get("password_hash")),
        "allow_embed": bool(share.get("allow_embed", True)),
    }


def dash_dict(d: Dashboard):
    cfg = _parse_config(d.config_json)
    return {
        "id": d.id,
        "name": d.name,
        "description": d.description,
        "config_json": d.config_json,
        "file_id": d.file_id,
        "is_public": getattr(d, "is_public", False),
        "share_token": getattr(d, "share_token", None),
        "share_settings": _get_share_settings(cfg),
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "updated_at": d.updated_at.isoformat() if d.updated_at else None,
    }


def _get_file_data(file_id: str, db: Session):
    """Return parsed CSV data for a DataFile, or None."""
    f = db.query(DataFile).filter(DataFile.id == file_id).first()
    if not f or not f.file_content:
        return None
    text = bytes(f.file_content).decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    headers = list(reader.fieldnames or [])
    rows = [dict(r) for r in reader]
    return {"headers": headers, "rows": rows, "filename": f.original_filename}


# -- Authenticated endpoints -------------------------------------------------

@router.get("/")
def list_dashboards(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Dashboard)
        .filter(Dashboard.organisation_id == current_user.organisation_id)
        .order_by(Dashboard.created_at.desc())
        .all()
    )
    return [dash_dict(d) for d in rows]


@router.post("/")
def create_dashboard(
    body: DashboardCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    d = Dashboard(
        id=str(uuid.uuid4()),
        name=body.name,
        description=body.description,
        config_json=body.config_json,
        file_id=body.file_id,
        is_public=False,
        share_token=str(uuid.uuid4()),
        organisation_id=current_user.organisation_id,
        created_by=current_user.id,
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return dash_dict(d)


@router.put("/{dashboard_id}")
def update_dashboard(
    dashboard_id: str,
    body: DashboardUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    d = db.query(Dashboard).filter(
        Dashboard.id == dashboard_id,
        Dashboard.organisation_id == current_user.organisation_id,
    ).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    if body.name is not None:
        d.name = body.name
    if body.description is not None:
        d.description = body.description
    if body.config_json is not None:
        # Preserve any share settings across an update that might overwrite them
        existing_cfg = _parse_config(d.config_json)
        existing_share = existing_cfg.get("share")
        new_cfg = _parse_config(body.config_json)
        if existing_share is not None and "share" not in new_cfg:
            new_cfg["share"] = existing_share
        d.config_json = json.dumps(new_cfg)
    if body.file_id is not None:
        d.file_id = body.file_id
    db.commit()
    db.refresh(d)
    return dash_dict(d)


@router.delete("/{dashboard_id}")
def delete_dashboard(
    dashboard_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    d = db.query(Dashboard).filter(
        Dashboard.id == dashboard_id,
        Dashboard.organisation_id == current_user.organisation_id,
    ).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    db.delete(d)
    db.commit()
    return {"message": "Deleted"}


# -- Pin-to-dashboard ---------------------------------------------------------
#
# These two endpoints power the "Pin to dashboard" button that appears on every
# chart / KPI / insight across the app. The flow is:
#   1. Client calls GET /most-recent to find out which dashboard to pin to.
#      If the org has no dashboards yet, the response asks the client to create
#      one (or the client can call POST /pin-widget with a special "auto" id).
#   2. Client calls POST /{id}/pin-widget with the widget config.
#   3. Backend appends the widget to config.widgets and bumps updated_at so
#      the same dashboard wins the "most-recent" race for next time.

class PinWidgetRequest(BaseModel):
    type: str  # 'kpi' | 'bar' | 'line' | 'pie' | 'table' | 'insight' | 'note'
    col: Optional[str] = None
    label: Optional[str] = None
    file_id: Optional[str] = None
    extra: Optional[dict] = None  # any tool-specific config (preset, agg_fn, etc.)


@router.get("/most-recent")
def get_most_recent_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the dashboard the user most recently touched, or None if the
    org has no dashboards yet.

    Used by the Pin-to-dashboard button so the user can pin in one click
    without choosing a target."""
    row = (
        db.query(Dashboard)
        .filter(Dashboard.organisation_id == current_user.organisation_id)
        .order_by(Dashboard.updated_at.desc().nullslast(), Dashboard.created_at.desc())
        .first()
    )
    if not row:
        return {"dashboard": None}
    return {"dashboard": dash_dict(row)}


@router.post("/{dashboard_id}/pin-widget")
def pin_widget_to_dashboard(
    dashboard_id: str,
    body: PinWidgetRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Append a widget to a dashboard. Powers the universal Pin button.

    Special-case: if `dashboard_id == 'auto'`, we auto-create or reuse a
    dashboard called "Pinned widgets" so the user never gets stuck on
    'no dashboard yet'."""
    if dashboard_id == "auto":
        d = (
            db.query(Dashboard)
            .filter(
                Dashboard.organisation_id == current_user.organisation_id,
                Dashboard.name == "Pinned widgets",
            )
            .first()
        )
        if not d:
            d = Dashboard(
                id=str(uuid.uuid4()),
                name="Pinned widgets",
                description="Auto-generated dashboard for one-click pinned widgets.",
                config_json=json.dumps({"widgets": [], "filters": {}}),
                file_id=body.file_id,
                is_public=False,
                share_token=str(uuid.uuid4()),
                organisation_id=current_user.organisation_id,
                created_by=current_user.id,
            )
            db.add(d)
            db.flush()
    else:
        d = db.query(Dashboard).filter(
            Dashboard.id == dashboard_id,
            Dashboard.organisation_id == current_user.organisation_id,
        ).first()
        if not d:
            raise HTTPException(status_code=404, detail="Dashboard not found")

    cfg = _parse_config(d.config_json)
    widgets = list(cfg.get("widgets") or [])

    new_widget = {
        "id":    str(uuid.uuid4()),
        "type":  body.type,
        "col":   body.col or "",
        "label": body.label or "",
    }
    if body.extra and isinstance(body.extra, dict):
        # Don't let extra fields overwrite the canonical id/type/col/label
        for k, v in body.extra.items():
            if k not in new_widget:
                new_widget[k] = v

    widgets.append(new_widget)
    cfg["widgets"] = widgets

    # First file_id wins — but if this dashboard has no file yet, take the
    # one the widget was pinned from.
    if body.file_id and not d.file_id:
        d.file_id = body.file_id

    d.config_json = json.dumps(cfg)
    db.commit()
    db.refresh(d)

    return {
        "dashboard_id": d.id,
        "dashboard_name": d.name,
        "widget": new_widget,
        "widget_count": len(widgets),
    }


@router.post("/{dashboard_id}/share")
def toggle_share(
    dashboard_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Flip is_public on/off. Preserves existing share settings."""
    d = db.query(Dashboard).filter(
        Dashboard.id == dashboard_id,
        Dashboard.organisation_id == current_user.organisation_id,
    ).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    try:
        d.is_public = not bool(getattr(d, "is_public", False))
        if not getattr(d, "share_token", None):
            d.share_token = str(uuid.uuid4())
        db.commit()
        db.refresh(d)
        return {
            "is_public": d.is_public,
            "share_token": d.share_token,
            "share_settings": _get_share_settings(_parse_config(d.config_json)),
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{dashboard_id}/share-settings")
def update_share_settings(
    dashboard_id: str,
    body: ShareSettings,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Configure expiry, password, and embed for a dashboard's share link.

    - Pass `password: ""` to clear an existing password.
    - Pass `expires_at: "never"` to clear expiry.
    - Pass `regenerate_token: true` to invalidate the current share URL.
    """
    d = db.query(Dashboard).filter(
        Dashboard.id == dashboard_id,
        Dashboard.organisation_id == current_user.organisation_id,
    ).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    cfg = _parse_config(d.config_json)
    share = dict(cfg.get("share") or {})

    if body.expires_at is not None:
        if body.expires_at == "" or body.expires_at.lower() == "never":
            share.pop("expires_at", None)
        else:
            # Validate ISO-8601
            try:
                datetime.fromisoformat(body.expires_at.replace("Z", "+00:00"))
            except Exception:
                raise HTTPException(status_code=400, detail="expires_at must be ISO-8601")
            share["expires_at"] = body.expires_at

    if body.password is not None:
        if body.password == "":
            share.pop("password_hash", None)
        else:
            if len(body.password) < 4:
                raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
            share["password_hash"] = _hash_password(body.password)

    if body.allow_embed is not None:
        share["allow_embed"] = bool(body.allow_embed)

    if body.is_public is not None:
        d.is_public = bool(body.is_public)
        if d.is_public and not d.share_token:
            d.share_token = str(uuid.uuid4())

    if body.regenerate_token:
        d.share_token = str(uuid.uuid4())

    cfg["share"] = share
    d.config_json = json.dumps(cfg)
    db.commit()
    db.refresh(d)

    return {
        "is_public": d.is_public,
        "share_token": d.share_token,
        "share_settings": _get_share_settings(cfg),
    }


# -- Public share endpoint (no auth required) -------------------------------

@share_router.get("/{token}")
def get_shared_dashboard(
    token: str,
    request: Request,
    db: Session = Depends(get_db),
    x_share_password: Optional[str] = Header(None),
):
    d = db.query(Dashboard).filter(Dashboard.share_token == token).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    if not getattr(d, "is_public", False):
        raise HTTPException(status_code=403, detail="This dashboard is not publicly shared")

    cfg = _parse_config(d.config_json)
    share = cfg.get("share") or {}

    # Expiry gate
    expires_at = share.get("expires_at")
    if expires_at:
        try:
            exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            if exp_dt.tzinfo is None:
                exp_dt = exp_dt.replace(tzinfo=timezone.utc)
            if now > exp_dt:
                raise HTTPException(status_code=410, detail={"code": "share_expired", "message": "This share link has expired"})
        except HTTPException:
            raise
        except Exception:
            pass  # Malformed expiry — fail open rather than lock out

    # Password gate
    stored_hash = share.get("password_hash") or ""
    if stored_hash:
        supplied = x_share_password or request.query_params.get("pw") or ""
        if not _verify_password(supplied, stored_hash):
            raise HTTPException(
                status_code=401,
                detail={"code": "password_required", "message": "This share link is password-protected"},
            )

    # Build response — strip share.password_hash before returning
    result = dash_dict(d)
    try:
        out_cfg = _parse_config(d.config_json)
        if "share" in out_cfg and "password_hash" in out_cfg["share"]:
            del out_cfg["share"]["password_hash"]
        result["config_json"] = json.dumps(out_cfg)
    except Exception:
        pass

    if d.file_id:
        file_data = _get_file_data(d.file_id, db)
        if file_data:
            result["file_data"] = file_data
    return result

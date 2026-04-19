from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db, Dashboard, DataFile, User
from auth_utils import get_current_user
import uuid
import json
import io
import csv

router = APIRouter()
share_router = APIRouter()


# ââ Schemas ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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


# ââ Helpers ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

def dash_dict(d: Dashboard):
    return {
        "id": d.id,
        "name": d.name,
        "description": d.description,
        "config_json": d.config_json,
        "file_id": d.file_id,
        "is_public": getattr(d, "is_public", False),
        "share_token": getattr(d, "share_token", None),
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "updated_at": d.updated_at.isoformat() if d.updated_at else None,
    }


def _get_file_data(file_id: str, db: Session):
    """Return parsed CSV data for a DataFile, or None."""
    f = db.query(DataFile).filter(DataFile.id == file_id).first()
    if not f or not f.file_content:
        return None
    text = f.file_content.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    headers = list(reader.fieldnames or [])
    rows = [dict(r) for r in reader]
    return {"headers": headers, "rows": rows, "filename": f.original_filename}


# ââ Authenticated endpoints ââââââââââââââââââââââââââââââââââââââââââââââââââ

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
        d.config_json = body.config_json
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


@router.post("/{dashboard_id}/share")
def toggle_share(
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
    try:
        d.is_public = not bool(getattr(d, "is_public", False))
        if not getattr(d, "share_token", None):
            d.share_token = str(uuid.uuid4())
        db.commit()
        db.refresh(d)
        return {"is_public": d.is_public, "share_token": d.share_token}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ââ Public share endpoint (no auth required) âââââââââââââââââââââââââââââââââ

@share_router.get("/{token}")
def get_shared_dashboard(token: str, db: Session = Depends(get_db)):
    d = db.query(Dashboard).filter(
        Dashboard.share_token == token,
    ).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    try:
        if not d.is_public:
            raise HTTPException(status_code=403, detail="This dashboard is not publicly shared")
    except AttributeError:
        raise HTTPException(status_code=403, detail="This dashboard is not publicly shared")

    result = dash_dict(d)
    if d.file_id:
        file_data = _get_file_data(d.file_id, db)
        if file_data:
            result["file_data"] = file_data
    return result

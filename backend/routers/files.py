from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from database import get_db, User, DataFile, Organisation
from auth_utils import get_current_user
from config import settings
import uuid
import os
import json
from datetime import datetime

router = APIRouter()

ALLOWED_EXTENSIONS = {".xlsx", ".xls", ".csv"}
MAX_FILE_SIZE = 50 * 1024 * 1024

def save_file_local(file_bytes: bytes, filename: str) -> str:
    os.makedirs(settings.LOCAL_UPLOAD_DIR, exist_ok=True)
    unique_name = str(uuid.uuid4()) + "_" + filename
    path = os.path.join(settings.LOCAL_UPLOAD_DIR, unique_name)
    with open(path, "wb") as f:
        f.write(file_bytes)
    return unique_name

def check_upload_quota(org: Organisation, db: Session) -> bool:
    from sqlalchemy import func
    from database import DataFile
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0)
    count = db.query(DataFile).filter(
        DataFile.organisation_id == org.id,
        DataFile.created_at >= month_start
    ).count()
    return count < org.max_uploads_per_month

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only .xlsx, .xls, and .csv files are allowed")

    org = current_user.organisation
    if not org:
        raise HTTPException(status_code=403, detail="No organisation found")

    if not check_upload_quota(org, db):
        raise HTTPException(status_code=429, detail="Monthly upload limit reached. Please upgrade your plan.")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 50MB.")

    storage_key = save_file_local(content, file.filename)
    file_content_db = content

    row_count = None
    col_count = None
    columns = []
    try:
        import io
        if ext in [".xlsx", ".xls"]:
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True)
            ws = wb.active
            headers = [cell.value for cell in next(ws.iter_rows(min_row=1, max_row=1))]
            columns = [str(h) for h in headers if h is not None]
            row_count = ws.max_row - 1
            col_count = len(columns)
        elif ext == ".csv":
            import csv
            reader = csv.reader(io.StringIO(content.decode("utf-8", errors="ignore")))
            rows = list(reader)
            if rows:
                columns = rows[0]
                row_count = len(rows) - 1
                col_count = len(columns)
    except Exception:
        pass

    file_id = str(uuid.uuid4())
    db_file = DataFile(
        id=file_id,
        filename=storage_key,
        original_filename=file.filename,
        file_size=len(content),
        row_count=row_count,
        column_count=col_count,
        columns_json=json.dumps(columns),
        s3_key=storage_key,
        storage_type="local",
        file_content=file_content_db,
        organisation_id=org.id,
        uploaded_by=current_user.id
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    return {
        "id": file_id,
        "filename": file.filename,
        "size": len(content),
        "rows": row_count,
        "columns": col_count,
        "column_names": columns,
        "uploaded_at": db_file.created_at.isoformat()
    }

@router.get("/")
def list_files(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    files = db.query(DataFile).filter(
        DataFile.organisation_id == current_user.organisation_id
    ).order_by(DataFile.created_at.desc()).all()

    return [
        {
            "id": f.id,
            "filename": f.original_filename,
            "size": f.file_size,
            "row_count": f.row_count,
            "column_count": f.column_count,
            "column_names": json.loads(f.columns_json) if f.columns_json else [],
            "storage_type": f.storage_type,
            "last_synced_at": getattr(f, "last_synced_at", None) and getattr(f, "last_synced_at").isoformat(),
            "uploaded_at": f.created_at.isoformat()
        }
        for f in files
    ]

@router.get("/{file_id}/download")
def get_file_data(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    f = db.query(DataFile).filter(
        DataFile.id == file_id,
        DataFile.organisation_id == current_user.organisation_id
    ).first()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")

    path = os.path.join(settings.LOCAL_UPLOAD_DIR, f.filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    import base64
    with open(path, "rb") as fp:
        data = base64.b64encode(fp.read()).decode()

    return {"filename": f.original_filename, "data": data, "encoding": "base64"}

@router.delete("/{file_id}")
def delete_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    f = db.query(DataFile).filter(
        DataFile.id == file_id,
        DataFile.organisation_id == current_user.organisation_id
    ).first()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")

    path = os.path.join(settings.LOCAL_UPLOAD_DIR, f.filename)
    if os.path.exists(path):
        os.remove(path)

    db.delete(f)
    db.commit()
    return {"message": "File deleted"}

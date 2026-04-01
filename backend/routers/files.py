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
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB supported via R2

# ── Magic-byte signatures (F09) ───────────────────────────────────────────────
# Maps file extension → list of (magic_bytes, offset) tuples.
# A file passes if ANY signature matches.
_MAGIC: dict = {
    ".xlsx": [(b"PK\x03\x04", 0)],           # ZIP / OOXML
    ".xls":  [(b"\xD0\xCF\x11\xE0", 0)],     # OLE2 Compound Document
    ".csv":  None,                             # Pure text — no fixed magic; checked separately
}

def _validate_magic_bytes(ext: str, content: bytes) -> bool:
    """Return True if the file content matches the expected binary signature."""
    sigs = _MAGIC.get(ext)
    if sigs is None:
        # CSV: must be decodable as text (UTF-8 or latin-1)
        for enc in ("utf-8", "latin-1"):
            try:
                content[:4096].decode(enc)
                return True
            except (UnicodeDecodeError, Exception):
                continue
        return False
    for magic, offset in sigs:
        if content[offset: offset + len(magic)] == magic:
            return True
    return False


# ── R2 / S3 helpers ──────────────────────────────────────────────────────────

def _get_s3_client():
    import boto3
    return boto3.client(
        "s3",
        region_name=settings.AWS_REGION,
        endpoint_url=settings.AWS_ENDPOINT_URL,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )

def save_file_r2(file_bytes: bytes, filename: str) -> str:
    unique_name = str(uuid.uuid4()) + "_" + filename
    s3 = _get_s3_client()
    s3.put_object(
        Bucket=settings.AWS_BUCKET_NAME,
        Key=unique_name,
        Body=file_bytes,
    )
    return unique_name

def get_file_r2(s3_key: str) -> bytes:
    s3 = _get_s3_client()
    response = s3.get_object(Bucket=settings.AWS_BUCKET_NAME, Key=s3_key)
    return response["Body"].read()

def delete_file_r2(s3_key: str):
    s3 = _get_s3_client()
    s3.delete_object(Bucket=settings.AWS_BUCKET_NAME, Key=s3_key)


# ── Local storage helper ──────────────────────────────────────────────────────

def save_file_local(file_bytes: bytes, filename: str) -> str:
    os.makedirs(settings.LOCAL_UPLOAD_DIR, exist_ok=True)
    unique_name = str(uuid.uuid4()) + "_" + filename
    path = os.path.join(settings.LOCAL_UPLOAD_DIR, unique_name)
    with open(path, "wb") as f:
        f.write(file_bytes)
    return unique_name


# ── Quota check ───────────────────────────────────────────────────────────────

def check_upload_quota(org: Organisation, db: Session) -> bool:
    from sqlalchemy import func
    from database import DataFile
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0)
    count = db.query(DataFile).filter(
        DataFile.organisation_id == org.id,
        DataFile.created_at >= month_start
    ).count()
    return count < org.max_uploads_per_month


# ── Routes ────────────────────────────────────────────────────────────────────

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
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 500MB.")

    # F09 — Validate file content against expected magic bytes / encoding.
    # Rejects files whose binary content doesn't match the declared extension
    # (e.g. a renamed executable with a .csv extension).
    if not _validate_magic_bytes(ext, content):
        raise HTTPException(
            status_code=400,
            detail=f"File content does not match the declared {ext} format. Please upload a genuine {ext} file."
        )

    # Save to R2 or local disk
    use_r2 = settings.STORAGE_TYPE == "s3" and settings.AWS_BUCKET_NAME
    if use_r2:
        storage_key = save_file_r2(content, file.filename)
        storage_type = "s3"
        file_content_db = None  # Don't store large blobs in DB when using R2
    else:
        storage_key = save_file_local(content, file.filename)
        storage_type = "local"
        file_content_db = content

    # Parse metadata
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
        s3_key=storage_key if use_r2 else None,
        storage_type=storage_type,
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

    import base64

    if f.storage_type == "s3":
        try:
            data_bytes = get_file_r2(f.s3_key)
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"File not found in R2: {str(e)}")
        data = base64.b64encode(data_bytes).decode()
    else:
        path = os.path.join(settings.LOCAL_UPLOAD_DIR, f.filename)
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail="File not found on disk")
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

    if f.storage_type == "s3":
        try:
            delete_file_r2(f.s3_key)
        except Exception:
            pass  # Best-effort: still remove DB record
    else:
        path = os.path.join(settings.LOCAL_UPLOAD_DIR, f.filename)
        if os.path.exists(path):
            os.remove(path)

    db.delete(f)
    db.commit()
    return {"message": "File deleted"}

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db, User, DataFile
from auth_utils import get_current_user
import uuid
import re
import json
import io
import csv
from datetime import datetime

router = APIRouter()

# ── Helpers ────────────────────────────────────────────────────────────────────

def extract_sheet_id(url: str):
    """Extract the spreadsheet ID from any Google Sheets URL format."""
    match = re.search(r'/spreadsheets/d/([a-zA-Z0-9\-_]+)', url)
    if not match:
        return None
    return match.group(1)

def extract_gid(url: str):
    """Extract the tab gid from URL if present (e.g. #gid=123456789)."""
    match = re.search(r'[#&?]gid=(\d+)', url)
    return match.group(1) if match else None

def build_export_url(sheet_id: str, gid: str = None):
    base = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
    if gid and gid != "0":
        base += f"&gid={gid}"
    return base

def fetch_sheet_as_csv(sheet_id: str, gid: str = None) -> bytes:
    """Fetch a publicly shared Google Sheet as CSV bytes."""
    import httpx
    export_url = build_export_url(sheet_id, gid)
    try:
        resp = httpx.get(export_url, follow_redirects=True, timeout=30)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not reach Google Sheets: {str(e)}")

    if resp.status_code == 401 or resp.status_code == 403:
        raise HTTPException(
            status_code=400,
            detail="Sheet is not publicly accessible. Please share it with \"Anyone with the link can view\" and try again."
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=400,
            detail=f"Could not fetch sheet (Google returned {resp.status_code}). Make sure the sheet is shared publicly."
        )

    content_type = resp.headers.get("content-type", "")
    if "text/html" in content_type:
        raise HTTPException(
            status_code=400,
            detail="Sheet is not publicly accessible. Please share it with \"Anyone with the link can view\" and try again."
        )

    return resp.content

def parse_csv_bytes(content: bytes):
    """Parse CSV bytes and return (columns, row_count, col_count)."""
    text = content.decode("utf-8", errors="ignore")
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        raise HTTPException(status_code=400, detail="The sheet appears to be empty.")
    columns = [str(h).strip() for h in rows[0] if str(h).strip()]
    if not columns:
        raise HTTPException(status_code=400, detail="Could not read column headers from the sheet.")
    row_count = len(rows) - 1
    col_count = len(columns)
    return columns, row_count, col_count

# ── Schemas ────────────────────────────────────────────────────────────────────

class ConnectSheetRequest(BaseModel):
    url: str
    display_name: str = ""

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/connect")
async def connect_sheet(
    body: ConnectSheetRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Connect a publicly shared Google Sheet as a DataFile."""
    sheet_id = extract_sheet_id(body.url)
    if not sheet_id:
        raise HTTPException(status_code=400, detail="Invalid Google Sheets URL. Please paste a full link from your browser.")

    gid = extract_gid(body.url)
    content = fetch_sheet_as_csv(sheet_id, gid)
    columns, row_count, col_count = parse_csv_bytes(content)

    # Use provided name or derive from URL
    display_name = body.display_name.strip() or f"Google Sheet ({sheet_id[:8]})"
    if not display_name.endswith(".csv"):
        display_name_stored = display_name + ".csv"
    else:
        display_name_stored = display_name

    org = current_user.organisation
    if not org:
        raise HTTPException(status_code=403, detail="No organisation found")

    file_id = str(uuid.uuid4())
    source_url = body.url.strip()

    db_file = DataFile(
        id=file_id,
        filename=f"sheets_{sheet_id[:16]}_{file_id[:8]}.csv",
        original_filename=display_name_stored,
        file_size=len(content),
        row_count=row_count,
        column_count=col_count,
        columns_json=json.dumps(columns),
        s3_key=None,
        storage_type="google_sheets",
        file_content=content,
        organisation_id=org.id,
        uploaded_by=current_user.id,
        source_url=source_url,
        last_synced_at=datetime.utcnow()
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    return {
        "id": file_id,
        "filename": display_name_stored,
        "size": len(content),
        "rows": row_count,
        "columns": col_count,
        "column_names": columns,
        "source_type": "google_sheets",
        "source_url": source_url,
        "last_synced_at": db_file.last_synced_at.isoformat(),
        "uploaded_at": db_file.created_at.isoformat()
    }


@router.post("/{file_id}/sync")
async def sync_sheet(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Re-fetch the latest data from a connected Google Sheet."""
    db_file = db.query(DataFile).filter(
        DataFile.id == file_id,
        DataFile.organisation_id == current_user.organisation_id
    ).first()

    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
    if db_file.storage_type != "google_sheets":
        raise HTTPException(status_code=400, detail="This file is not a connected Google Sheet")
    if not db_file.source_url:
        raise HTTPException(status_code=400, detail="No source URL stored for this sheet")

    sheet_id = extract_sheet_id(db_file.source_url)
    gid = extract_gid(db_file.source_url)
    content = fetch_sheet_as_csv(sheet_id, gid)
    columns, row_count, col_count = parse_csv_bytes(content)

    db_file.file_content = content
    db_file.file_size = len(content)
    db_file.row_count = row_count
    db_file.column_count = col_count
    db_file.columns_json = json.dumps(columns)
    db_file.last_synced_at = datetime.utcnow()
    db.commit()
    db.refresh(db_file)

    return {
        "id": file_id,
        "filename": db_file.original_filename,
        "rows": row_count,
        "columns": col_count,
        "column_names": columns,
        "last_synced_at": db_file.last_synced_at.isoformat(),
        "message": f"Synced successfully — {row_count:,} rows, {col_count} columns"
    }

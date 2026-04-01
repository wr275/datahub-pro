from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db, User, DataFile
from auth_utils import get_current_user
from config import settings
import json
import os
import io
import math
import statistics

router = APIRouter()

MAX_PREVIEW_ROWS = 1000


# ── File loader (shared pattern with calculated_fields, sharepoint) ───────────

def _load_file_bytes(f: DataFile) -> bytes:
    """Load raw file bytes from BYTEA, local disk, or R2."""
    if f.file_content:
        return bytes(f.file_content)

    if f.storage_type == "s3" and f.s3_key:
        import boto3
        s3 = boto3.client(
            "s3",
            region_name=settings.AWS_REGION,
            endpoint_url=settings.AWS_ENDPOINT_URL,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        response = s3.get_object(Bucket=settings.AWS_BUCKET_NAME, Key=f.s3_key)
        return response["Body"].read()

    # Local disk
    path = os.path.join(settings.LOCAL_UPLOAD_DIR, f.filename)
    if os.path.exists(path):
        with open(path, "rb") as fp:
            return fp.read()

    raise HTTPException(status_code=404, detail="File content not available. Please re-upload.")


def _parse_file(f: DataFile, max_rows: int = None) -> tuple[list[str], list[dict]]:
    """Parse a DataFile into (headers, rows). Rows are dicts keyed by header."""
    raw = _load_file_bytes(f)
    ext = os.path.splitext(f.original_filename)[1].lower()

    if ext in (".xlsx", ".xls"):
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
        ws = wb.active
        header_row = next(ws.iter_rows(min_row=1, max_row=1, values_only=True), None)
        if not header_row:
            return [], []
        headers = [str(h) if h is not None else f"Col{i}" for i, h in enumerate(header_row)]
        rows = []
        for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True)):
            if max_rows and i >= max_rows:
                break
            rows.append({headers[j]: (v if v is not None else "") for j, v in enumerate(row)})
        wb.close()
        return headers, rows

    elif ext == ".csv":
        import csv
        text = raw.decode("utf-8", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        headers = reader.fieldnames or []
        rows = []
        for i, row in enumerate(reader):
            if max_rows and i >= max_rows:
                break
            rows.append(dict(row))
        return list(headers), rows

    raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")


def _safe_float(v) -> float | None:
    try:
        f = float(str(v).replace(",", "").strip())
        return None if math.isnan(f) or math.isinf(f) else f
    except (ValueError, TypeError):
        return None


def _column_stats(values: list) -> dict:
    """Return stats dict for a single column's values."""
    non_null = [v for v in values if v != "" and v is not None]
    count = len(non_null)

    numeric_vals = [_safe_float(v) for v in non_null]
    numeric_vals = [v for v in numeric_vals if v is not None]

    if len(numeric_vals) >= max(1, count * 0.5):
        # Numeric column
        if not numeric_vals:
            return {"type": "numeric", "count": 0}
        mn = min(numeric_vals)
        mx = max(numeric_vals)
        mean = sum(numeric_vals) / len(numeric_vals)
        std = statistics.stdev(numeric_vals) if len(numeric_vals) > 1 else 0.0
        median = statistics.median(numeric_vals)
        return {
            "type": "numeric",
            "count": count,
            "min": mn,
            "max": mx,
            "mean": round(mean, 4),
            "median": round(median, 4),
            "std": round(std, 4),
            "sum": round(sum(numeric_vals), 4),
        }
    else:
        # Text / categorical column
        unique = list(dict.fromkeys(str(v) for v in non_null))
        return {
            "type": "text",
            "count": count,
            "unique": len(unique),
            "top": unique[0] if unique else None,
        }


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/preview/{file_id}")
def preview_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return up to 1000 rows + headers for a file. Used by DataTable, charts, pivot, etc."""
    f = db.query(DataFile).filter(
        DataFile.id == file_id,
        DataFile.organisation_id == current_user.organisation_id,
    ).first()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")

    headers, rows = _parse_file(f, max_rows=MAX_PREVIEW_ROWS)

    # Serialise any non-string values so JSON stays clean
    clean_rows = []
    for row in rows:
        clean_rows.append({k: ("" if v is None else str(v) if not isinstance(v, (str, int, float, bool)) else v) for k, v in row.items()})

    return {"headers": headers, "rows": clean_rows, "total_rows": f.row_count or len(rows)}


@router.post("/summary/{file_id}")
def summarise_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return column-level statistics. Used by DataSummary, KPIDashboard, AutoReport, AIInsights."""
    f = db.query(DataFile).filter(
        DataFile.id == file_id,
        DataFile.organisation_id == current_user.organisation_id,
    ).first()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")

    headers, rows = _parse_file(f)

    summary = {}
    for col in headers:
        values = [row.get(col) for row in rows]
        summary[col] = _column_stats(values)

    return {
        "filename": f.original_filename,
        "rows": len(rows),
        "columns": len(headers),
        "summary": summary,
    }


@router.post("/kpi/{file_id}")
def kpi_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return top-level KPI metrics (numeric column aggregates). Used by KPIDashboard."""
    f = db.query(DataFile).filter(
        DataFile.id == file_id,
        DataFile.organisation_id == current_user.organisation_id,
    ).first()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")

    headers, rows = _parse_file(f)

    kpis = []
    for col in headers:
        values = [_safe_float(row.get(col)) for row in rows]
        values = [v for v in values if v is not None]
        if not values:
            continue
        kpis.append({
            "column": col,
            "sum": round(sum(values), 2),
            "mean": round(sum(values) / len(values), 2),
            "min": round(min(values), 2),
            "max": round(max(values), 2),
            "count": len(values),
        })

    return {"filename": f.original_filename, "kpis": kpis}

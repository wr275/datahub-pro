from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, User, DataFile
from auth_utils import get_current_user
from config import settings
import os
import json
import base64

router = APIRouter()

def load_file_data(file_id: str, org_id: str, db: Session):
    f = db.query(DataFile).filter(DataFile.id == file_id, DataFile.organisation_id == org_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")

    raw = None
    if f.file_content:
        raw = bytes(f.file_content)
    else:
        path = os.path.join(settings.LOCAL_UPLOAD_DIR, f.filename)
        if os.path.exists(path):
            with open(path, "rb") as fp:
                raw = fp.read()
    if not raw:
        raise HTTPException(status_code=404, detail="File content not available. Please re-upload the file.")
    ext = os.path.splitext(f.original_filename)[1].lower()
    rows = []
    import io
    if ext in [".xlsx", ".xls"]:
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
        ws = wb.active
        headers = [str(cell.value) for cell in next(ws.iter_rows(min_row=1, max_row=1))]
        for row in ws.iter_rows(min_row=2, values_only=True):
            rows.append(dict(zip(headers, row)))
    elif ext == ".csv":
        import csv
        reader = csv.DictReader(io.StringIO(raw.decode("utf-8", errors="ignore")))
        rows = list(reader)

    return rows, f.original_filename


@router.get("/preview/{file_id}")
def preview_file(file_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows, filename = load_file_data(file_id, current_user.organisation_id, db)
    if not rows:
        return {"filename": filename, "headers": [], "rows": []}
    headers = list(rows[0].keys())
    return {"filename": filename, "headers": headers, "rows": rows}

@router.post("/summary/{file_id}")
def get_summary(file_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows, filename = load_file_data(file_id, current_user.organisation_id, db)

    if not rows:
        return {"filename": filename, "rows": 0, "columns": [], "summary": {}}

    headers = list(rows[0].keys())
    summary = {}

    for h in headers:
        vals = [r[h] for r in rows if r[h] is not None and r[h] != ""]
        try:
            nums = [float(v) for v in vals]
            summary[h] = {
                "type": "numeric",
                "count": len(nums),
                "sum": round(sum(nums), 2),
                "mean": round(sum(nums) / len(nums), 2) if nums else 0,
                "min": round(min(nums), 2) if nums else 0,
                "max": round(max(nums), 2) if nums else 0
            }
        except (ValueError, TypeError):
            unique = list(set(str(v) for v in vals))
            summary[h] = {
                "type": "text",
                "count": len(vals),
                "unique": len(unique),
                "top_values": unique[:10]
            }

    return {"filename": filename, "rows": len(rows), "columns": len(headers), "summary": summary}

@router.post("/kpi/{file_id}")
def get_kpis(file_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows, filename = load_file_data(file_id, current_user.organisation_id, db)

    if not rows:
        return []

    headers = list(rows[0].keys())
    kpis = []

    for h in headers:
        try:
            nums = [float(r[h]) for r in rows if r[h] is not None and r[h] != ""]
            if nums:
                kpis.append({
                    "column": h,
                    "sum": round(sum(nums), 2),
                    "mean": round(sum(nums) / len(nums), 2),
                    "min": round(min(nums), 2),
                    "max": round(max(nums), 2),
                    "count": len(nums)
                })
        except (ValueError, TypeError):
            pass

    return kpis

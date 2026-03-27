from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db, User, DataFile, Pipeline
from auth_utils import get_current_user
import uuid, json, csv, io
from datetime import datetime
from typing import Optional, List, Any

router = APIRouter()

# -- Pydantic models --

class PipelineStep(BaseModel):
    type: str
    config: dict = {}

class PipelineCreate(BaseModel):
    name: str
    description: Optional[str] = None
    steps: List[PipelineStep] = []

class PipelineUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    steps: Optional[List[PipelineStep]] = None

class RunRequest(BaseModel):
    file_id: str
    save_output: bool = False
    output_name: Optional[str] = None

# -- Transform helpers --

def parse_csv_bytes(data: bytes) -> tuple:
    text = data.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []
    rows = [dict(r) for r in reader]
    return list(headers), rows


def rows_to_csv_bytes(headers: list, rows: list) -> bytes:
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=headers, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    return out.getvalue().encode("utf-8")


def apply_step(headers: list, rows: list, step: dict) -> tuple:
    stype = step.get("type")
    cfg = step.get("config", {})

    if stype == "remove_nulls":
        cols = cfg.get("columns", headers)
        rows = [r for r in rows if all(r.get(c, "").strip() != "" for c in cols)]

    elif stype == "rename_columns":
        mapping = cfg.get("mapping", {})
        new_headers = [mapping.get(h, h) for h in headers]
        rows = [{mapping.get(k, k): v for k, v in r.items()} for r in rows]
        headers = new_headers

    elif stype == "filter_rows":
        col = cfg.get("column", "")
        op = cfg.get("operator", "equals")
        val = cfg.get("value", "")
        def keep(r):
            cell = r.get(col, "")
            if op == "equals": return cell == val
            elif op == "not_equals": return cell != val
            elif op == "contains": return val.lower() in cell.lower()
            elif op == "not_contains": return val.lower() not in cell.lower()
            elif op == "greater_than":
                try: return float(cell) > float(val)
                except: return False
            elif op == "less_than":
                try: return float(cell) < float(val)
                except: return False
            return True
        rows = [r for r in rows if keep(r)]

    elif stype == "join_datasets":
        key = cfg.get("join_key", "")
        csv_text = cfg.get("csv_text", "")
        if key and csv_text:
            reader2 = csv.DictReader(io.StringIO(csv_text))
            right_headers = list(reader2.fieldnames or [])
            right_rows = [dict(r) for r in reader2]
            right_map = {r.get(key, ""): r for r in right_rows}
            new_cols = [h for h in right_headers if h != key and h not in headers]
            headers = headers + new_cols
            merged = []
            for r in rows:
                match = right_map.get(r.get(key, ""), {})
                merged.append({**r, **{c: match.get(c, "") for c in new_cols}})
            rows = merged

    return headers, rows


def run_pipeline_steps(steps_json: str, file_bytes: bytes) -> tuple:
    steps = json.loads(steps_json)
    headers, rows = parse_csv_bytes(file_bytes)
    for step in steps:
        headers, rows = apply_step(headers, rows, step)
    return headers, rows

# -- Endpoints --

@router.get("/")
def list_pipelines(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pipelines = db.query(Pipeline).filter(
        Pipeline.organisation_id == current_user.organisation_id
    ).order_by(Pipeline.created_at.desc()).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "steps": json.loads(p.steps_json),
            "run_count": p.run_count,
            "last_run_at": p.last_run_at.isoformat() if p.last_run_at else None,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in pipelines
    ]


@router.post("/")
def create_pipeline(body: PipelineCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = Pipeline(
        id=str(uuid.uuid4()),
        name=body.name,
        description=body.description,
        steps_json=json.dumps([s.dict() for s in body.steps]),
        organisation_id=current_user.organisation_id,
        created_by=current_user.id,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"id": p.id, "name": p.name, "steps": json.loads(p.steps_json)}


@router.put("/{pipeline_id}")
def update_pipeline(pipeline_id: str, body: PipelineUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = db.query(Pipeline).filter(Pipeline.id == pipeline_id, Pipeline.organisation_id == current_user.organisation_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if body.name is not None:
        p.name = body.name
    if body.description is not None:
        p.description = body.description
    if body.steps is not None:
        p.steps_json = json.dumps([s.dict() for s in body.steps])
    db.commit()
    return {"id": p.id, "name": p.name, "steps": json.loads(p.steps_json)}


@router.delete("/{pipeline_id}")
def delete_pipeline(pipeline_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = db.query(Pipeline).filter(Pipeline.id == pipeline_id, Pipeline.organisation_id == current_user.organisation_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    db.delete(p)
    db.commit()
    return {"ok": True}


@router.post("/{pipeline_id}/preview")
def preview_pipeline(pipeline_id: str, body: RunRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = db.query(Pipeline).filter(Pipeline.id == pipeline_id, Pipeline.organisation_id == current_user.organisation_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    f = db.query(DataFile).filter(DataFile.id == body.file_id, DataFile.organisation_id == current_user.organisation_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    if not f.file_content:
        raise HTTPException(status_code=400, detail="File has no content")
    headers, rows = run_pipeline_steps(p.steps_json, bytes(f.file_content))
    preview_rows = rows[:50]
    return {
        "headers": headers,
        "rows": preview_rows,
        "total_rows": len(rows),
        "preview_rows": len(preview_rows),
    }


@router.post("/{pipeline_id}/run")
def run_pipeline_endpoint(pipeline_id: str, body: RunRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = db.query(Pipeline).filter(Pipeline.id == pipeline_id, Pipeline.organisation_id == current_user.organisation_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    f = db.query(DataFile).filter(DataFile.id == body.file_id, DataFile.organisation_id == current_user.organisation_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    if not f.file_content:
        raise HTTPException(status_code=400, detail="File has no content")
    headers, rows = run_pipeline_steps(p.steps_json, bytes(f.file_content))
    result_bytes = rows_to_csv_bytes(headers, rows)
    p.run_count = (p.run_count or 0) + 1
    p.last_run_at = datetime.utcnow()
    output_file_id = None
    if body.save_output:
        out_name = body.output_name or (p.name + "_output.csv")
        new_file = DataFile(
            id=str(uuid.uuid4()),
            filename=out_name,
            file_content=result_bytes,
            file_size=len(result_bytes),
            file_type="text/csv",
            storage_type="pipeline",
            organisation_id=current_user.organisation_id,
            uploaded_by=current_user.id,
        )
        db.add(new_file)
        output_file_id = new_file.id
    db.commit()
    preview_rows = rows[:50]
    return {
        "headers": headers,
        "rows": preview_rows,
        "total_rows": len(rows),
        "output_file_id": output_file_id,
        "run_count": p.run_count,
    }

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Any, Dict
import uuid
import csv
import io
import json
from datetime import datetime

from database import get_db, Pipeline, DataFile
from routers.auth import get_current_user

router = APIRouter()


class PipelineStep(BaseModel):
    type: str  # remove_nulls, rename_columns, filter_rows, join_datasets
    config: Dict[str, Any] = {}


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
    preview_only: bool = False
    output_name: Optional[str] = None


def parse_csv_bytes(content: bytes) -> list:
    text = content.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    return list(reader)


def rows_to_csv_bytes(rows: list, fieldnames: list = None) -> bytes:
    if not rows:
        return b""
    if fieldnames is None:
        fieldnames = list(rows[0].keys())
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue().encode("utf-8")


def apply_step(rows: list, step: dict) -> list:
    step_type = step.get("type")
    config = step.get("config", {})

    if step_type == "remove_nulls":
        columns = config.get("columns", [])
        if not columns:
            # remove rows where ANY column is null/empty
            return [r for r in rows if all(v and str(v).strip() for v in r.values())]
        else:
            return [r for r in rows if all(r.get(c) and str(r.get(c, "")).strip() for c in columns)]

    elif step_type == "rename_columns":
        mapping = config.get("mapping", {})  # {"old_name": "new_name"}
        result = []
        for row in rows:
            new_row = {}
            for k, v in row.items():
                new_row[mapping.get(k, k)] = v
            result.append(new_row)
        return result

    elif step_type == "filter_rows":
        column = config.get("column", "")
        operator = config.get("operator", "equals")
        value = str(config.get("value", ""))
        result = []
        for row in rows:
            cell = str(row.get(column, ""))
            if operator == "equals" and cell == value:
                result.append(row)
            elif operator == "not_equals" and cell != value:
                result.append(row)
            elif operator == "contains" and value.lower() in cell.lower():
                result.append(row)
            elif operator == "not_contains" and value.lower() not in cell.lower():
                result.append(row)
            elif operator == "greater_than":
                try:
                    if float(cell) > float(value):
                        result.append(row)
                except (ValueError, TypeError):
                    pass
            elif operator == "less_than":
                try:
                    if float(cell) < float(value):
                        result.append(row)
                except (ValueError, TypeError):
                    pass
        return result

    elif step_type == "join_datasets":
        # config: {file_id, join_key_left, join_key_right, join_type}
        # Note: join is done at run-time with db access — skip silently here
        return rows

    return rows


def run_pipeline_steps(rows: list, steps: list, db: Session = None, org_id: str = None) -> list:
    for step in steps:
        step_type = step.get("type")
        if step_type == "join_datasets" and db and org_id:
            config = step.get("config", {})
            join_file_id = config.get("file_id")
            join_key_left = config.get("join_key_left", "id")
            join_key_right = config.get("join_key_right", "id")
            join_type = config.get("join_type", "inner")

            if join_file_id:
                join_file = db.query(DataFile).filter(
                    DataFile.id == join_file_id,
                    DataFile.organisation_id == org_id
                ).first()
                if join_file and join_file.file_content:
                    right_rows = parse_csv_bytes(join_file.file_content)
                    right_index = {str(r.get(join_key_right, "")): r for r in right_rows}
                    result = []
                    for row in rows:
                        key = str(row.get(join_key_left, ""))
                        match = right_index.get(key)
                        if match:
                            merged = {**row, **{f"right_{k}": v for k, v in match.items() if k != join_key_right}}
                            result.append(merged)
                        elif join_type == "left":
                            result.append(row)
                    rows = result
        else:
            rows = apply_step(rows, step)
    return rows


@router.get("/")
def list_pipelines(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    pipelines = db.query(Pipeline).filter(
        Pipeline.organisation_id == current_user.organisation_id
    ).order_by(Pipeline.created_at.desc()).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "steps": json.loads(p.steps_json or "[]"),
            "run_count": p.run_count,
            "last_run_at": p.last_run_at.isoformat() if p.last_run_at else None,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in pipelines
    ]


@router.post("/")
def create_pipeline(
    req: PipelineCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    pipeline = Pipeline(
        id=str(uuid.uuid4()),
        name=req.name,
        description=req.description,
        steps_json=json.dumps([s.dict() for s in req.steps]),
        run_count=0,
        organisation_id=current_user.organisation_id,
        created_by=current_user.id,
    )
    db.add(pipeline)
    db.commit()
    return {"id": pipeline.id, "name": pipeline.name, "message": "Pipeline created"}


@router.put("/{pipeline_id}")
def update_pipeline(
    pipeline_id: str,
    req: PipelineUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    pipeline = db.query(Pipeline).filter(
        Pipeline.id == pipeline_id,
        Pipeline.organisation_id == current_user.organisation_id
    ).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if req.name is not None:
        pipeline.name = req.name
    if req.description is not None:
        pipeline.description = req.description
    if req.steps is not None:
        pipeline.steps_json = json.dumps([s.dict() for s in req.steps])
    db.commit()
    return {"id": pipeline.id, "message": "Pipeline updated"}


@router.delete("/{pipeline_id}")
def delete_pipeline(
    pipeline_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    pipeline = db.query(Pipeline).filter(
        Pipeline.id == pipeline_id,
        Pipeline.organisation_id == current_user.organisation_id
    ).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    db.delete(pipeline)
    db.commit()
    return {"message": "Pipeline deleted"}


@router.post("/{pipeline_id}/preview")
def preview_pipeline(
    pipeline_id: str,
    req: RunRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    pipeline = db.query(Pipeline).filter(
        Pipeline.id == pipeline_id,
        Pipeline.organisation_id == current_user.organisation_id
    ).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    data_file = db.query(DataFile).filter(
        DataFile.id == req.file_id,
        DataFile.organisation_id == current_user.organisation_id
    ).first()
    if not data_file:
        raise HTTPException(status_code=404, detail="File not found")
    if not data_file.file_content:
        raise HTTPException(status_code=400, detail="File has no content")

    rows = parse_csv_bytes(data_file.file_content)
    steps = json.loads(pipeline.steps_json or "[]")
    result = run_pipeline_steps(rows, steps, db, current_user.organisation_id)

    preview = result[:50]
    columns = list(preview[0].keys()) if preview else []

    return {
        "columns": columns,
        "rows": preview,
        "total_rows": len(result),
        "input_rows": len(rows),
    }


@router.post("/{pipeline_id}/run")
def run_pipeline(
    pipeline_id: str,
    req: RunRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    pipeline = db.query(Pipeline).filter(
        Pipeline.id == pipeline_id,
        Pipeline.organisation_id == current_user.organisation_id
    ).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    data_file = db.query(DataFile).filter(
        DataFile.id == req.file_id,
        DataFile.organisation_id == current_user.organisation_id
    ).first()
    if not data_file:
        raise HTTPException(status_code=404, detail="File not found")
    if not data_file.file_content:
        raise HTTPException(status_code=400, detail="File has no content")

    rows = parse_csv_bytes(data_file.file_content)
    steps = json.loads(pipeline.steps_json or "[]")
    result = run_pipeline_steps(rows, steps, db, current_user.organisation_id)

    csv_bytes = rows_to_csv_bytes(result)
    columns = list(result[0].keys()) if result else []
    output_name = req.output_name or f"{pipeline.name}_output_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.csv"

    file_id = str(uuid.uuid4())
    output_file = DataFile(
        id=file_id,
        filename=output_name,
        original_filename=output_name,
        file_size=len(csv_bytes),
        row_count=len(result),
        column_count=len(columns),
        columns_json=json.dumps(columns),
        storage_type="pipeline",
        file_content=csv_bytes,
        organisation_id=current_user.organisation_id,
        uploaded_by=current_user.id,
    )
    db.add(output_file)

    pipeline.run_count = (pipeline.run_count or 0) + 1
    pipeline.last_run_at = datetime.utcnow()
    db.commit()

    return {
        "file_id": file_id,
        "rows_output": len(result),
        "input_rows": len(rows),
        "message": f"Pipeline ran successfully, produced {len(result)} rows"
    }

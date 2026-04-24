"""
Pipelines — repeatable transform sequences on a DataFile.

Pipelines 2.0 changes:
- Join step now supports inner / left / right / outer via a proper hash-join,
  emitting one row per match (fixes the prior bug where duplicate right-keys
  overwrote each other).
- New POST /validate endpoint for live frontend validation; returns per-step
  error messages keyed by step index.
- Preview now calls the same validator and fails fast on 400 if any step has
  an invalid config — with actionable messages like "Filter column 'xxx'
  doesn't exist in the input".
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Any, Dict, Tuple
import uuid
import csv
import io
import json
from datetime import datetime

from database import get_db, Pipeline, DataFile
from routers.auth import get_current_user

router = APIRouter()

JOIN_TYPES = ("inner", "left", "right", "outer")
FILTER_OPERATORS = (
    "equals", "not_equals", "contains", "not_contains",
    "greater_than", "less_than", "greater_or_equal", "less_or_equal",
    "is_empty", "is_not_empty",
)


# -- Schemas ----------------------------------------------------------------

class PipelineStep(BaseModel):
    type: str
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


class ValidateRequest(BaseModel):
    file_id: Optional[str] = None  # source file; optional if caller just wants step-shape checks
    steps: List[PipelineStep] = []


# -- IO helpers -------------------------------------------------------------

def parse_csv_bytes(content: bytes) -> list:
    text = content.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    return list(reader)


def rows_to_csv_bytes(rows: list, fieldnames: list = None) -> bytes:
    if not rows:
        return b""
    if fieldnames is None:
        # Merge columns across rows — joins can produce rows with different keys.
        seen = []
        seen_set = set()
        for r in rows:
            for k in r.keys():
                if k not in seen_set:
                    seen.append(k)
                    seen_set.add(k)
        fieldnames = seen
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue().encode("utf-8")


def _columns_of(rows: list) -> List[str]:
    if not rows:
        return []
    # Use the first row's column order; fall back to merging if needed.
    return list(rows[0].keys())


# -- Step execution ---------------------------------------------------------

def _cmp_numeric(a: str, b: str, op: str) -> bool:
    try:
        af, bf = float(a), float(b)
    except (ValueError, TypeError):
        return False
    if op == "greater_than":     return af > bf
    if op == "less_than":        return af < bf
    if op == "greater_or_equal": return af >= bf
    if op == "less_or_equal":    return af <= bf
    return False


def apply_step(rows: list, step: dict) -> list:
    step_type = step.get("type")
    config = step.get("config", {}) or {}

    if step_type == "remove_nulls":
        columns = config.get("columns") or []
        if not columns:
            return [r for r in rows if all(v and str(v).strip() for v in r.values())]
        return [r for r in rows if all(r.get(c) and str(r.get(c, "")).strip() for c in columns)]

    if step_type == "rename_columns":
        mapping = config.get("mapping") or {}
        if not mapping:
            return rows
        result = []
        for row in rows:
            result.append({mapping.get(k, k): v for k, v in row.items()})
        return result

    if step_type == "filter_rows":
        column = config.get("column", "")
        operator = config.get("operator", "equals")
        value = str(config.get("value", ""))
        value_l = value.lower()
        result = []
        for row in rows:
            cell = str(row.get(column, ""))
            cell_l = cell.lower()
            keep = False
            if operator == "equals":             keep = cell == value
            elif operator == "not_equals":       keep = cell != value
            elif operator == "contains":         keep = value_l in cell_l
            elif operator == "not_contains":     keep = value_l not in cell_l
            elif operator in ("greater_than", "less_than", "greater_or_equal", "less_or_equal"):
                keep = _cmp_numeric(cell, value, operator)
            elif operator == "is_empty":         keep = cell.strip() == ""
            elif operator == "is_not_empty":     keep = cell.strip() != ""
            if keep:
                result.append(row)
        return result

    # join_datasets is handled by run_pipeline_steps — needs DB access.
    return rows


def _do_join(left_rows: list, right_rows: list, left_key: str, right_key: str,
             join_type: str) -> list:
    """Pure-Python hash join supporting inner / left / right / outer.
    One-to-many is emitted as multiple rows (the old implementation silently
    dropped duplicates because it built a dict keyed on the right key)."""

    # Right-side multimap: key -> list of right rows.
    right_index: Dict[str, list] = {}
    for r in right_rows:
        k = str(r.get(right_key, ""))
        right_index.setdefault(k, []).append(r)

    # Columns to pull from the right side (drop the join key itself so we
    # don't end up with both "id" and "right_id").
    right_cols_seen = []
    right_cols_set = set()
    for r in right_rows:
        for c in r.keys():
            if c != right_key and c not in right_cols_set:
                right_cols_seen.append(c)
                right_cols_set.add(c)
    null_right = {f"right_{c}": "" for c in right_cols_seen}

    # Left columns — used for right/outer nulls.
    left_cols_seen = []
    left_cols_set = set()
    for r in left_rows:
        for c in r.keys():
            if c not in left_cols_set:
                left_cols_seen.append(c)
                left_cols_set.add(c)
    null_left = {c: "" for c in left_cols_seen}

    result: list = []

    def _merge(l_row: dict, r_row: dict) -> dict:
        merged = dict(l_row)
        for c in right_cols_seen:
            merged[f"right_{c}"] = r_row.get(c, "")
        return merged

    if join_type in ("inner", "left", "outer"):
        seen_right_keys = set()
        for l in left_rows:
            k = str(l.get(left_key, ""))
            matches = right_index.get(k)
            if matches:
                seen_right_keys.add(k)
                for r in matches:
                    result.append(_merge(l, r))
            elif join_type in ("left", "outer"):
                result.append({**l, **null_right})
            # inner + no match → skip
        if join_type == "outer":
            for r in right_rows:
                k = str(r.get(right_key, ""))
                if k in seen_right_keys:
                    continue
                result.append({**null_left, **{f"right_{c}": r.get(c, "") for c in right_cols_seen}})

    elif join_type == "right":
        # Left-side index for efficient right-sided lookup.
        left_index: Dict[str, list] = {}
        for l in left_rows:
            k = str(l.get(left_key, ""))
            left_index.setdefault(k, []).append(l)
        for r in right_rows:
            k = str(r.get(right_key, ""))
            matches = left_index.get(k)
            if matches:
                for l in matches:
                    result.append(_merge(l, r))
            else:
                result.append({**null_left, **{f"right_{c}": r.get(c, "") for c in right_cols_seen}})

    else:
        # Unknown join type → pass-through.
        result = list(left_rows)

    return result


def run_pipeline_steps(rows: list, steps: list, db: Session = None, org_id: str = None) -> list:
    for step in steps:
        step_type = step.get("type")
        if step_type == "join_datasets" and db and org_id:
            config = step.get("config", {}) or {}
            join_file_id = config.get("file_id")
            join_key_left = config.get("join_key_left", "id")
            join_key_right = config.get("join_key_right", "id")
            join_type = (config.get("join_type") or "inner").lower()
            if join_type not in JOIN_TYPES:
                join_type = "inner"

            if join_file_id:
                join_file = db.query(DataFile).filter(
                    DataFile.id == join_file_id,
                    DataFile.organisation_id == org_id,
                ).first()
                if join_file and join_file.file_content:
                    right_rows = parse_csv_bytes(join_file.file_content)
                    rows = _do_join(rows, right_rows, join_key_left, join_key_right, join_type)
        else:
            rows = apply_step(rows, step)
    return rows


# -- Validation -------------------------------------------------------------

def _columns_after_step(cols_before: List[str], step: dict,
                        db: Session = None, org_id: str = None) -> List[str]:
    """Return the output column list after a step, given its input columns."""
    t = step.get("type")
    cfg = step.get("config") or {}
    if t == "rename_columns":
        mapping = cfg.get("mapping") or {}
        return [mapping.get(c, c) for c in cols_before]
    if t == "join_datasets" and db and org_id and cfg.get("file_id"):
        join_file = db.query(DataFile).filter(
            DataFile.id == cfg.get("file_id"),
            DataFile.organisation_id == org_id,
        ).first()
        if join_file and join_file.file_content:
            right_rows = parse_csv_bytes(join_file.file_content)
            right_cols = _columns_of(right_rows)
            right_key = cfg.get("join_key_right", "id")
            extras = [f"right_{c}" for c in right_cols if c != right_key]
            # Deduplicate while preserving order.
            seen = set(cols_before)
            merged = list(cols_before)
            for e in extras:
                if e not in seen:
                    merged.append(e); seen.add(e)
            return merged
    return list(cols_before)


def _validate_step(step: dict, input_columns: List[str],
                   db: Session = None, org_id: str = None) -> Optional[str]:
    """Return None if the step is valid against the given input columns,
    otherwise a human-readable error string."""
    t = step.get("type")
    cfg = step.get("config") or {}
    if not t:
        return "Step is missing a type"

    if t == "remove_nulls":
        cols = cfg.get("columns") or []
        missing = [c for c in cols if c not in input_columns]
        if missing:
            return f"Columns not found in input: {', '.join(missing)}"
        return None

    if t == "rename_columns":
        mapping = cfg.get("mapping") or {}
        if not mapping:
            return "Rename step has no mappings"
        missing = [k for k in mapping.keys() if k not in input_columns]
        if missing:
            return f"Columns to rename not found in input: {', '.join(missing)}"
        # Check target name collisions with other columns.
        post = _columns_after_step(input_columns, step)
        if len(post) != len(set(post)):
            dupes = [c for c in post if post.count(c) > 1]
            return f"Rename would collide on column(s): {', '.join(sorted(set(dupes)))}"
        return None

    if t == "filter_rows":
        col = (cfg.get("column") or "").strip()
        if not col:
            return "Filter step needs a column"
        if col not in input_columns:
            return f"Filter column '{col}' not found in input"
        op = cfg.get("operator") or ""
        if op not in FILTER_OPERATORS:
            return f"Unknown filter operator: {op}"
        if op not in ("is_empty", "is_not_empty") and (cfg.get("value") is None or str(cfg.get("value", "")) == ""):
            # Allow empty string comparisons intentionally — but warn if clearly empty.
            return "Filter step needs a value (use is_empty/is_not_empty to check for blank cells)"
        return None

    if t == "join_datasets":
        if not cfg.get("file_id"):
            return "Join step needs a dataset"
        lk = cfg.get("join_key_left") or ""
        rk = cfg.get("join_key_right") or ""
        if not lk:
            return "Join step needs a left key"
        if not rk:
            return "Join step needs a right key"
        if lk not in input_columns:
            return f"Join left key '{lk}' not found in input"
        jt = (cfg.get("join_type") or "inner").lower()
        if jt not in JOIN_TYPES:
            return f"Unknown join type: {jt}"
        # Verify the right file + right key exist if we can see the DB.
        if db and org_id:
            join_file = db.query(DataFile).filter(
                DataFile.id == cfg.get("file_id"),
                DataFile.organisation_id == org_id,
            ).first()
            if not join_file:
                return "Join dataset not found in your organisation"
            if join_file.file_content:
                right_rows = parse_csv_bytes(join_file.file_content)
                right_cols = _columns_of(right_rows)
                if rk not in right_cols:
                    return f"Join right key '{rk}' not found in the joined dataset"
        return None

    return f"Unknown step type: {t}"


def _validate_steps(steps: list, input_columns: List[str],
                    db: Session = None, org_id: str = None) -> List[dict]:
    """Validate each step in sequence, simulating column changes between steps.
    Returns a list of {step_index, error} entries for failed steps.
    Keeps going after an error so the frontend can show them all at once."""
    errors = []
    cols = list(input_columns)
    for i, step in enumerate(steps):
        step_d = step if isinstance(step, dict) else step.dict()
        err = _validate_step(step_d, cols, db, org_id)
        if err:
            errors.append({"step_index": i, "error": err})
            # Don't update cols — the step is broken, so downstream checks
            # would cascade off a lie. Keep the pre-step column set.
        else:
            cols = _columns_after_step(cols, step_d, db, org_id)
    return errors


# -- Routes -----------------------------------------------------------------

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
    current_user=Depends(get_current_user),
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
    current_user=Depends(get_current_user),
):
    pipeline = db.query(Pipeline).filter(
        Pipeline.id == pipeline_id,
        Pipeline.organisation_id == current_user.organisation_id,
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
    current_user=Depends(get_current_user),
):
    pipeline = db.query(Pipeline).filter(
        Pipeline.id == pipeline_id,
        Pipeline.organisation_id == current_user.organisation_id,
    ).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    db.delete(pipeline)
    db.commit()
    return {"message": "Pipeline deleted"}


@router.post("/validate")
def validate_steps(
    req: ValidateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Live step-by-step validation for the frontend.
    Returns {errors: [{step_index, error}]}. Empty `errors` means valid.
    If `file_id` is provided, column-existence checks are performed; otherwise
    only shape-level checks (missing config fields) are done."""
    input_columns: List[str] = []
    if req.file_id:
        f = db.query(DataFile).filter(
            DataFile.id == req.file_id,
            DataFile.organisation_id == current_user.organisation_id,
        ).first()
        if not f:
            raise HTTPException(status_code=404, detail="File not found")
        if f.file_content:
            try:
                rows = parse_csv_bytes(f.file_content)
                input_columns = _columns_of(rows)
            except Exception:
                input_columns = []

    steps_dicts = [s.dict() for s in req.steps]
    errors = _validate_steps(steps_dicts, input_columns, db, current_user.organisation_id)
    return {"errors": errors, "input_columns": input_columns}


@router.post("/{pipeline_id}/preview")
def preview_pipeline(
    pipeline_id: str,
    req: RunRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    pipeline = db.query(Pipeline).filter(
        Pipeline.id == pipeline_id,
        Pipeline.organisation_id == current_user.organisation_id,
    ).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    data_file = db.query(DataFile).filter(
        DataFile.id == req.file_id,
        DataFile.organisation_id == current_user.organisation_id,
    ).first()
    if not data_file:
        raise HTTPException(status_code=404, detail="File not found")
    if not data_file.file_content:
        raise HTTPException(status_code=400, detail="File has no content")

    rows = parse_csv_bytes(data_file.file_content)
    steps = json.loads(pipeline.steps_json or "[]")

    # Fail fast on invalid configs with a structured error.
    errors = _validate_steps(steps, _columns_of(rows), db, current_user.organisation_id)
    if errors:
        # Bundle the errors so the frontend can surface per-step messages.
        raise HTTPException(status_code=400, detail={
            "code": "invalid_steps",
            "message": "One or more steps have invalid configuration",
            "errors": errors,
        })

    result = run_pipeline_steps(rows, steps, db, current_user.organisation_id)

    preview = result[:50]
    columns = _columns_of(preview)

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
    current_user=Depends(get_current_user),
):
    pipeline = db.query(Pipeline).filter(
        Pipeline.id == pipeline_id,
        Pipeline.organisation_id == current_user.organisation_id,
    ).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    data_file = db.query(DataFile).filter(
        DataFile.id == req.file_id,
        DataFile.organisation_id == current_user.organisation_id,
    ).first()
    if not data_file:
        raise HTTPException(status_code=404, detail="File not found")
    if not data_file.file_content:
        raise HTTPException(status_code=400, detail="File has no content")

    rows = parse_csv_bytes(data_file.file_content)
    steps = json.loads(pipeline.steps_json or "[]")

    errors = _validate_steps(steps, _columns_of(rows), db, current_user.organisation_id)
    if errors:
        raise HTTPException(status_code=400, detail={
            "code": "invalid_steps",
            "message": "One or more steps have invalid configuration",
            "errors": errors,
        })

    result = run_pipeline_steps(rows, steps, db, current_user.organisation_id)

    csv_bytes = rows_to_csv_bytes(result)
    columns = _columns_of(result)
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
        "message": f"Pipeline ran successfully, produced {len(result)} rows",
    }

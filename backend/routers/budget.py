from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import uuid

from database import get_db, BudgetEntry
from routers.auth import get_current_user

router = APIRouter()


class BudgetEntryCreate(BaseModel):
    budget_name: str
    category: str
    department: Optional[str] = None
    period: str
    budgeted: float = 0.0
    actual: Optional[float] = None
    line_type: str = "expense"


class BudgetUpload(BaseModel):
    budget_name: str
    period: str
    rows: List[dict]


@router.get("/budgets")
def list_budgets(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    rows = (
        db.query(BudgetEntry.budget_name)
        .filter(BudgetEntry.organisation_id == current_user.organisation_id)
        .distinct()
        .all()
    )
    return [r[0] for r in rows]


@router.get("/{budget_name}/summary")
def get_summary(
    budget_name: str,
    period: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(BudgetEntry).filter(
        BudgetEntry.organisation_id == current_user.organisation_id,
        BudgetEntry.budget_name == budget_name,
    )
    if period:
        query = query.filter(BudgetEntry.period == period)
    entries = query.all()
    if not entries:
        return {"entries": [], "totals": {"budgeted": 0, "actual": 0, "variance": 0, "variance_pct": 0}}

    rows = []
    total_budgeted = 0.0
    total_actual = 0.0
    for e in entries:
        actual = e.actual if e.actual is not None else 0.0
        variance = actual - e.budgeted
        variance_pct = round((variance / e.budgeted * 100) if e.budgeted else 0, 1)
        rows.append({
            "id": e.id,
            "category": e.category,
            "department": e.department or "",
            "period": e.period,
            "budgeted": e.budgeted,
            "actual": actual,
            "variance": variance,
            "variance_pct": variance_pct,
            "line_type": e.line_type,
        })
        total_budgeted += e.budgeted
        total_actual += actual

    total_variance = total_actual - total_budgeted
    return {
        "entries": rows,
        "totals": {
            "budgeted": total_budgeted,
            "actual": total_actual,
            "variance": total_variance,
            "variance_pct": round((total_variance / total_budgeted * 100) if total_budgeted else 0, 1),
        },
    }


@router.post("/upload")
def upload_budget(
    payload: BudgetUpload,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    db.query(BudgetEntry).filter(
        BudgetEntry.organisation_id == current_user.organisation_id,
        BudgetEntry.budget_name == payload.budget_name,
        BudgetEntry.period == payload.period,
    ).delete()

    created = 0
    for row in payload.rows:
        actual_val = row.get("actual")
        entry = BudgetEntry(
            id=str(uuid.uuid4()),
            budget_name=payload.budget_name,
            category=row.get("category", "Uncategorised"),
            department=row.get("department"),
            period=payload.period,
            budgeted=float(row.get("budgeted", 0)),
            actual=float(actual_val) if actual_val is not None else None,
            line_type=row.get("line_type", "expense"),
            organisation_id=current_user.organisation_id,
            created_by=current_user.id,
        )
        db.add(entry)
        created += 1
    db.commit()
    return {"created": created, "budget_name": payload.budget_name, "period": payload.period}


@router.delete("/{budget_name}")
def delete_budget(
    budget_name: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    deleted = db.query(BudgetEntry).filter(
        BudgetEntry.organisation_id == current_user.organisation_id,
        BudgetEntry.budget_name == budget_name,
    ).delete()
    db.commit()
    return {"deleted": deleted}

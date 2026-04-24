from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from collections import defaultdict
import uuid

from database import get_db, BudgetEntry
from routers.auth import get_current_user

router = APIRouter()

# -----------------------------------------------------------------------------
# Budget 2.0
# ---------------
# * /summary now groups by period (for trend chart) + returns departments + alerts
# * Alerts: over-budget (> +10%), critical over-budget (> +25%),
#           no-budget-but-spending (budgeted == 0 & actual > 0),
#           under-spent (< -25% — often a sign of delayed delivery / stale data)
# * /{budget}/categories/{category} — drill-down: one category across every period
# * Safer CSV ingest: non-numeric cells become 0 instead of 500-erroring
# -----------------------------------------------------------------------------


# ────────────────────────────── Pydantic models ──────────────────────────────

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


# ────────────────────────────────── Helpers ──────────────────────────────────

def _to_float(val) -> Optional[float]:
    """Best-effort numeric parse. Strips $, commas, spaces, parentheses (neg)."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    if not s:
        return None
    neg = s.startswith("(") and s.endswith(")")
    if neg:
        s = s[1:-1]
    s = s.replace("$", "").replace(",", "").replace(" ", "").strip()
    if not s or s.lower() in ("-", "na", "n/a", "null", "none"):
        return None
    try:
        v = float(s)
        return -v if neg else v
    except (TypeError, ValueError):
        return None


def _variance_row(budgeted: float, actual: float) -> Dict[str, float]:
    variance = actual - budgeted
    variance_pct = round((variance / budgeted * 100) if budgeted else 0.0, 1)
    return {"variance": variance, "variance_pct": variance_pct}


def _classify_alert(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Return an alert dict for a row that needs attention, else None.

    Severity levels (for sorting + colouring):
        critical — spending far over budget, or spending without budget
        warning  — modest overspend or underspend
    """
    budgeted = row["budgeted"]
    actual = row["actual"]
    line_type = row.get("line_type", "expense")

    # "no-budget-but-spending" — budgeted is 0 but money was spent. Only an
    # alert for expense-type entries; revenue with budget=0 is just a
    # bonus/unplanned income.
    if budgeted == 0 and actual > 0 and line_type == "expense":
        return {
            "severity": "critical",
            "kind": "no_budget",
            "category": row["category"],
            "department": row.get("department") or "",
            "period": row["period"],
            "budgeted": 0.0,
            "actual": actual,
            "variance": actual,
            "variance_pct": None,
            "message": f"${actual:,.0f} spent with no budget allocated",
        }

    # No budget + no actual = nothing to say.
    if budgeted == 0:
        return None

    pct = row["variance_pct"]

    # For expenses: positive variance = overspend (bad). For revenue: positive
    # variance = more money than planned (good), so we flip the polarity.
    polarity = 1 if line_type == "expense" else -1
    pct_adj = pct * polarity

    if pct_adj >= 25:
        return {
            "severity": "critical",
            "kind": "over_budget",
            "category": row["category"],
            "department": row.get("department") or "",
            "period": row["period"],
            "budgeted": budgeted,
            "actual": actual,
            "variance": row["variance"],
            "variance_pct": pct,
            "message": f"{pct:+.1f}% vs budget — {'overspend' if line_type == 'expense' else 'shortfall'}",
        }
    if pct_adj >= 10:
        return {
            "severity": "warning",
            "kind": "over_budget",
            "category": row["category"],
            "department": row.get("department") or "",
            "period": row["period"],
            "budgeted": budgeted,
            "actual": actual,
            "variance": row["variance"],
            "variance_pct": pct,
            "message": f"{pct:+.1f}% vs budget",
        }
    if pct_adj <= -25:
        # Deep undershoot — often stale data / delayed invoices. Warning, not critical.
        return {
            "severity": "warning",
            "kind": "under_spent" if line_type == "expense" else "over_delivered",
            "category": row["category"],
            "department": row.get("department") or "",
            "period": row["period"],
            "budgeted": budgeted,
            "actual": actual,
            "variance": row["variance"],
            "variance_pct": pct,
            "message": f"{pct:+.1f}% vs budget — check for stale/missing data"
                       if line_type == "expense"
                       else f"{pct:+.1f}% vs budget — review forecast",
        }
    return None


def _entry_to_row(e: BudgetEntry) -> Dict[str, Any]:
    actual = e.actual if e.actual is not None else 0.0
    v = _variance_row(e.budgeted, actual)
    return {
        "id": e.id,
        "category": e.category,
        "department": e.department or "",
        "period": e.period,
        "budgeted": e.budgeted,
        "actual": actual,
        "actual_reported": e.actual is not None,
        "no_budget": e.budgeted == 0,
        "variance": v["variance"],
        "variance_pct": v["variance_pct"],
        "line_type": e.line_type,
    }


# ────────────────────────────────── Routes ──────────────────────────────────

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
    """Full budget summary — entries, totals, per-period trend, alerts.

    Filtering by `period` scopes `entries`, `totals`, and `alerts` to that
    period; `periods` (for the trend chart) is always returned across the
    full budget so switching period filters doesn't blank the chart.
    """
    base = db.query(BudgetEntry).filter(
        BudgetEntry.organisation_id == current_user.organisation_id,
        BudgetEntry.budget_name == budget_name,
    )
    all_entries = base.all()
    if not all_entries:
        return {
            "entries": [],
            "totals": {"budgeted": 0, "actual": 0, "variance": 0, "variance_pct": 0},
            "periods": [],
            "alerts": [],
            "departments": [],
            "available_periods": [],
        }

    # Full-scope data for the trend chart and filter dropdowns.
    available_periods = sorted({e.period for e in all_entries})
    departments = sorted({(e.department or "") for e in all_entries if e.department})

    period_totals = defaultdict(lambda: {"budgeted": 0.0, "actual": 0.0})
    for e in all_entries:
        pt = period_totals[e.period]
        pt["budgeted"] += e.budgeted
        pt["actual"] += e.actual if e.actual is not None else 0.0
    periods_series = []
    for p in available_periods:
        pt = period_totals[p]
        v = _variance_row(pt["budgeted"], pt["actual"])
        periods_series.append({
            "period": p,
            "budgeted": pt["budgeted"],
            "actual": pt["actual"],
            "variance": v["variance"],
            "variance_pct": v["variance_pct"],
        })

    # Scoped data — entries + totals + alerts respect the `period` filter.
    scoped = [e for e in all_entries if (period is None or e.period == period)]
    rows = [_entry_to_row(e) for e in scoped]

    total_budgeted = sum(r["budgeted"] for r in rows)
    total_actual = sum(r["actual"] for r in rows)
    totals_var = _variance_row(total_budgeted, total_actual)

    alerts = []
    for r in rows:
        a = _classify_alert(r)
        if a:
            alerts.append(a)
    # Worst first: critical before warning, biggest dollar variance first inside tier.
    severity_rank = {"critical": 0, "warning": 1}
    alerts.sort(key=lambda a: (severity_rank.get(a["severity"], 9), -abs(a.get("variance") or 0)))

    return {
        "entries": rows,
        "totals": {
            "budgeted": total_budgeted,
            "actual": total_actual,
            "variance": totals_var["variance"],
            "variance_pct": totals_var["variance_pct"],
            "line_items": len(rows),
            "alert_count": len(alerts),
            "critical_alert_count": sum(1 for a in alerts if a["severity"] == "critical"),
        },
        "periods": periods_series,
        "alerts": alerts,
        "departments": departments,
        "available_periods": available_periods,
    }


@router.get("/{budget_name}/categories/{category}")
def get_category_detail(
    budget_name: str,
    category: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Drill-down: one category across every period of a given budget.

    Returns rows (one per period × department combo) plus a period-grouped
    trend series so the UI can render both a table and a mini chart.
    """
    entries = (
        db.query(BudgetEntry)
        .filter(
            BudgetEntry.organisation_id == current_user.organisation_id,
            BudgetEntry.budget_name == budget_name,
            BudgetEntry.category == category,
        )
        .order_by(BudgetEntry.period.asc())
        .all()
    )
    if not entries:
        raise HTTPException(status_code=404, detail="No entries for that category in that budget")

    rows = [_entry_to_row(e) for e in entries]

    # Collapse to period-level trend (sum across departments within a period).
    by_period = defaultdict(lambda: {"budgeted": 0.0, "actual": 0.0})
    for r in rows:
        by_period[r["period"]]["budgeted"] += r["budgeted"]
        by_period[r["period"]]["actual"] += r["actual"]
    trend = []
    for p in sorted(by_period.keys()):
        bp = by_period[p]
        v = _variance_row(bp["budgeted"], bp["actual"])
        trend.append({
            "period": p,
            "budgeted": bp["budgeted"],
            "actual": bp["actual"],
            "variance": v["variance"],
            "variance_pct": v["variance_pct"],
        })

    totals = {
        "budgeted": sum(r["budgeted"] for r in rows),
        "actual": sum(r["actual"] for r in rows),
    }
    totals.update(_variance_row(totals["budgeted"], totals["actual"]))

    return {
        "category": category,
        "budget_name": budget_name,
        "entries": rows,
        "trend": trend,
        "totals": totals,
    }


@router.post("/upload")
def upload_budget(
    payload: BudgetUpload,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Replace-on-upload semantics: clearing the budget+period slice before insert.
    db.query(BudgetEntry).filter(
        BudgetEntry.organisation_id == current_user.organisation_id,
        BudgetEntry.budget_name == payload.budget_name,
        BudgetEntry.period == payload.period,
    ).delete()

    created = 0
    skipped = 0
    for row in payload.rows:
        category = (row.get("category") or "").strip() or "Uncategorised"
        budgeted = _to_float(row.get("budgeted")) or 0.0
        actual = _to_float(row.get("actual"))  # None when missing / unparseable
        line_type = (row.get("line_type") or "expense").strip().lower()
        if line_type not in ("expense", "revenue"):
            line_type = "expense"

        # Skip truly-empty rows (no category name *and* no numbers)
        if category == "Uncategorised" and budgeted == 0 and actual is None:
            skipped += 1
            continue

        entry = BudgetEntry(
            id=str(uuid.uuid4()),
            budget_name=payload.budget_name,
            category=category,
            department=(row.get("department") or "").strip() or None,
            period=payload.period,
            budgeted=budgeted,
            actual=actual,
            line_type=line_type,
            organisation_id=current_user.organisation_id,
            created_by=current_user.id,
        )
        db.add(entry)
        created += 1
    db.commit()
    return {
        "created": created,
        "skipped": skipped,
        "budget_name": payload.budget_name,
        "period": payload.period,
    }


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

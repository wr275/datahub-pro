"""RFM 2.0 — server-side Recency-Frequency-Monetary segmentation.

Moves the RFM calculation off the client so it can handle large datasets
and exposes three capabilities the 1.0 page was missing:

* **Custom segment definitions** — callers can override the default 5-segment
  model with their own {name, r:[min,max], f:[min,max], m:[min,max]} rules.
* **Time window + recency anchor** — slice the dataset to a trailing window,
  anchor recency to "today" or the dataset's latest transaction.
* **CSV export** — downloadable per-customer scores with segment assignment.
* **LLM action plan** — per-segment suggestions (gated on org.ai_enabled).

The computation is pure-Python (no pandas) and built on the same file-loader
the rest of the analytics surface uses.
"""

from __future__ import annotations

import csv
import io
import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth_utils import get_current_user
from database import get_db, User
from routers.analytics import load_file_data

logger = logging.getLogger(__name__)
router = APIRouter()


# ────────────────────────────── Defaults ──────────────────────────────

DEFAULT_SEGMENTS: List[Dict[str, Any]] = [
    {"name": "Champions",    "r": [4, 5], "f": [4, 5], "m": [4, 5],
     "color": "#e91e8c", "desc": "Bought recently, buy often, spend the most"},
    {"name": "Loyal",        "r": [3, 5], "f": [3, 5], "m": [3, 5],
     "color": "#0097b2", "desc": "Regular buyers with good spend"},
    {"name": "Potential",    "r": [3, 5], "f": [1, 3], "m": [1, 3],
     "color": "#10b981", "desc": "Recent buyers who could become loyal"},
    {"name": "At Risk",      "r": [1, 2], "f": [3, 5], "m": [3, 5],
     "color": "#f59e0b", "desc": "Were loyal but have not bought recently"},
    {"name": "Lost",         "r": [1, 2], "f": [1, 2], "m": [1, 2],
     "color": "#ef4444", "desc": "Low engagement across all dimensions"},
]


# ────────────────────────────── Helpers ──────────────────────────────


def _parse_float(val: Any) -> Optional[float]:
    """Best-effort numeric parse. Handles $, commas, parens, empty."""
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
    if not s:
        return None
    try:
        v = float(s)
        return -v if neg else v
    except (TypeError, ValueError):
        return None


_DATE_FORMATS = (
    "%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ",
    "%m/%d/%Y", "%m/%d/%y", "%d/%m/%Y", "%d/%m/%y",
    "%m-%d-%Y", "%d-%m-%Y",
    "%Y/%m/%d",
)


def _parse_date(val: Any) -> Optional[datetime]:
    """Permissive date parser. Returns None on failure."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    s = str(val).strip()
    if not s:
        return None
    # Trim any time zone suffix that strptime can't handle.
    if s.endswith("Z"):
        s = s[:-1]
    # Try the explicit formats first — fromisoformat handles most ISO variants.
    try:
        return datetime.fromisoformat(s.replace(" ", "T"))
    except (TypeError, ValueError):
        pass
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt)
        except (TypeError, ValueError):
            continue
    return None


def _quintile_score(sorted_vals: List[float], v: float, *, higher_is_better: bool) -> int:
    """Return an integer score 1–5 based on v's position in the sorted list.

    When higher_is_better=False (i.e. recency), fewer days → higher score.
    """
    n = len(sorted_vals)
    if n == 0:
        return 1
    if n == 1:
        return 3  # one-customer edge case, put them in the middle
    # Count values strictly less than v — position in 0..n-1.
    # bisect_left gives the leftmost insertion point equal to # smaller values.
    import bisect
    idx = bisect.bisect_left(sorted_vals, v)
    # Convert to percentile 0..100. We use (idx / (n-1)) to match the 1.0 frontend exactly.
    pct = (idx / (n - 1)) * 100
    if higher_is_better:
        if pct >= 80: return 5
        if pct >= 60: return 4
        if pct >= 40: return 3
        if pct >= 20: return 2
        return 1
    # Inverted for recency (smaller days since last purchase → better)
    if pct <= 20: return 5
    if pct <= 40: return 4
    if pct <= 60: return 3
    if pct <= 80: return 2
    return 1


def _validate_segment(seg: Dict[str, Any]) -> None:
    name = seg.get("name")
    if not name or not isinstance(name, str):
        raise HTTPException(400, "Each segment must have a non-empty name")
    for k in ("r", "f", "m"):
        v = seg.get(k)
        if not (isinstance(v, list) and len(v) == 2):
            raise HTTPException(400, f"Segment '{name}' is missing valid {k} range [min,max]")
        lo, hi = v
        if not (isinstance(lo, int) and isinstance(hi, int) and 1 <= lo <= hi <= 5):
            raise HTTPException(400, f"Segment '{name}' {k} range must be integers with 1 ≤ min ≤ max ≤ 5")


def _assign_segment(r: int, f: int, m: int, segments: List[Dict[str, Any]]) -> str:
    """First-match-wins segment assignment."""
    for s in segments:
        if s["r"][0] <= r <= s["r"][1] and s["f"][0] <= f <= s["f"][1] and s["m"][0] <= m <= s["m"][1]:
            return s["name"]
    return "Other"


def _compute_rfm(
    rows: List[Dict[str, Any]],
    customer_col: str,
    date_col: str,
    monetary_col: str,
    segments: List[Dict[str, Any]],
    anchor: datetime,
    window_days: Optional[int] = None,
) -> Dict[str, Any]:
    """Compute per-customer RFM from raw transaction rows.

    Returns {customers, segment_counts, segment_summary, totals, diagnostics}.
    """
    diagnostics = {
        "total_rows": len(rows),
        "invalid_date": 0,
        "invalid_customer": 0,
        "invalid_monetary": 0,
        "outside_window": 0,
        "kept_transactions": 0,
        "unique_customers": 0,
    }

    window_cutoff: Optional[datetime] = None
    if window_days and window_days > 0:
        window_cutoff = anchor - timedelta(days=window_days)

    customers: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        cid_raw = row.get(customer_col)
        cid = str(cid_raw).strip() if cid_raw is not None else ""
        if not cid:
            diagnostics["invalid_customer"] += 1
            continue

        d = _parse_date(row.get(date_col))
        if d is None:
            diagnostics["invalid_date"] += 1
            continue

        if window_cutoff is not None and d < window_cutoff:
            diagnostics["outside_window"] += 1
            continue
        # Transactions *after* the anchor are filtered too (odd, but harmless).
        if d > anchor:
            diagnostics["outside_window"] += 1
            continue

        mv = _parse_float(row.get(monetary_col))
        if mv is None:
            # Count transactions even if monetary is missing — treat as 0 so we
            # don't silently drop frequency signal, but flag it.
            diagnostics["invalid_monetary"] += 1
            mv = 0.0

        c = customers.setdefault(cid, {"id": cid, "latest": None, "frequency": 0, "monetary": 0.0})
        if c["latest"] is None or d > c["latest"]:
            c["latest"] = d
        c["frequency"] += 1
        c["monetary"] += mv
        diagnostics["kept_transactions"] += 1

    records = list(customers.values())
    diagnostics["unique_customers"] = len(records)

    if not records:
        return {
            "customers": [],
            "segment_counts": {s["name"]: 0 for s in segments},
            "segment_summary": [],
            "totals": {"customers": 0, "transactions": 0, "monetary": 0.0},
            "diagnostics": diagnostics,
            "anchor_date": anchor.isoformat(),
        }

    # Compute recency in days.
    for c in records:
        c["recency"] = max(0, (anchor - c["latest"]).days)

    sorted_rec = sorted(c["recency"] for c in records)
    sorted_freq = sorted(c["frequency"] for c in records)
    sorted_mon = sorted(c["monetary"] for c in records)

    for c in records:
        c["r_score"] = _quintile_score(sorted_rec, c["recency"], higher_is_better=False)
        c["f_score"] = _quintile_score(sorted_freq, c["frequency"], higher_is_better=True)
        c["m_score"] = _quintile_score(sorted_mon, c["monetary"], higher_is_better=True)
        c["segment"] = _assign_segment(c["r_score"], c["f_score"], c["m_score"], segments)

    # Segment counts + summary.
    segment_names = [s["name"] for s in segments] + ["Other"]
    counts = {n: 0 for n in segment_names}
    for c in records:
        counts[c["segment"]] = counts.get(c["segment"], 0) + 1

    summary = []
    total_cust = len(records)
    for s in segments:
        group = [c for c in records if c["segment"] == s["name"]]
        if group:
            avg_mon = sum(c["monetary"] for c in group) / len(group)
            avg_freq = sum(c["frequency"] for c in group) / len(group)
            avg_rec = sum(c["recency"] for c in group) / len(group)
            total_mon = sum(c["monetary"] for c in group)
        else:
            avg_mon = avg_freq = avg_rec = total_mon = 0
        summary.append({
            "name": s["name"],
            "color": s.get("color", "#6b7280"),
            "desc": s.get("desc", ""),
            "count": counts.get(s["name"], 0),
            "pct": round((counts.get(s["name"], 0) / total_cust * 100) if total_cust else 0, 1),
            "avg_monetary": round(avg_mon, 2),
            "avg_frequency": round(avg_freq, 2),
            "avg_recency_days": round(avg_rec, 1),
            "total_monetary": round(total_mon, 2),
        })
    # "Other" fallback bucket if any.
    other_group = [c for c in records if c["segment"] == "Other"]
    if other_group:
        summary.append({
            "name": "Other",
            "color": "#6b7280",
            "desc": "Customers who didn't match any defined segment",
            "count": len(other_group),
            "pct": round(len(other_group) / total_cust * 100, 1),
            "avg_monetary": round(sum(c["monetary"] for c in other_group) / len(other_group), 2),
            "avg_frequency": round(sum(c["frequency"] for c in other_group) / len(other_group), 2),
            "avg_recency_days": round(sum(c["recency"] for c in other_group) / len(other_group), 1),
            "total_monetary": round(sum(c["monetary"] for c in other_group), 2),
        })

    totals = {
        "customers": total_cust,
        "transactions": diagnostics["kept_transactions"],
        "monetary": round(sum(c["monetary"] for c in records), 2),
    }

    # Serialisable customer records.
    out_customers = [{
        "id": c["id"],
        "recency": c["recency"],
        "frequency": c["frequency"],
        "monetary": round(c["monetary"], 2),
        "r_score": c["r_score"],
        "f_score": c["f_score"],
        "m_score": c["m_score"],
        "segment": c["segment"],
        "latest": c["latest"].isoformat() if c["latest"] else None,
    } for c in records]
    # Default sort: highest monetary first (most interesting at top).
    out_customers.sort(key=lambda x: x["monetary"], reverse=True)

    return {
        "customers": out_customers,
        "segment_counts": counts,
        "segment_summary": summary,
        "totals": totals,
        "diagnostics": diagnostics,
        "anchor_date": anchor.isoformat(),
    }


def _load_and_prep(
    file_id: str,
    customer_col: str,
    date_col: str,
    monetary_col: str,
    anchor: Optional[str],
    segments_in: Optional[List[Dict[str, Any]]],
    current_user: User,
    db: Session,
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """Shared: load the file, validate columns, resolve anchor, normalise segments."""
    rows, _ = load_file_data(file_id, current_user.organisation_id, db)
    if not rows:
        raise HTTPException(400, "File is empty")

    headers = list(rows[0].keys())
    for col, label in [(customer_col, "customer_col"), (date_col, "date_col"), (monetary_col, "monetary_col")]:
        if col not in headers:
            raise HTTPException(400, f"{label} '{col}' not found in file columns")

    # Resolve anchor. If none provided, use the latest transaction date in the
    # file (NOT "today") so stale datasets still segment meaningfully.
    resolved_anchor: Optional[datetime] = None
    if anchor:
        resolved_anchor = _parse_date(anchor)
        if resolved_anchor is None:
            raise HTTPException(400, f"Invalid anchor date '{anchor}'")
    else:
        latest = None
        for r in rows:
            d = _parse_date(r.get(date_col))
            if d and (latest is None or d > latest):
                latest = d
        resolved_anchor = latest or datetime.utcnow()

    segs = segments_in if segments_in else DEFAULT_SEGMENTS
    for s in segs:
        _validate_segment(s)

    return {"anchor": resolved_anchor, "segments": segs}, rows


# ────────────────────────────── Pydantic models ──────────────────────────────


class Segment(BaseModel):
    name: str
    r: List[int]
    f: List[int]
    m: List[int]
    color: Optional[str] = None
    desc: Optional[str] = None


class AnalyzeRequest(BaseModel):
    file_id: str
    customer_col: str
    date_col: str
    monetary_col: str
    anchor_date: Optional[str] = None      # ISO date. None = latest transaction.
    window_days: Optional[int] = None      # None = all-time. Otherwise trailing window.
    segments: Optional[List[Segment]] = None  # Custom segments, else defaults.


class AiActionRequest(BaseModel):
    segment_name: str
    segment_desc: Optional[str] = None
    count: int
    avg_monetary: float
    avg_frequency: float
    avg_recency_days: float


# ────────────────────────────── Routes ──────────────────────────────


@router.get("/segments/defaults")
def get_default_segments(current_user: User = Depends(get_current_user)):
    """Return the built-in 5-segment model. Used by the editor to populate
    its starting state when the user opens the custom-segments panel."""
    return {"segments": DEFAULT_SEGMENTS}


@router.post("/analyze")
def analyze(
    req: AnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prep, rows = _load_and_prep(
        req.file_id, req.customer_col, req.date_col, req.monetary_col,
        req.anchor_date,
        [s.dict() for s in req.segments] if req.segments else None,
        current_user, db,
    )
    return _compute_rfm(
        rows, req.customer_col, req.date_col, req.monetary_col,
        segments=prep["segments"],
        anchor=prep["anchor"],
        window_days=req.window_days,
    )


@router.post("/export")
def export_csv(
    req: AnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """CSV download of per-customer RFM scores + segment assignment."""
    prep, rows = _load_and_prep(
        req.file_id, req.customer_col, req.date_col, req.monetary_col,
        req.anchor_date,
        [s.dict() for s in req.segments] if req.segments else None,
        current_user, db,
    )
    result = _compute_rfm(
        rows, req.customer_col, req.date_col, req.monetary_col,
        segments=prep["segments"],
        anchor=prep["anchor"],
        window_days=req.window_days,
    )

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "customer_id", "recency_days", "frequency", "monetary",
        "r_score", "f_score", "m_score", "segment", "last_transaction_date",
    ])
    for c in result["customers"]:
        writer.writerow([
            c["id"], c["recency"], c["frequency"], c["monetary"],
            c["r_score"], c["f_score"], c["m_score"], c["segment"], c.get("latest") or "",
        ])

    filename = f"rfm_scores_{req.file_id[:8]}.csv"
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ───── LLM-backed "next best action" per segment (AI add-on gated) ─────

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL = "claude-haiku-4-5-20251001"

ACTION_SYSTEM_PROMPT = """You are a CRM strategist for consumer brands. The user will
describe a customer segment from an RFM analysis (recency, frequency, monetary).
Respond with a short, concrete action plan in valid JSON matching this schema EXACTLY,
with no markdown, no backticks, no prose outside the JSON:

{
  "headline": "One-sentence strategic framing of this segment.",
  "priority": "high" | "medium" | "low",
  "actions": [
    {"channel": "email|sms|paid|retention|sales", "action": "Concrete do-this-next step (≤100 chars)", "rationale": "Why this works for this segment (≤140 chars)"}
  ],
  "email_subject": "An example subject line for an outreach email",
  "email_body": "2-3 short paragraphs of example email copy, first-person singular, no placeholders"
}

Produce 3-5 actions. Keep everything tight and specific — do not hedge."""


def _require_ai(current_user: User) -> None:
    org = current_user.organisation
    if not org or not bool(getattr(org, "ai_enabled", False)):
        raise HTTPException(
            status_code=403,
            detail={"code": "ai_disabled", "message": "AI features are not enabled for this workspace."},
        )


@router.post("/ai-action")
def ai_action(
    req: AiActionRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate an action plan for a given segment. AI-add-on gated."""
    _require_ai(current_user)
    if not ANTHROPIC_API_KEY:
        raise HTTPException(500, "ANTHROPIC_API_KEY not configured")

    user_msg = (
        f"Segment: {req.segment_name}\n"
        f"Description: {req.segment_desc or 'n/a'}\n"
        f"Customers in segment: {req.count}\n"
        f"Avg spend per customer: ${req.avg_monetary:,.2f}\n"
        f"Avg transactions per customer: {req.avg_frequency:.2f}\n"
        f"Avg recency: {req.avg_recency_days:.0f} days since last purchase\n\n"
        "Produce the JSON action plan."
    )

    try:
        with httpx.Client(timeout=45) as client:
            resp = client.post(
                ANTHROPIC_URL,
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": MODEL,
                    "max_tokens": 800,
                    "system": ACTION_SYSTEM_PROMPT,
                    "messages": [{"role": "user", "content": user_msg}],
                },
            )
        result = resp.json()
    except httpx.HTTPError as e:
        logger.exception("rfm ai-action: LLM call failed")
        raise HTTPException(502, f"LLM request failed: {e}")

    content_blocks = result.get("content") or []
    text = ""
    for b in content_blocks:
        if isinstance(b, dict) and b.get("type") == "text":
            text += b.get("text") or ""
    text = text.strip()
    # Strip stray markdown fences if Claude slipped up.
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].lstrip()
    try:
        plan = json.loads(text)
    except Exception:
        logger.warning("rfm ai-action: failed to parse LLM JSON. Raw: %s", text[:400])
        raise HTTPException(502, "LLM returned an unparseable response — try again.")

    return {"segment": req.segment_name, "plan": plan, "usage": result.get("usage") or {}}

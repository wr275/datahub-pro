"""
Scheduled Reports — CRUD, email delivery, and job execution.
Routes (registered under /api/v1/scheduled-reports and /api/scheduled-reports):
  GET    /               list all for org
  POST   /               create
  PUT    /{id}           update
  DELETE /{id}           delete
  PATCH  /{id}/toggle    pause / resume
  POST   /{id}/send-now  immediate manual trigger
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import json
import io
import os
import csv
import math
import statistics
import logging

from database import get_db, ScheduledReport, DataFile, User
from auth_utils import get_current_user
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Schemas ──────────────────────────────────────────────────────────────────

class ScheduledReportCreate(BaseModel):
    name: str
    report_type: str = "data_summary"
    frequency: str               # daily | weekly | monthly
    day_of_week: Optional[str] = None
    day_of_month: Optional[int] = None
    send_time: str = "08:00"
    recipients: str              # comma-separated
    file_id: Optional[str] = None

class ScheduledReportUpdate(BaseModel):
    name: Optional[str] = None
    report_type: Optional[str] = None
    frequency: Optional[str] = None
    day_of_week: Optional[str] = None
    day_of_month: Optional[int] = None
    send_time: Optional[str] = None
    recipients: Optional[str] = None
    file_id: Optional[str] = None


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _serialize(s: ScheduledReport) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "report_type": s.report_type,
        "frequency": s.frequency,
        "day_of_week": s.day_of_week,
        "day_of_month": s.day_of_month,
        "send_time": s.send_time,
        "recipients": s.recipients,
        "file_id": s.file_id,
        "status": s.status,
        "last_run_at": s.last_run_at.isoformat() if s.last_run_at else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


def _parse_file(f: DataFile) -> tuple[list, list]:
    """Return (headers, rows) from a DataFile."""
    from routers.utils import load_file_bytes
    raw = load_file_bytes(f)
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
        for row in ws.iter_rows(min_row=2, max_row=501, values_only=True):
            rows.append({headers[j]: (v if v is not None else "") for j, v in enumerate(row)})
        wb.close()
        return headers, rows

    text = raw.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    headers = list(reader.fieldnames or [])
    rows = [dict(r) for i, r in enumerate(reader) if i < 500]
    return headers, rows


def _compute_stats(headers: list, rows: list) -> dict:
    """Compute basic numeric stats for up to 5 numeric columns."""
    stats = {}
    if not rows:
        return stats
    count = 0
    for col in headers:
        if count >= 5:
            break
        values = []
        for row in rows:
            v = row.get(col, "")
            try:
                values.append(float(str(v).replace(",", "").strip()))
            except (ValueError, TypeError):
                pass
        if len(values) < 3:
            continue
        stats[col] = {
            "min": f"{min(values):,.2f}",
            "max": f"{max(values):,.2f}",
            "mean": f"{statistics.mean(values):,.2f}",
            "count": len(values),
        }
        count += 1
    return stats


def _build_email_html(schedule: ScheduledReport, data_file: Optional[DataFile],
                      stats: dict, rows_count: int) -> str:
    frontend_url = settings.FRONTEND_URL.split(",")[0].strip()
    now_str = datetime.now(timezone.utc).strftime("%A, %d %B %Y at %H:%M UTC")

    file_section = ""
    if data_file:
        synced = (data_file.last_synced_at or data_file.created_at)
        synced_str = synced.strftime("%d %b %Y %H:%M UTC") if synced else "—"
        file_section = f"""
        <div style="background:#f0f4ff;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
          <div style="font-size:0.8rem;color:#6b7280;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;">Data Source</div>
          <div style="font-weight:700;color:#0c1446;font-size:1rem;">{data_file.original_filename}</div>
          <div style="color:#6b7280;font-size:0.85rem;margin-top:4px;">
            {data_file.row_count:,} rows &nbsp;·&nbsp; {data_file.column_count} columns
            &nbsp;·&nbsp; Last synced {synced_str}
          </div>
        </div>"""

    stats_rows_html = ""
    if stats:
        for col, s in stats.items():
            stats_rows_html += f"""
            <tr>
              <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;color:#374151;font-weight:500;">{col}</td>
              <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;color:#6b7280;text-align:right;">{s['min']}</td>
              <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;color:#0c1446;font-weight:700;text-align:right;">{s['mean']}</td>
              <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;color:#6b7280;text-align:right;">{s['max']}</td>
              <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;color:#9ca3af;text-align:right;">{s['count']:,}</td>
            </tr>"""
        stats_section = f"""
        <div style="margin-bottom:24px;">
          <div style="font-size:0.8rem;color:#6b7280;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.05em;">Key Metrics</div>
          <table style="width:100%;border-collapse:collapse;font-size:0.875rem;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:8px 14px;text-align:left;color:#374151;font-weight:600;border-bottom:2px solid #e5e7eb;">Column</th>
                <th style="padding:8px 14px;text-align:right;color:#374151;font-weight:600;border-bottom:2px solid #e5e7eb;">Min</th>
                <th style="padding:8px 14px;text-align:right;color:#374151;font-weight:600;border-bottom:2px solid #e5e7eb;">Average</th>
                <th style="padding:8px 14px;text-align:right;color:#374151;font-weight:600;border-bottom:2px solid #e5e7eb;">Max</th>
                <th style="padding:8px 14px;text-align:right;color:#374151;font-weight:600;border-bottom:2px solid #e5e7eb;">Rows</th>
              </tr>
            </thead>
            <tbody>{stats_rows_html}</tbody>
          </table>
        </div>"""
    else:
        stats_section = """
        <div style="background:#f9fafb;border-radius:8px;padding:16px 20px;color:#6b7280;font-size:0.875rem;margin-bottom:24px;">
          No numeric data found in the linked file. Connect a file with numeric columns to see stats here.
        </div>"""

    freq_label = schedule.frequency.capitalize()
    if schedule.frequency == "weekly":
        freq_label = f"Weekly · {schedule.day_of_week}s"
    elif schedule.frequency == "monthly":
        freq_label = f"Monthly · Day {schedule.day_of_month}"

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0c1446,#1a2a6c);padding:28px 32px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <div style="width:36px;height:36px;background:#e91e8c;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.1rem;">D</div>
        <span style="color:#fff;font-weight:700;font-size:1rem;opacity:0.9;">DataHub Pro</span>
      </div>
      <div style="color:#fff;font-size:1.4rem;font-weight:800;margin-bottom:4px;">{schedule.name}</div>
      <div style="color:rgba(255,255,255,0.65);font-size:0.85rem;">{freq_label} &nbsp;·&nbsp; {now_str}</div>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">
      {file_section}
      {stats_section}

      <!-- CTA -->
      <div style="text-align:center;margin-top:28px;">
        <a href="{frontend_url}/hub" style="display:inline-block;background:#e91e8c;color:#fff;font-weight:700;font-size:0.9rem;padding:13px 28px;border-radius:8px;text-decoration:none;">
          Open DataHub Pro →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:18px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <div style="color:#9ca3af;font-size:0.78rem;text-align:center;">
        You're receiving this because a scheduled report was set up for your account.<br>
        Manage schedules at <a href="{frontend_url}/scheduled-reports" style="color:#6b7280;">{frontend_url}/scheduled-reports</a>
      </div>
    </div>
  </div>
</body>
</html>"""


def _send_email(to_list: list[str], subject: str, html: str) -> bool:
    """Send via SendGrid. Returns True on success."""
    if not settings.SENDGRID_API_KEY:
        logger.warning("SENDGRID_API_KEY not set — skipping email send")
        return False
    try:
        import sendgrid as sg_lib
        from sendgrid.helpers.mail import Mail, To
        msg = Mail(
            from_email=settings.FROM_EMAIL,
            subject=subject,
            html_content=html,
        )
        msg.to = [To(email=e.strip()) for e in to_list if e.strip()]
        client = sg_lib.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
        resp = client.send(msg)
        ok = resp.status_code in (200, 201, 202)
        if not ok:
            logger.error("SendGrid returned %d", resp.status_code)
        return ok
    except Exception as exc:
        logger.error("SendGrid send failed: %s", exc)
        return False


# ─── Job executor (called by APScheduler) ────────────────────────────────────

def execute_scheduled_report(report_id: str) -> None:
    """Run a scheduled report: generate summary and email recipients."""
    from database import SessionLocal
    db = SessionLocal()
    try:
        schedule = db.query(ScheduledReport).filter(ScheduledReport.id == report_id).first()
        if not schedule or schedule.status != "active":
            return

        data_file = None
        stats: dict = {}
        rows_count = 0

        if schedule.file_id:
            data_file = db.query(DataFile).filter(DataFile.id == schedule.file_id).first()
            if data_file:
                try:
                    headers, rows = _parse_file(data_file)
                    rows_count = len(rows)
                    stats = _compute_stats(headers, rows)
                except Exception as exc:
                    logger.warning("Could not parse file %s: %s", schedule.file_id, exc)

        html = _build_email_html(schedule, data_file, stats, rows_count)
        to_list = [e.strip() for e in schedule.recipients.split(",") if e.strip()]
        subject = f"📊 {schedule.name} — {datetime.now(timezone.utc).strftime('%d %b %Y')}"
        sent = _send_email(to_list, subject, html)

        schedule.last_run_at = datetime.utcnow()
        db.commit()
        logger.info("Executed scheduled report %s — sent=%s", report_id, sent)
    except Exception as exc:
        logger.error("execute_scheduled_report(%s) failed: %s", report_id, exc)
    finally:
        db.close()


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/")
def list_schedules(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(ScheduledReport)
        .filter(ScheduledReport.organisation_id == current_user.organisation_id)
        .order_by(ScheduledReport.created_at.desc())
        .all()
    )
    return [_serialize(r) for r in rows]


@router.post("/", status_code=201)
def create_schedule(
    req: ScheduledReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Validate file belongs to org if provided
    if req.file_id:
        f = db.query(DataFile).filter(
            DataFile.id == req.file_id,
            DataFile.organisation_id == current_user.organisation_id,
        ).first()
        if not f:
            raise HTTPException(status_code=404, detail="File not found")

    schedule = ScheduledReport(
        id=str(uuid.uuid4()),
        name=req.name,
        report_type=req.report_type,
        frequency=req.frequency,
        day_of_week=req.day_of_week,
        day_of_month=req.day_of_month,
        send_time=req.send_time,
        recipients=req.recipients,
        file_id=req.file_id,
        status="active",
        organisation_id=current_user.organisation_id,
        created_by=current_user.id,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)

    from scheduler import register_job
    register_job(schedule)

    return _serialize(schedule)


@router.put("/{schedule_id}")
def update_schedule(
    schedule_id: str,
    req: ScheduledReportUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    schedule = db.query(ScheduledReport).filter(
        ScheduledReport.id == schedule_id,
        ScheduledReport.organisation_id == current_user.organisation_id,
    ).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    for field, value in req.model_dump(exclude_unset=True).items():
        setattr(schedule, field, value)
    schedule.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(schedule)

    from scheduler import register_job, remove_job
    if schedule.status == "active":
        register_job(schedule)
    else:
        remove_job(schedule_id)

    return _serialize(schedule)


@router.delete("/{schedule_id}", status_code=204)
def delete_schedule(
    schedule_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    schedule = db.query(ScheduledReport).filter(
        ScheduledReport.id == schedule_id,
        ScheduledReport.organisation_id == current_user.organisation_id,
    ).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    from scheduler import remove_job
    remove_job(schedule_id)

    db.delete(schedule)
    db.commit()


@router.patch("/{schedule_id}/toggle")
def toggle_schedule(
    schedule_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    schedule = db.query(ScheduledReport).filter(
        ScheduledReport.id == schedule_id,
        ScheduledReport.organisation_id == current_user.organisation_id,
    ).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    from scheduler import register_job, remove_job
    if schedule.status == "active":
        schedule.status = "paused"
        remove_job(schedule_id)
    else:
        schedule.status = "active"
        register_job(schedule)

    db.commit()
    db.refresh(schedule)
    return _serialize(schedule)


@router.post("/{schedule_id}/send-now")
def send_now(
    schedule_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    schedule = db.query(ScheduledReport).filter(
        ScheduledReport.id == schedule_id,
        ScheduledReport.organisation_id == current_user.organisation_id,
    ).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    # Run in background so the request returns quickly
    import threading
    t = threading.Thread(target=execute_scheduled_report, args=[schedule_id], daemon=True)
    t.start()

    return {"message": f"Report '{schedule.name}' queued for immediate delivery"}

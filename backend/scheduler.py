"""
Background scheduler for DataHub Pro.

Wraps APScheduler so the rest of the app doesn't have to know about it.
If APScheduler isn't installed (e.g. an older deployment that hasn't
`pip install -r requirements.txt`'d yet) the module falls back to no-ops
so the API stays up — scheduled jobs simply won't fire, but CRUD works.

Public API
──────────
  start()                  — start the scheduler (idempotent)
  shutdown()               — stop cleanly
  register_job(schedule)   — (re)register a job for a ScheduledReport row
  remove_job(schedule_id)  — remove a job by id
  rehydrate_all(db)        — re-register every active ScheduledReport at startup
"""
from __future__ import annotations
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_scheduler = None          # the APScheduler instance, or None if unavailable
_APSCHEDULER_AVAILABLE = False

try:
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.cron import CronTrigger
    _APSCHEDULER_AVAILABLE = True
except Exception as exc:
    logger.warning("APScheduler not available — scheduled reports will not fire: %s", exc)


# ──────────────────────────────────────────────────────────────────────────────

def _weekday_to_cron(day_of_week: Optional[str]) -> str:
    """APScheduler accepts 'mon,tue,...' or '0-6'. Accept friendly input too."""
    if not day_of_week:
        return "mon"
    d = day_of_week.strip().lower()[:3]
    valid = {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}
    return d if d in valid else "mon"


def _parse_hhmm(hhmm: Optional[str]) -> tuple[int, int]:
    if not hhmm:
        return 8, 0
    try:
        h, m = hhmm.split(":")
        return max(0, min(23, int(h))), max(0, min(59, int(m)))
    except Exception:
        return 8, 0


def _build_trigger(schedule):
    """Build a CronTrigger from a ScheduledReport row."""
    hour, minute = _parse_hhmm(getattr(schedule, "send_time", "08:00"))
    freq = (getattr(schedule, "frequency", "") or "").lower()

    if freq == "daily":
        return CronTrigger(hour=hour, minute=minute)
    if freq == "weekly":
        dow = _weekday_to_cron(getattr(schedule, "day_of_week", None))
        return CronTrigger(day_of_week=dow, hour=hour, minute=minute)
    if freq == "monthly":
        dom = getattr(schedule, "day_of_month", None) or 1
        try:
            dom = max(1, min(28, int(dom)))  # 28 avoids Feb edge cases
        except Exception:
            dom = 1
        return CronTrigger(day=dom, hour=hour, minute=minute)
    # Unknown frequency — fall back to daily
    return CronTrigger(hour=hour, minute=minute)


# ──────────────────────────────────────────────────────────────────────────────

def start() -> None:
    """Start the scheduler. Safe to call more than once."""
    global _scheduler
    if not _APSCHEDULER_AVAILABLE:
        return
    if _scheduler is not None and _scheduler.running:
        return
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.start()
    logger.info("Background scheduler started")


def shutdown() -> None:
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        try:
            _scheduler.shutdown(wait=False)
        except Exception as exc:
            logger.warning("Scheduler shutdown error: %s", exc)
    _scheduler = None


def register_job(schedule) -> None:
    """(Re)register a cron job for a ScheduledReport. No-op if APScheduler
    isn't available or the schedule isn't active."""
    global _scheduler
    if not _APSCHEDULER_AVAILABLE:
        return
    if _scheduler is None or not _scheduler.running:
        start()
    if _scheduler is None:
        return
    if getattr(schedule, "status", "active") != "active":
        remove_job(schedule.id)
        return

    # Imported lazily to avoid a circular import with routers.scheduled_reports
    from routers.scheduled_reports import execute_scheduled_report

    trigger = _build_trigger(schedule)
    try:
        _scheduler.add_job(
            execute_scheduled_report,
            trigger=trigger,
            id=schedule.id,
            args=[schedule.id],
            replace_existing=True,
            misfire_grace_time=60 * 60,  # allow 1h grace after a reboot
            coalesce=True,
        )
        logger.info("Registered scheduled report %s (%s)", schedule.id, schedule.frequency)
    except Exception as exc:
        logger.error("Failed to register job %s: %s", schedule.id, exc)


def remove_job(schedule_id: str) -> None:
    global _scheduler
    if _scheduler is None:
        return
    try:
        _scheduler.remove_job(schedule_id)
        logger.info("Removed scheduled report %s", schedule_id)
    except Exception:
        # Job may not exist; that's fine
        pass


def rehydrate_all(db) -> None:
    """Re-register every active ScheduledReport AND every auto-sync sheet.
    Call once at app startup."""
    if not _APSCHEDULER_AVAILABLE:
        return
    # Scheduled reports
    try:
        from database import ScheduledReport
        rows = db.query(ScheduledReport).filter(ScheduledReport.status == "active").all()
        for r in rows:
            register_job(r)
        logger.info("Rehydrated %d scheduled report job(s)", len(rows))
    except Exception as exc:
        logger.error("rehydrate_all (reports) failed: %s", exc)
    # Google Sheet auto-sync
    try:
        from database import DataFile
        rows = db.query(DataFile).filter(
            DataFile.storage_type == "google_sheets",
            DataFile.sync_frequency.in_(("hourly", "daily")),
        ).all()
        for r in rows:
            register_sheet_sync_job(r)
        logger.info("Rehydrated %d sheet auto-sync job(s)", len(rows))
    except Exception as exc:
        logger.error("rehydrate_all (sheets) failed: %s", exc)
    # SharePoint / OneDrive linked-file auto-sync
    try:
        from database import DataFile
        rows = db.query(DataFile).filter(
            DataFile.sharepoint_item_id.isnot(None),
            DataFile.sync_frequency.in_(("hourly", "daily")),
        ).all()
        for r in rows:
            register_sharepoint_sync_job(r)
        logger.info("Rehydrated %d sharepoint auto-sync job(s)", len(rows))
    except Exception as exc:
        logger.error("rehydrate_all (sharepoint) failed: %s", exc)


# ──────────────────────────────────────────────────────────────────────────────
#  Google Sheet auto-sync jobs
# ──────────────────────────────────────────────────────────────────────────────

def _sheet_job_id(file_id: str) -> str:
    return f"sheet-sync:{file_id}"


def register_sheet_sync_job(data_file) -> None:
    """(Re)register a cron job for auto-syncing one Google Sheet.
    No-op if frequency is 'off' — existing job is removed."""
    global _scheduler
    if not _APSCHEDULER_AVAILABLE:
        return
    if _scheduler is None or not _scheduler.running:
        start()
    if _scheduler is None:
        return

    job_id = _sheet_job_id(data_file.id)
    freq = (getattr(data_file, "sync_frequency", "off") or "off").lower()

    if freq == "off":
        try:
            _scheduler.remove_job(job_id)
        except Exception:
            pass
        return

    if freq == "hourly":
        trigger = CronTrigger(minute=0)  # top of every hour
    elif freq == "daily":
        trigger = CronTrigger(hour=6, minute=0)  # 06:00 UTC daily
    else:
        logger.warning("Unknown sheet sync frequency %s for file %s", freq, data_file.id)
        return

    try:
        from routers.sheets import execute_sheet_sync
        _scheduler.add_job(
            execute_sheet_sync,
            trigger=trigger,
            id=job_id,
            args=[data_file.id],
            replace_existing=True,
            misfire_grace_time=60 * 30,  # 30min grace after a reboot
            coalesce=True,
        )
        logger.info("Registered sheet sync %s (%s)", data_file.id, freq)
    except Exception as exc:
        logger.error("Failed to register sheet sync %s: %s", data_file.id, exc)


def remove_sheet_sync_job(file_id: str) -> None:
    global _scheduler
    if _scheduler is None:
        return
    try:
        _scheduler.remove_job(_sheet_job_id(file_id))
        logger.info("Removed sheet sync %s", file_id)
    except Exception:
        pass


# ──────────────────────────────────────────────────────────────────────────────
#  SharePoint / OneDrive linked-file auto-sync jobs
# ──────────────────────────────────────────────────────────────────────────────

def _sp_job_id(file_id: str) -> str:
    return f"sharepoint-sync:{file_id}"


def register_sharepoint_sync_job(data_file) -> None:
    """(Re)register a cron job for auto-resyncing one SharePoint / OneDrive
    linked file. No-op if frequency is 'off' — existing job is removed."""
    global _scheduler
    if not _APSCHEDULER_AVAILABLE:
        return
    if _scheduler is None or not _scheduler.running:
        start()
    if _scheduler is None:
        return

    job_id = _sp_job_id(data_file.id)
    freq = (getattr(data_file, "sync_frequency", "off") or "off").lower()

    if freq == "off":
        try:
            _scheduler.remove_job(job_id)
        except Exception:
            pass
        return

    if freq == "hourly":
        trigger = CronTrigger(minute=15)  # :15 past every hour (offset from sheets)
    elif freq == "daily":
        trigger = CronTrigger(hour=6, minute=30)  # 06:30 UTC daily (offset from sheets)
    else:
        logger.warning("Unknown sharepoint sync frequency %s for file %s", freq, data_file.id)
        return

    try:
        from routers.sharepoint import execute_sharepoint_resync
        _scheduler.add_job(
            execute_sharepoint_resync,
            trigger=trigger,
            id=job_id,
            args=[data_file.id],
            replace_existing=True,
            misfire_grace_time=60 * 30,  # 30min grace after a reboot
            coalesce=True,
        )
        logger.info("Registered sharepoint sync %s (%s)", data_file.id, freq)
    except Exception as exc:
        logger.error("Failed to register sharepoint sync %s: %s", data_file.id, exc)


def remove_sharepoint_sync_job(file_id: str) -> None:
    global _scheduler
    if _scheduler is None:
        return
    try:
        _scheduler.remove_job(_sp_job_id(file_id))
        logger.info("Removed sharepoint sync %s", file_id)
    except Exception:
        pass

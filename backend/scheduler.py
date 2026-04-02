"""
APScheduler singleton for DataHub Pro.
Uses BackgroundScheduler (thread-based) — suitable for single Railway instance.
Job IDs are "sr_{schedule_id}" for easy lookup.
"""
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import logging

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(timezone="UTC", job_defaults={"misfire_grace_time": 3600})

_DAY_MAP = {
    "Monday": "mon", "Tuesday": "tue", "Wednesday": "wed",
    "Thursday": "thu", "Friday": "fri", "Saturday": "sat", "Sunday": "sun",
}


def _make_trigger(schedule) -> CronTrigger | None:
    parts = schedule.send_time.split(":")
    hour, minute = int(parts[0]), int(parts[1])
    freq = (schedule.frequency or "").lower()
    if freq == "daily":
        return CronTrigger(hour=hour, minute=minute)
    if freq == "weekly":
        dow = _DAY_MAP.get(schedule.day_of_week or "Monday", "mon")
        return CronTrigger(day_of_week=dow, hour=hour, minute=minute)
    if freq == "monthly":
        day = min(schedule.day_of_month or 1, 28)
        return CronTrigger(day=day, hour=hour, minute=minute)
    logger.warning("Unknown frequency %r for schedule %s", schedule.frequency, schedule.id)
    return None


def register_job(schedule) -> None:
    """Add or replace the APScheduler job for a ScheduledReport row."""
    trigger = _make_trigger(schedule)
    if trigger is None:
        return
    # Import here to avoid circular import at module load time
    from routers.scheduled_reports import execute_scheduled_report
    job_id = f"sr_{schedule.id}"
    scheduler.add_job(
        execute_scheduled_report,
        trigger=trigger,
        id=job_id,
        args=[schedule.id],
        replace_existing=True,
    )
    logger.info("Registered job %s (%s %s)", job_id, schedule.frequency, schedule.send_time)


def remove_job(schedule_id: str) -> None:
    job_id = f"sr_{schedule_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
        logger.info("Removed job %s", job_id)


def load_jobs_from_db() -> int:
    """Called at startup — registers all active ScheduledReport rows."""
    from database import SessionLocal, ScheduledReport
    db = SessionLocal()
    count = 0
    try:
        schedules = db.query(ScheduledReport).filter(ScheduledReport.status == "active").all()
        for s in schedules:
            register_job(s)
            count += 1
    except Exception as exc:
        logger.error("Failed to load scheduled report jobs: %s", exc)
    finally:
        db.close()
    return count

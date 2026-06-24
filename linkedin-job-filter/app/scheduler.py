import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from .config import DIGEST_HOUR, DIGEST_MINUTE
from .database import mark_all_seen

logger = logging.getLogger(__name__)


def _scrape_job():
    from .scraper import run_scrape

    logger.info("Scheduled scrape starting...")
    try:
        new_count = run_scrape(headless=True)
        logger.info("Scheduled scrape done. %d new jobs.", new_count)
    except Exception as exc:
        logger.error("Scheduled scrape failed: %s", exc)


def create_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        _scrape_job,
        trigger=CronTrigger(hour=DIGEST_HOUR, minute=DIGEST_MINUTE),
        id="daily_scrape",
        name="Daily LinkedIn Job Scrape",
        replace_existing=True,
        misfire_grace_time=600,
    )
    return scheduler

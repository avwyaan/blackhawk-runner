#!/usr/bin/env python3
"""
LinkedIn Job Filter — entry point.

Usage:
  python main.py            # Start dashboard + daily scheduler
  python main.py scrape     # Run a one-off scrape immediately
"""

import logging
import sys

import uvicorn

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)

from app.config import DASHBOARD_HOST, DASHBOARD_PORT
from app.database import init_db


def main():
    init_db()

    if len(sys.argv) > 1 and sys.argv[1] == "scrape":
        from app.scraper import run_scrape
        new = run_scrape(headless=True)
        print(f"\nDone. {new} new jobs saved.")
        return

    from app.dashboard import app
    from app.scheduler import create_scheduler

    scheduler = create_scheduler()
    scheduler.start()
    print(f"Scheduler started — daily scrape at configured time.")
    print(f"Dashboard → http://localhost:{DASHBOARD_PORT}")

    try:
        uvicorn.run(app, host=DASHBOARD_HOST, port=DASHBOARD_PORT, log_level="warning")
    finally:
        scheduler.shutdown()


if __name__ == "__main__":
    main()

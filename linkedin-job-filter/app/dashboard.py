import logging
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pathlib import Path

from .database import get_all_jobs, get_stats, get_todays_jobs, mark_all_seen

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent.parent

app = FastAPI(title="LinkedIn Job Filter")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")


@app.get("/", response_class=HTMLResponse)
async def index(request: Request, filter: str = "today"):
    stats = get_stats()
    if filter == "today":
        jobs = get_todays_jobs()
    else:
        jobs = get_all_jobs(limit=300)

    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request": request,
            "jobs": [dict(j) for j in jobs],
            "stats": stats,
            "filter": filter,
            "now": datetime.now().strftime("%B %d, %Y %I:%M %p"),
        },
    )


@app.post("/mark-seen")
async def mark_seen():
    mark_all_seen()
    return RedirectResponse("/", status_code=303)


@app.post("/scrape")
async def trigger_scrape():
    """Manual scrape trigger from the dashboard."""
    import threading
    from .scraper import run_scrape

    def _run():
        try:
            run_scrape(headless=True)
        except Exception as exc:
            logger.error("Manual scrape failed: %s", exc)

    threading.Thread(target=_run, daemon=True).start()
    return RedirectResponse("/?triggered=1", status_code=303)

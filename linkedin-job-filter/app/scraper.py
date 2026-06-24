import hashlib
import logging
import time
from typing import Optional

from playwright.sync_api import Page, sync_playwright

from .config import (
    LINKEDIN_EMAIL,
    LINKEDIN_PASSWORD,
    LOCATIONS,
    MAX_PAGES,
    SEARCH_KEYWORDS,
)
from .database import upsert_jobs

logger = logging.getLogger(__name__)

LINKEDIN_LOGIN_URL = "https://www.linkedin.com/login"
LINKEDIN_JOBS_URL = "https://www.linkedin.com/jobs/search/"


def _make_job_id(url: str) -> str:
    return hashlib.sha1(url.encode()).hexdigest()


def _login(page: Page) -> bool:
    try:
        page.goto(LINKEDIN_LOGIN_URL, timeout=30000)
        page.fill("#username", LINKEDIN_EMAIL)
        page.fill("#password", LINKEDIN_PASSWORD)
        page.click('[data-litms-control-urn="login-submit"]')
        page.wait_for_url("**/feed/**", timeout=20000)
        logger.info("LinkedIn login successful")
        return True
    except Exception as exc:
        logger.error("Login failed: %s", exc)
        return False


def _parse_job_cards(page: Page) -> list[dict]:
    jobs = []
    cards = page.query_selector_all(".job-card-container, .jobs-search__results-list > li")
    for card in cards:
        try:
            title_el = card.query_selector(".job-card-list__title, .base-search-card__title")
            company_el = card.query_selector(
                ".job-card-container__company-name, .base-search-card__subtitle"
            )
            location_el = card.query_selector(
                ".job-card-container__metadata-item, .job-search-card__location"
            )
            link_el = card.query_selector("a.job-card-list__title, a.base-card__full-link")
            date_el = card.query_selector("time")

            if not (title_el and company_el and link_el):
                continue

            url = link_el.get_attribute("href") or ""
            if "?" in url:
                url = url.split("?")[0]

            jobs.append(
                {
                    "id": _make_job_id(url),
                    "title": (title_el.inner_text() or "").strip(),
                    "company": (company_el.inner_text() or "").strip(),
                    "location": (location_el.inner_text() if location_el else "").strip(),
                    "posted_date": (
                        date_el.get_attribute("datetime") if date_el else ""
                    ),
                    "job_url": url,
                    "description": "",
                }
            )
        except Exception as exc:
            logger.debug("Card parse error: %s", exc)
    return jobs


def _search_keyword_location(
    page: Page, keyword: str, location: str
) -> list[dict]:
    all_jobs: list[dict] = []
    params = (
        f"?keywords={keyword.replace(' ', '%20')}"
        f"&location={location.replace(' ', '%20')}&f_TPR=r86400"
    )
    if "remote" in location.lower():
        params += "&f_WT=2"

    url = LINKEDIN_JOBS_URL + params
    logger.info("Searching: %s in %s", keyword, location)

    for page_num in range(MAX_PAGES):
        paged_url = url + f"&start={page_num * 25}"
        page.goto(paged_url, timeout=30000)
        page.wait_for_timeout(3000)

        # Scroll to load all cards
        for _ in range(5):
            page.keyboard.press("End")
            page.wait_for_timeout(800)

        jobs = _parse_job_cards(page)
        if not jobs:
            break
        all_jobs.extend(jobs)
        logger.info("Page %d: found %d job cards", page_num + 1, len(jobs))
        time.sleep(2)

    return all_jobs


def run_scrape(headless: bool = True) -> int:
    """Run full scrape cycle. Returns count of new jobs saved."""
    if not LINKEDIN_EMAIL or not LINKEDIN_PASSWORD:
        raise RuntimeError(
            "LINKEDIN_EMAIL and LINKEDIN_PASSWORD must be set in .env"
        )

    total_new = 0
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=headless)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )
        )
        page = context.new_page()

        if not _login(page):
            browser.close()
            raise RuntimeError("LinkedIn login failed — check credentials in .env")

        for keyword in SEARCH_KEYWORDS:
            for location in LOCATIONS:
                try:
                    jobs = _search_keyword_location(page, keyword, location)
                    new = upsert_jobs(jobs)
                    total_new += new
                    logger.info(
                        "%s / %s → %d jobs scraped, %d new", keyword, location, len(jobs), new
                    )
                except Exception as exc:
                    logger.error("Error scraping %s / %s: %s", keyword, location, exc)
                time.sleep(3)

        browser.close()

    logger.info("Scrape complete. Total new jobs: %d", total_new)
    return total_new

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

LINKEDIN_EMAIL = os.getenv("LINKEDIN_EMAIL", "")
LINKEDIN_PASSWORD = os.getenv("LINKEDIN_PASSWORD", "")

SEARCH_KEYWORDS = [
    kw.strip()
    for kw in os.getenv(
        "SEARCH_KEYWORDS",
        "Senior Software Engineer,Staff Engineer,Principal Engineer,Engineering Manager,Director of Engineering,VP Engineering,Head of Engineering,Senior Backend Engineer,Senior Full Stack Engineer",
    ).split(",")
    if kw.strip()
]

LOCATIONS = [
    loc.strip()
    for loc in os.getenv("LOCATIONS", "Austin, TX,Remote").split(",")
    if loc.strip()
]

# How many pages of results to scrape per keyword+location combo
MAX_PAGES = int(os.getenv("MAX_PAGES", "3"))

DB_PATH = Path(__file__).parent.parent / os.getenv("DB_PATH", "jobs.db")

# Daily digest time (24h format, local time)
DIGEST_HOUR = int(os.getenv("DIGEST_HOUR", "7"))
DIGEST_MINUTE = int(os.getenv("DIGEST_MINUTE", "0"))

DASHBOARD_HOST = os.getenv("DASHBOARD_HOST", "0.0.0.0")
DASHBOARD_PORT = int(os.getenv("DASHBOARD_PORT", "8080"))

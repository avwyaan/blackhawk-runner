# LinkedIn Job Filter

Scrapes LinkedIn job postings every morning and presents them on a clean web dashboard. Targets Senior IC and management engineering roles in Austin TX and Remote.

## Setup

```bash
cd linkedin-job-filter

# 1. Create virtualenv
python3 -m venv .venv && source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt
playwright install chromium

# 3. Configure credentials
cp .env.example .env
# Edit .env — add your LinkedIn email + password
```

## Run

```bash
# Start dashboard (http://localhost:8080) + daily scheduler
python main.py

# One-off scrape (useful for first run / testing)
python main.py scrape
```

## Configuration

All settings live in `.env`. Key options:

| Variable | Default | Description |
|---|---|---|
| `LINKEDIN_EMAIL` | — | Your LinkedIn login email |
| `LINKEDIN_PASSWORD` | — | Your LinkedIn password |
| `SEARCH_KEYWORDS` | Senior SWE, EM, VP Eng... | Comma-separated job titles to search |
| `LOCATIONS` | Austin, TX,Remote | Comma-separated locations |
| `MAX_PAGES` | 3 | Pages of results per keyword+location |
| `DIGEST_HOUR` | 7 | Hour for daily scrape (24h, local time) |
| `DASHBOARD_PORT` | 8080 | Web dashboard port |

## Dashboard features

- **Today's Jobs** tab — only jobs scraped today
- **All Jobs** tab — full history (last 300)
- **New** badge on jobs not yet seen
- **Scrape Now** button — trigger an immediate scrape
- **Mark All Seen** — clears the "New" badges

## Notes

- Jobs are deduplicated by URL — each posting appears only once even across multiple scrapes
- LinkedIn may occasionally show a CAPTCHA on first login; re-run if that happens
- For headless server use, Playwright runs Chromium in headless mode automatically

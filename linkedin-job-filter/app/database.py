import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Generator

from .config import DB_PATH


def init_db() -> None:
    with _conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS jobs (
                id          TEXT PRIMARY KEY,
                title       TEXT NOT NULL,
                company     TEXT NOT NULL,
                location    TEXT,
                posted_date TEXT,
                job_url     TEXT UNIQUE NOT NULL,
                description TEXT,
                scraped_at  TEXT NOT NULL,
                is_new      INTEGER NOT NULL DEFAULT 1
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_scraped_at ON jobs(scraped_at)
            """
        )


@contextmanager
def _conn() -> Generator[sqlite3.Connection, None, None]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def upsert_jobs(jobs: list[dict]) -> int:
    """Insert new jobs; skip duplicates. Returns count of newly inserted jobs."""
    new_count = 0
    with _conn() as conn:
        for job in jobs:
            cur = conn.execute(
                """
                INSERT OR IGNORE INTO jobs
                    (id, title, company, location, posted_date, job_url, description, scraped_at, is_new)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
                """,
                (
                    job["id"],
                    job["title"],
                    job["company"],
                    job.get("location", ""),
                    job.get("posted_date", ""),
                    job["job_url"],
                    job.get("description", ""),
                    datetime.utcnow().isoformat(),
                ),
            )
            if cur.rowcount:
                new_count += 1
    return new_count


def get_todays_jobs() -> list[sqlite3.Row]:
    today = datetime.utcnow().date().isoformat()
    with _conn() as conn:
        return conn.execute(
            """
            SELECT * FROM jobs
            WHERE scraped_at >= ?
            ORDER BY scraped_at DESC
            """,
            (today,),
        ).fetchall()


def get_all_jobs(limit: int = 200, offset: int = 0) -> list[sqlite3.Row]:
    with _conn() as conn:
        return conn.execute(
            """
            SELECT * FROM jobs
            ORDER BY scraped_at DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        ).fetchall()


def mark_all_seen() -> None:
    with _conn() as conn:
        conn.execute("UPDATE jobs SET is_new = 0 WHERE is_new = 1")


def get_stats() -> dict:
    with _conn() as conn:
        total = conn.execute("SELECT COUNT(*) FROM jobs").fetchone()[0]
        new = conn.execute("SELECT COUNT(*) FROM jobs WHERE is_new = 1").fetchone()[0]
        today = datetime.utcnow().date().isoformat()
        today_count = conn.execute(
            "SELECT COUNT(*) FROM jobs WHERE scraped_at >= ?", (today,)
        ).fetchone()[0]
    return {"total": total, "new": new, "today": today_count}

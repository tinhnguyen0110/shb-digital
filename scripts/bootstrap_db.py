"""Prepare demo data without rewriting data that is already present.

This helper is called by ``run.sh`` after Alembic migrations. It intentionally
keeps runtime/demo state on normal starts; business fixtures are loaded only
when the database is empty, and missing demo users are inserted idempotently.
"""

from __future__ import annotations

import sys
from pathlib import Path

import psycopg2

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR / "backend"))

from app.db.config import DATABASE_URL  # noqa: E402
from app.db.seed_from_lab import LAB_SEED_DB, load_seed  # noqa: E402
from app.db.seed_users import SEED_ACCOUNTS, seed_users  # noqa: E402


def _database_state() -> tuple[bool, set[str]]:
    """Return whether business fixtures exist and the existing demo usernames."""
    conn = psycopg2.connect(DATABASE_URL, connect_timeout=5)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT EXISTS (SELECT 1 FROM customers) "
                "AND EXISTS (SELECT 1 FROM assumptions)"
            )
            business_ready = bool(cur.fetchone()[0])
            cur.execute("SELECT username FROM users")
            usernames = {row[0] for row in cur.fetchall()}
            return business_ready, usernames
    finally:
        conn.close()


def main() -> None:
    business_ready, usernames = _database_state()

    if business_ready:
        print("✓ Dữ liệu nghiệp vụ đã có — bỏ qua seed.")
    else:
        if not LAB_SEED_DB.exists():
            raise SystemExit(
                "✗ DB chưa có dữ liệu và thiếu nguồn seed LAB tại:\n"
                f"  {LAB_SEED_DB}\n"
                "  Checkout repo shb-digital-experts cạnh repo này rồi chạy lại ./run.sh."
            )
        counts = load_seed()
        print(f"✓ Đã seed dữ liệu nghiệp vụ ({sum(counts.values())} rows).")

    expected = {username for username, *_ in SEED_ACCOUNTS}
    missing = expected - usernames
    if missing:
        seed_users()
        print(f"✓ Đã bổ sung demo users: {', '.join(sorted(missing))}.")
    else:
        print("✓ Demo users đã đủ — bỏ qua seed.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Daily 09:00 UTC digest — actions today vs zero."""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

from customer_gateway.distribution_progress import format_daily_digest, send_daily_digest  # noqa: E402


def main() -> int:
    if os.getenv("APSALES_DISTRIBUTION_DIGEST", "1").strip() == "0":
        print("APSALES_DISTRIBUTION_DIGEST=0 — skipped")
        return 0

    force = os.getenv("APSALES_DISTRIBUTION_DIGEST_FORCE", "0").strip() == "1"
    text = format_daily_digest()
    print(text)
    sent = send_daily_digest(force=force)
    print(f"\nTelegram notified: {sent} chat(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

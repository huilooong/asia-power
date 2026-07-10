#!/usr/bin/env python3
"""Register CEO-approved wave1 test batch (FB/IG/X) as pending manual posts."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

from customer_gateway.distribution_progress import (  # noqa: E402
    format_progress_text,
    register_test_batch_wave1,
)


def main() -> int:
    result = register_test_batch_wave1(notify=True)
    print(json.dumps(
        {
            "ok": result.get("ok"),
            "registered": result.get("registered"),
            "notified": sum(r.get("notified", 0) for r in result.get("results") or []),
        },
        ensure_ascii=False,
        indent=2,
    ))
    print(format_progress_text())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Rebuild unified outreach sent registry + CSV blocklist."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from customer_gateway.outreach_sent_registry import (  # noqa: E402
    BLOCKLIST_CSV,
    REGISTRY_JSON,
    rebuild_registry,
)


def main() -> int:
    registry = rebuild_registry()
    print(
        json.dumps(
            {
                "ok": True,
                "total": registry["total"],
                "registry": str(REGISTRY_JSON.relative_to(ROOT)),
                "blocklist_csv": str(BLOCKLIST_CSV.relative_to(ROOT)),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

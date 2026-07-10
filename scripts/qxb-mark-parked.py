#!/usr/bin/env python3
"""Apply QXB parked markers — defer hard rows, keep easy queue clear."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

load_dotenv(ROOT / ".env")

from inventory_core import qxb_pipeline

# Rows known to be local-only submit (Admin 无记录) — fix = re-submit
SUBMIT_GHOST = [24, 25, 27]

# No VIN OCR yet
NO_VIN = [14, 16, 23, 26, 28]

# Album missing front/rear/engine bands
ALBUM_INCOMPLETE = [30]

# In Admin Pending — waiting CEO approve/reject/correct (not ghost)
AWAITING_CEO = [
    3, 5, 6, 8, 9, 10, 11,
    18, 19, 20, 21, 22, 31,
]


def main() -> int:
    ctx = qxb_pipeline.load_context()
    marked: list[dict] = []

    for row in SUBMIT_GHOST:
        qxb_pipeline.park_row(
            ctx,
            row,
            category="submit_ghost",
            note="批量提交未进 Admin，待补推",
            tier="easy",
        )
        marked.append({"row": row, "category": "submit_ghost", "tier": "easy"})

    for row in NO_VIN:
        qxb_pipeline.park_row(
            ctx,
            row,
            category="no_vin",
            note="OCR 未识别 VIN",
            tier="later",
        )
        marked.append({"row": row, "category": "no_vin", "tier": "later"})

    for row in ALBUM_INCOMPLETE:
        qxb_pipeline.park_row(
            ctx,
            row,
            category="album_incomplete",
            note="仅 #12–#18 尾段相册，缺车头/车尾/发动机段",
            tier="later",
        )
        marked.append({"row": row, "category": "album_incomplete", "tier": "later"})

    for row in AWAITING_CEO:
        entry = (ctx.queue.get("rows") or {}).get(str(row), {})
        sub = entry.get("submissionId") or f"QXB-{row:04d}"
        qxb_pipeline.park_row(
            ctx,
            row,
            category="awaiting_ceo",
            note=f"{sub} 待 Admin 操作",
            tier="later",
        )
        marked.append({"row": row, "category": "awaiting_ceo", "tier": "later"})

    summary_path = ROOT / "reports/qxb-parked-summary.json"
    summary_path.write_text(
        json.dumps({
            "marked": marked,
            "report": qxb_pipeline.format_parked_report(qxb_pipeline.load_context()),
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(qxb_pipeline.format_parked_report(qxb_pipeline.load_context()))
    print(f"\nSummary: {summary_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

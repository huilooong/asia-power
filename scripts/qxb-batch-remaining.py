#!/usr/bin/env python3
"""Upload all remaining non-parked QXB rows (inspect → process --live → submit-review)."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

load_dotenv(ROOT / ".env")
os.environ.setdefault("QXB_BULK_ALL_PHOTOS", "1")

from importlib.machinery import SourceFileLoader

batch_mod = SourceFileLoader(
    "qxb_batch_upload",
    str(ROOT / "scripts/qxb-batch-upload.py"),
).load_module()

from inventory_core import qxb_pipeline

PROGRESS_FILE = ROOT / "reports/qxb-batch-progress.json"
LOG_FILE = ROOT / "reports/qxb-batch-upload.log"


def log(msg: str) -> None:
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line, flush=True)
    with LOG_FILE.open("a", encoding="utf-8") as fh:
        fh.write(line + "\n")


def save_progress(data: dict) -> None:
    PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
    PROGRESS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


RATE_LIMIT_RE = re.compile(r"\b(423|429|503)\b|Too many|Locked", re.I)


def is_rate_limited(msg: str | None) -> bool:
    return qxb_pipeline.is_upload_rate_limited(msg) or bool(msg and RATE_LIMIT_RE.search(msg))


def upload_row_with_retry(row: int, *, max_retries: int, backoff: float) -> dict:
    stock = f"QXB{row:04d}"
    last: dict = {"row": row, "stockId": stock, "ok": False, "error": "unknown"}
    for attempt in range(1, max_retries + 1):
        try:
            last = batch_mod.upload_row(row)
        except Exception as exc:
            last = {"row": row, "stockId": stock, "ok": False, "error": str(exc)}
        if last.get("ok") or not is_rate_limited(last.get("error")):
            return last
        wait = backoff * attempt
        log(f"RATE LIMIT {stock} attempt {attempt}/{max_retries} — sleep {wait:.0f}s")
        time.sleep(wait)
    return last


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="Max rows this run (0 = all remaining)")
    parser.add_argument("--delay", type=float, default=12.0, help="Seconds between rows")
    parser.add_argument("--retry", type=int, default=4, help="423/429 retries per row")
    parser.add_argument("--backoff", type=float, default=45.0, help="Base seconds for 429 backoff")
    args = parser.parse_args()

    ctx = qxb_pipeline.load_context()
    seeded = qxb_pipeline.warm_vin_decode_cache_from_approved(root=ctx.paths.root)
    if seeded:
        log(f"VIN decode cache warmed from approved import: {seeded} entries")
    plan = qxb_pipeline.count_remaining_upload_rows(ctx)
    rows = plan["remaining"]
    if plan.get("skippedOnServerCount"):
        log(
            f"Server dedup: skipped {plan['skippedOnServerCount']} rows already on production"
        )
    if args.limit > 0:
        rows = rows[: args.limit]
    if not rows:
        log("Nothing to upload — all rows done or parked.")
        return 0

    log(
        f"Starting batch: {len(rows)} rows (first={rows[0] if rows else '—'}, "
        f"parked={plan['parkedCount']}, server_skip={plan.get('skippedOnServerCount', 0)}, "
        f"bulk_all_photos=1, delay={args.delay}s, retry={args.retry})"
    )
    ok_rows: list[int] = []
    fail_rows: list[dict] = []

    for i, row in enumerate(rows, 1):
        stock = f"QXB{row:04d}"
        log(f"--- [{i}/{len(rows)}] row {row} {stock} ---")
        res = upload_row_with_retry(row, max_retries=args.retry, backoff=args.backoff)
        if res.get("ok"):
            ok_rows.append(row)
            log(f"OK {stock} {res.get('submissionId')} VIN={res.get('vin')}")
        else:
            fail_rows.append({"row": row, "stockId": stock, "error": res.get("error")})
            log(f"FAIL {stock}: {res.get('error')}")

        save_progress({
            "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "total": len(rows),
            "done": i,
            "ok": len(ok_rows),
            "fail": len(fail_rows),
            "lastRow": row,
            "okRows": ok_rows[-20:],
            "failRows": fail_rows[-20:],
        })
        if i < len(rows) and args.delay > 0:
            time.sleep(args.delay)

    log(f"=== Finished: {len(ok_rows)}/{len(rows)} OK, {len(fail_rows)} failed ===")
    save_progress({
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total": len(rows),
        "done": len(rows),
        "ok": len(ok_rows),
        "fail": len(fail_rows),
        "status": "complete",
        "okRows": ok_rows,
        "failRows": fail_rows,
    })
    return 0 if not fail_rows else 1


if __name__ == "__main__":
    raise SystemExit(main())

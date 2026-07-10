#!/usr/bin/env python3
"""Re-check and re-upload ALL rows listed in qxb-batch-progress.json failRows."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from collections import Counter
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

load_dotenv(ROOT / ".env")
os.environ.setdefault("QXB_BULK_ALL_PHOTOS", "1")
os.environ.setdefault("QXB_VIN_DECODE_RETRY_MAX", "0")
os.environ.setdefault("QXB_BATCH_SKIP_DECODE", "1")

from importlib.machinery import SourceFileLoader

batch_mod = SourceFileLoader(
    "qxb_batch_upload",
    str(ROOT / "scripts/qxb-batch-upload.py"),
).load_module()

from inventory_core import qxb_pipeline

PROGRESS_FILE = ROOT / "reports/qxb-batch-progress.json"
LOG_FILE = ROOT / "reports/qxb-batch-reupload-all.log"
ORIGINAL_FAIL_FILE = ROOT / "reports/qxb-batch-original-fail-rows.json"
SUMMARY_FILE = ROOT / "reports/qxb-batch-reupload-summary.json"


def log(msg: str) -> None:
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line, flush=True)
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open("a", encoding="utf-8") as fh:
        fh.write(line + "\n")


def save_progress(data: dict) -> None:
    qxb_pipeline.save_json_atomic(PROGRESS_FILE, data)


def save_summary(data: dict) -> None:
    qxb_pipeline.save_json_atomic(SUMMARY_FILE, data)


def recover_lists_from_log() -> dict:
    """Rebuild original fail / ready / blocked lists from reupload log."""
    if not LOG_FILE.is_file():
        return {}
    text = LOG_FILE.read_text(encoding="utf-8")
    parts = text.split("=== LIVE UPLOAD PHASE ===")
    inspect_part = parts[0]

    orig: list[int] = []
    seen: set[int] = set()
    for m in re.finditer(r"--- \[(\d+)/305\] (QXB\d+) ---", inspect_part):
        row = int(m.group(2).replace("QXB", ""))
        if row not in seen:
            seen.add(row)
            orig.append(row)

    ready: set[int] = set()
    blocked: list[dict] = []
    blocked_by_row: dict[int, dict] = {}
    for line in inspect_part.splitlines():
        m = re.match(r"\[.*\] (READY|BLOCKED) (QXB\d+)(?: \[(.*?)\])?", line)
        if not m:
            continue
        status, stock, cat = m.group(1), m.group(2), m.group(3)
        row = int(stock.replace("QXB", ""))
        if status == "READY":
            ready.add(row)
        else:
            err_m = re.search(r"\]: (.*)$", line)
            blocked_by_row[row] = {
                "row": row,
                "stockId": stock,
                "category": cat or "other",
                "error": err_m.group(1).strip() if err_m else "blocked",
            }
    blocked = sorted(blocked_by_row.values(), key=lambda x: x["row"])

    data = {
        "recoveredAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": str(LOG_FILE.relative_to(ROOT)),
        "originalFailRows": orig,
        "readyRows": sorted(ready),
        "blockedRows": blocked,
        "counts": {"original": len(orig), "ready": len(ready), "blocked": len(blocked)},
    }
    qxb_pipeline.save_json_atomic(ORIGINAL_FAIL_FILE, data)
    return data


def load_original_data() -> dict:
    if ORIGINAL_FAIL_FILE.is_file():
        return json.loads(ORIGINAL_FAIL_FILE.read_text(encoding="utf-8"))
    return recover_lists_from_log()


def load_progress_data() -> dict:
    if not PROGRESS_FILE.is_file():
        return {}
    return json.loads(PROGRESS_FILE.read_text(encoding="utf-8"))


def load_fail_rows() -> list[int]:
    data = load_progress_data()
    if not data:
        orig = load_original_data()
        return list(orig.get("originalFailRows") or [])
    if data.get("phase") == "reupload-all-complete" and data.get("status") == "inspect-complete":
        return sorted(int(r) for r in data.get("okRows") or [])
    rows = sorted({int(r["row"]) for r in data.get("failRows") or []})
    if rows:
        return rows
    orig = load_original_data()
    return list(orig.get("originalFailRows") or [])


def load_resume_upload_rows(*, skip_server: bool = True) -> tuple[list[int], dict]:
    """Rows still needing live upload: ready minus prior okRows and optional server hits."""
    orig = load_original_data()
    progress = load_progress_data()
    ready = sorted(int(r) for r in orig.get("readyRows") or [])
    prior_ok = sorted(int(r) for r in progress.get("okRows") or [])
    prior_ok_set = set(prior_ok)

    server_rows: set[int] = set()
    skipped_server: list[int] = []
    if skip_server:
        ctx = qxb_pipeline.load_context()
        fetched = qxb_pipeline.fetch_server_qxb_rows(ctx)
        if fetched.get("ok"):
            server_rows = set(fetched.get("rows") or [])
            skipped_server = sorted(r for r in ready if r in server_rows and r not in prior_ok_set)

    todo = [r for r in ready if r not in prior_ok_set and r not in server_rows]
    meta = {
        "readyTotal": len(ready),
        "priorOk": prior_ok,
        "skippedOnServer": skipped_server,
        "originalTotal": len(orig.get("originalFailRows") or []),
        "inspectBlocked": len(orig.get("blockedRows") or []),
    }
    return todo, meta


def is_retriable_error(err: str) -> bool:
    err_l = (err or "").lower()
    if qxb_pipeline.is_upload_rate_limited(err) or "rate_limited" in err_l:
        return True
    for kw in (
        "timed out",
        "timeout",
        "connection reset",
        "connection refused",
        "temporarily unavailable",
        "503",
        "502",
        "504",
        "broken pipe",
    ):
        if kw in err_l:
            return True
    return False


def inspect_only(row: int) -> dict:
    ctx = qxb_pipeline.load_context()
    existing_vin = (ctx.vins.get(row) or {}).get("vin")
    if not existing_vin or qxb_pipeline.is_garbage_ocr_vin(existing_vin):
        qxb_pipeline.auto_recover_row(ctx, row)
        ctx = qxb_pipeline.load_context()
    insp = qxb_pipeline.inspect_row(ctx, row)
    blockers = insp.get("blockers") or []
    category = qxb_pipeline.categorize_blocker("; ".join(blockers))
    return {
        "row": row,
        "stockId": f"QXB{row:04d}",
        "ready": bool(insp.get("ready")),
        "blockers": blockers,
        "category": category,
        "vin": (insp.get("fields") or {}).get("vin"),
        "engine": (insp.get("fields") or {}).get("engineCode"),
        "trans": (insp.get("fields") or {}).get("transmissionCode"),
    }


def upload_with_retry(row: int, *, max_retries: int, backoff: float) -> dict:
    stock = f"QXB{row:04d}"
    ctx = qxb_pipeline.load_context()
    qxb_pipeline.auto_recover_row(ctx, row)
    last: dict = {"row": row, "stockId": stock, "ok": False, "error": "unknown"}
    for attempt in range(1, max_retries + 1):
        try:
            last = batch_mod.upload_row(row)
        except Exception as exc:
            last = {"row": row, "stockId": stock, "ok": False, "error": str(exc)}
        if last.get("ok"):
            return last
        err = last.get("error") or ""
        if not is_retriable_error(err) or attempt >= max_retries:
            return last
        wait = backoff * attempt
        log(f"RETRY {stock} attempt {attempt}/{max_retries} — sleep {wait:.0f}s ({err[:80]})")
        time.sleep(wait)
    return last


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inspect-only", action="store_true", help="Only re-inspect, no upload")
    parser.add_argument("--resume", action="store_true", help="Skip okRows; continue upload for remaining ready rows")
    parser.add_argument("--no-skip-server", action="store_true", help="Do not skip rows already on production")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--delay", type=float, default=8.0)
    parser.add_argument("--retry", type=int, default=4)
    parser.add_argument("--backoff", type=float, default=45.0)
    args = parser.parse_args()

    resume_meta: dict = {}
    prior_ok: list[int] = []
    inspect_blocked: list[dict] = []

    if args.resume and not args.inspect_only:
        rows, resume_meta = load_resume_upload_rows(skip_server=not args.no_skip_server)
        progress = load_progress_data()
        prior_ok = sorted(int(r) for r in progress.get("okRows") or [])
        orig = load_original_data()
        inspect_blocked = list(orig.get("blockedRows") or [])
        log(
            f"=== RESUME upload: {len(rows)} remaining "
            f"(ready={resume_meta.get('readyTotal')} prior_ok={len(prior_ok)} "
            f"skipped_server={len(resume_meta.get('skippedOnServer') or [])}) ==="
        )
    else:
        rows = load_fail_rows()
        if args.resume and args.inspect_only:
            progress = load_progress_data()
            prior_ok = sorted(int(r) for r in progress.get("okRows") or [])
            prior_set = set(prior_ok)
            rows = [r for r in rows if r not in prior_set]
            log(f"=== RESUME inspect: {len(rows)} rows (skipping {len(prior_ok)} prior ok) ===")

    if args.limit > 0:
        rows = rows[: args.limit]
    if not rows:
        log("No rows to process.")
        return 0

    log(f"=== Re-check {len(rows)} failed rows (inspect_only={args.inspect_only}) ===")
    ok_rows: list[int] = list(prior_ok)
    ok_set = set(ok_rows)
    fail_rows: list[dict] = []
    categories: Counter[str] = Counter()
    session_ok = 0
    session_fail = 0

    for i, row in enumerate(rows, 1):
        stock = f"QXB{row:04d}"
        log(f"--- [{i}/{len(rows)}] {stock} ---")
        if args.inspect_only:
            try:
                res = inspect_only(row)
            except Exception as exc:
                err = str(exc)
                cat = qxb_pipeline.categorize_blocker(err)
                categories[cat] += 1
                session_fail += 1
                fail_rows.append({"row": row, "stockId": stock, "error": err, "category": cat})
                log(f"ERROR {stock} [{cat}]: {err[:200]}")
                continue
            if res["ready"]:
                if row not in ok_set:
                    ok_rows.append(row)
                    ok_set.add(row)
                session_ok += 1
                log(f"READY {stock} VIN={res.get('vin')} eng={res.get('engine')} trans={res.get('trans')}")
            else:
                err = "; ".join(res.get("blockers") or ["not ready"])
                cat = res.get("category") or "other"
                categories[cat] += 1
                session_fail += 1
                fail_rows.append({"row": row, "stockId": stock, "error": err, "category": cat})
                log(f"BLOCKED {stock} [{cat}]: {err[:200]}")
            continue

        res = upload_with_retry(row, max_retries=args.retry, backoff=args.backoff)
        if res.get("ok"):
            if row not in ok_set:
                ok_rows.append(row)
                ok_set.add(row)
            session_ok += 1
            log(f"OK {stock} {res.get('submissionId')} VIN={res.get('vin')}")
        else:
            err = res.get("error") or "unknown"
            cat = qxb_pipeline.categorize_blocker(err)
            categories[cat] += 1
            session_fail += 1
            fail_rows.append({"row": row, "stockId": stock, "error": err, "category": cat})
            log(f"FAIL {stock} [{cat}]: {err[:240]}")

        save_progress({
            "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "phase": "reupload-all",
            "resume": bool(args.resume),
            "total": len(rows) + len(prior_ok),
            "done": len(prior_ok) + i,
            "ok": len(ok_rows),
            "fail": session_fail,
            "lastRow": row,
            "okRows": ok_rows,
            "failRows": fail_rows,
            "categoryCounts": dict(categories),
            "resumeMeta": resume_meta,
        })
        if i < len(rows) and args.delay > 0 and not args.inspect_only:
            time.sleep(args.delay)

    log(f"=== Done: session {session_ok} ok / {session_fail} fail; cumulative ok={len(ok_rows)} ===")
    if categories:
        log(f"Categories: {dict(categories)}")

    inspect_cats: Counter[str] = Counter()
    for b in inspect_blocked:
        inspect_cats[b.get("category") or "other"] += 1

    summary = {
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "phase": "reupload-all-complete",
        "resume": bool(args.resume),
        "originalFailCount": resume_meta.get("originalTotal") or len(load_original_data().get("originalFailRows") or []),
        "inspectReadyCount": resume_meta.get("readyTotal"),
        "inspectBlockedCount": resume_meta.get("inspectBlocked") or len(inspect_blocked),
        "uploadSessionOk": session_ok,
        "uploadSessionFail": session_fail,
        "uploadCumulativeOk": len(ok_rows),
        "uploadRemainingFail": len(fail_rows),
        "skippedOnServer": resume_meta.get("skippedOnServer") or [],
        "okRows": ok_rows,
        "failRows": fail_rows,
        "inspectBlockedRows": inspect_blocked,
        "categoryCounts": {
            "upload": dict(categories),
            "inspectBlocked": dict(inspect_cats),
        },
    }
    save_summary(summary)

    save_progress({
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "phase": "reupload-all-complete",
        "resume": bool(args.resume),
        "total": len(rows) + len(prior_ok),
        "done": len(prior_ok) + len(rows),
        "ok": len(ok_rows),
        "fail": len(fail_rows),
        "status": "complete" if not args.inspect_only else "inspect-complete",
        "okRows": ok_rows,
        "failRows": fail_rows,
        "categoryCounts": dict(categories),
        "summaryFile": str(SUMMARY_FILE.relative_to(ROOT)),
    })
    return 0 if not fail_rows else 1


if __name__ == "__main__":
    raise SystemExit(main())

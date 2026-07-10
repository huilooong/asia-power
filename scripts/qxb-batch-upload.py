#!/usr/bin/env python3
"""Batch QXB upload: inspect → pick → process --live → submit-review."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

load_dotenv(ROOT / ".env")
os.environ.setdefault("QXB_BULK_ALL_PHOTOS", "1")

from inventory_core import qxb_pipeline
from tools.qxb_upload_tool import TOOL
def prepare_row(row: int) -> str | None:
    ctx = qxb_pipeline.load_context()
    photos = ctx.manifest.get(row, [])
    if not photos:
        return "no photos"

    qxb_pipeline.auto_recover_row(ctx, row)
    ctx = qxb_pipeline.load_context()

    if not ctx.vins.get(row, {}).get("vin"):
        found = qxb_pipeline.ensure_row_vin(ctx, row)
        if not found:
            source = ctx.sources.get(row) or {}
            trim = source.get("trim") or photos[0].get("model") or ""
            return (
                f"OCR found no VIN (Excel row {row} / {trim} — "
                f"原始表无 VIN 列，已扫描全部 {len(photos)} 张照片)"
            )
        ctx = qxb_pipeline.load_context()

    insp = qxb_pipeline.inspect_row(ctx, row)
    if not insp.get("ready"):
        return "; ".join(insp.get("blockers") or ["not ready"])

    return None


def upload_row(row: int) -> dict:
    stock = f"QXB{row:04d}"
    err = prepare_row(row)
    if err:
        return {"row": row, "stockId": stock, "ok": False, "error": err}

    ctx = qxb_pipeline.load_context()
    fields = (qxb_pipeline.inspect_row(ctx, row).get("fields") or {})
    r1 = TOOL.run("process", [str(row), "--live"], dry_run=False)
    if not r1.ok:
        return {"row": row, "stockId": stock, "ok": False, "stage": "process", "error": r1.output[:400]}

    r2 = TOOL.run("submit-review", [str(row)], dry_run=False)
    meta = getattr(r2, "metadata", None) or {}
    return {
        "row": row,
        "stockId": stock,
        "ok": r2.ok,
        "vin": fields.get("vin"),
        "engine": fields.get("engineCode"),
        "trans": fields.get("transmissionCode"),
        "submissionId": meta.get("submissionId"),
        "error": None if r2.ok else r2.output[:400],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("rows", nargs="+", type=int, help="Excel row numbers")
    args = parser.parse_args()

    results = []
    for row in args.rows:
        print(f"\n--- row {row} QXB{row:04d} ---", flush=True)
        try:
            res = upload_row(row)
            results.append(res)
            if res["ok"]:
                print(f"OK {res['stockId']} {res.get('submissionId')} VIN={res.get('vin')}", flush=True)
            else:
                print(f"FAIL {res.get('error')}", flush=True)
        except Exception as exc:
            results.append({"row": row, "stockId": f"QXB{row:04d}", "ok": False, "error": str(exc)})
            print(f"ERROR {exc}", flush=True)

    ok = [r for r in results if r.get("ok")]
    fail = [r for r in results if not r.get("ok")]
    print(f"\n=== Done: {len(ok)}/{len(results)} ===")
    for r in ok:
        print(f"  ✓ {r['stockId']} → {r.get('submissionId')}")
    for r in fail:
        print(f"  ✗ row {r['row']}: {r.get('error')}")
    return 0 if not fail else 1


if __name__ == "__main__":
    raise SystemExit(main())

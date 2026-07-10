#!/usr/bin/env python3
"""Re-upload + submit-review for CEO-corrected QXB rows."""

from __future__ import annotations

import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

load_dotenv(ROOT / ".env")

from inventory_core import qxb_pipeline
from tools.qxb_upload_tool import TOOL

CORRECTED_ROWS = [2, 4, 7, 12, 13, 15, 17]


def reupload_row(row: int) -> dict:
    stock = f"QXB{row:04d}"
    ctx = qxb_pipeline.load_context()
    insp = qxb_pipeline.inspect_row(ctx, row)
    if not insp.get("ready"):
        return {
            "row": row,
            "stockId": stock,
            "ok": False,
            "error": "; ".join(insp.get("blockers") or ["not ready"]),
        }

    r0 = TOOL.run("reupload", [str(row)], dry_run=False)
    if not r0.ok:
        return {"row": row, "stockId": stock, "ok": False, "error": r0.output[:300]}

    r1 = TOOL.run("process", [str(row), "--live"], dry_run=False)
    if not r1.ok:
        return {"row": row, "stockId": stock, "ok": False, "stage": "process", "error": r1.output[:400]}

    r2 = TOOL.run("submit-review", [str(row)], dry_run=False)
    meta = getattr(r2, "metadata", None) or {}
    fields = (qxb_pipeline.inspect_row(qxb_pipeline.load_context(), row).get("fields") or {})
    return {
        "row": row,
        "stockId": stock,
        "ok": r2.ok,
        "submissionId": meta.get("submissionId"),
        "engine": fields.get("engineCode"),
        "trans": fields.get("transmissionCode"),
        "error": None if r2.ok else r2.output[:300],
    }


def main() -> int:
    results = []
    for row in CORRECTED_ROWS:
        print(f"\n--- QXB{row:04d} ---", flush=True)
        res = reupload_row(row)
        results.append(res)
        if res["ok"]:
            print(
                f"OK {res['submissionId']} {res.get('engine')}/{res.get('trans')}",
                flush=True,
            )
        else:
            print(f"FAIL {res.get('error')}", flush=True)

    ok = [r for r in results if r.get("ok")]
    fail = [r for r in results if not r.get("ok")]
    print(f"\n=== Done: {len(ok)}/{len(results)} ===")
    for r in ok:
        print(f"  ✓ QXB{r['row']:04d} → {r.get('submissionId')} ({r.get('engine')}/{r.get('trans')})")
    for r in fail:
        print(f"  ✗ QXB{r['row']:04d}: {r.get('error')}")
    return 0 if not fail else 1


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Rebuild VIN training priors and retry OCR on rows still missing VIN."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from inventory_core import qxb_pipeline
from inventory_core.qxb_photo_pick import load_learnings, rebuild_recognition_model, save_learnings


def _needs_vin_rows() -> list[int]:
    batch_path = ROOT / "reports/qxb-batch-progress.json"
    needs_path = ROOT / "reports/qxb-needs-vin-rows.json"
    if needs_path.is_file():
        data = json.loads(needs_path.read_text(encoding="utf-8"))
        return sorted(int(r) for r in data.get("rows") or [])
    if batch_path.is_file():
        batch = json.loads(batch_path.read_text(encoding="utf-8"))
        return sorted(
            int(r["row"])
            for r in batch.get("failRows") or []
            if "OCR found no VIN" in (r.get("error") or "")
        )
    return []


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--retry-ocr", action="store_true", help="OCR retry on rows still missing VIN")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    store = load_learnings()
    store["recognitionModel"] = rebuild_recognition_model(store)
    save_learnings(store)
    print("recognitionModel rebuilt")
    model = store["recognitionModel"]
    vin_aff = model.get("indexAffinities", {}).get("vin") or {}
    top = sorted(((int(k), v) for k, v in vin_aff.items()), key=lambda x: -x[1])[:8]
    print("VIN index affinities:", top)

    if not args.retry_ocr:
        return 0

    ctx = qxb_pipeline.load_context()
    targets = _needs_vin_rows()
    targets = [r for r in targets if not (ctx.vins.get(r) or {}).get("vin")]
    if args.limit:
        targets = targets[: args.limit]

    ok = 0
    fail = 0
    for row in targets:
        info = qxb_pipeline.ensure_row_vin(ctx, row)
        if info and info.get("vin"):
            ok += 1
            from inventory_core.qxb_photo_pick import photo_index_from_path

            idx = photo_index_from_path(str(info.get("image_path") or ""))
            print(f"OK row {row:4d}  {info['vin']}  photo={idx or '?'}", flush=True)
        else:
            fail += 1
            print(f"FAIL row {row:4d}", flush=True)
        ctx = qxb_pipeline.load_context()

    print(f"retry complete: {ok} ok, {fail} still missing (of {len(targets)})", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

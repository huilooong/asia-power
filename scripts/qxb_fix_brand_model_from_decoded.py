#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fix recent half-cut brand/model from QXB decodedData (qxbBrand/qxbSeries).

Rules (CEO 2026-07-14):
- Use QXB recognized fields as authority
- If brand/model missing, add from QXB
- Skip rows with no chassis/VIN
- Skip rows where QXB has neither qxbBrand nor qxbSeries
"""

from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_SINCE = "2026-07-12"
APPROVED_PATH = Path("/root/.openclaw/workspace/inventory-site/data/half-cut-approved.json")
SUBMISSIONS_PATH = Path("/root/.openclaw/workspace/inventory-site/data/half-cut-submissions.json")


def load_list(path: Path):
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, list):
        return raw, raw
    if isinstance(raw, dict):
        for k in ("items", "approved", "submissions", "data", "records"):
            if isinstance(raw.get(k), list):
                return raw, raw[k]
    raise SystemExit(f"Unexpected JSON shape: {path}")


def vin_of(item: dict) -> str:
    for k in ("vin", "chassisNumber", "chassis", "frameNumber", "底盘号"):
        v = str(item.get(k) or "").strip().upper()
        if v and v not in ("N/A", "NA", "-", "NONE", "NULL"):
            return v
    return ""


def build_title(item: dict) -> str:
    parts = []
    year = item.get("year")
    if year:
        parts.append(str(year))
    brand = str(item.get("brand") or "").strip()
    model = str(item.get("model") or "").strip()
    if brand:
        parts.append(brand)
    if model:
        parts.append(model)
    engine = str(item.get("engineCode") or "").strip()
    trans = str(item.get("transmissionCode") or "").strip()
    if engine and trans:
        parts.append(f"{engine} {trans.upper() if len(trans) <= 4 else trans}")
    elif engine:
        parts.append(engine)
    elif trans:
        parts.append(trans.upper() if len(trans) <= 4 else trans)
    drive = str(item.get("drivetrain") or "").strip().upper()
    if drive:
        if drive in ("FWD", "RWD", "2WD"):
            parts.append("2WD")
        elif drive in ("4WD", "AWD", "4MATIC", "QUATTRO"):
            parts.append("4WD")
        elif drive not in ("前置",):
            parts.append(drive)
    return " ".join(parts).replace("  ", " ").strip()


def resolve_brand_model(dd: dict) -> tuple[str, str, str, str]:
    qxb_brand = str(dd.get("qxbBrand") or "").strip()
    qxb_series = str(dd.get("qxbSeries") or "").strip()
    brand = str(dd.get("brand") or "").strip() or qxb_brand
    model = str(dd.get("model") or "").strip() or qxb_series
    return brand, model, qxb_brand, qxb_series


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", default=DEFAULT_SINCE)
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--approved", type=Path, default=APPROVED_PATH)
    ap.add_argument("--submissions", type=Path, default=SUBMISSIONS_PATH)
    args = ap.parse_args()

    approved_raw, approved = load_list(args.approved)
    subs_raw, submissions = load_list(args.submissions)

    by_stock = {}
    by_vin = {}
    for s in submissions:
        if not isinstance(s, dict):
            continue
        sid = s.get("stockId") or s.get("approvedStockId")
        if sid:
            by_stock[str(sid)] = s
        v = vin_of(s)
        if v:
            by_vin[v] = s

    report = []
    changed = 0

    for item in approved:
        if not isinstance(item, dict):
            continue
        sid = str(item.get("stockId") or item.get("id") or "")
        approved_at = str(item.get("approvedAt") or "")
        if approved_at and approved_at < args.since:
            continue

        vin = vin_of(item)
        if not vin:
            report.append(
                {
                    "stockId": sid,
                    "action": "skip_no_chassis",
                    "brand": item.get("brand"),
                    "model": item.get("model"),
                }
            )
            continue

        sub = by_stock.get(sid) or by_vin.get(vin)
        dd = (sub or {}).get("decodedData") or {}
        if not isinstance(dd, dict):
            dd = {}

        brand, model, qxb_brand, qxb_series = resolve_brand_model(dd)
        if not qxb_brand and not qxb_series:
            report.append(
                {
                    "stockId": sid,
                    "action": "skip_no_qxb",
                    "vin": vin,
                    "brand": item.get("brand"),
                    "model": item.get("model"),
                    "note": "QXB decodedData has no qxbBrand/qxbSeries",
                }
            )
            continue

        before = {
            "brand": item.get("brand"),
            "model": item.get("model"),
            "qxbBrand": item.get("qxbBrand"),
            "qxbSeries": item.get("qxbSeries"),
            "title": item.get("title"),
        }

        updates = {}
        if brand and (not item.get("brand") or str(item.get("model") or "") not in ("", model) and str(item.get("model") or "") == "霸道"):
            # Always set brand from QXB path when we have authority
            pass

        # Authority: brand/model from QXB decode path; always stamp qxb* fields
        if brand and str(item.get("brand") or "").strip() != brand:
            updates["brand"] = brand
        elif not str(item.get("brand") or "").strip() and brand:
            updates["brand"] = brand

        # Model: prefer QXB series Chinese when current is wrong alias, else fill missing,
        # else align to decoded model when current matches neither qxbSeries nor dd.model
        current_model = str(item.get("model") or "").strip()
        target_model = model
        # Prefer Chinese QXB series when decoded English model empty or when current is known-wrong
        if qxb_series and current_model in ("霸道", "4Runner") and qxb_series != current_model:
            target_model = qxb_series
        elif not current_model:
            target_model = model or qxb_series
        elif qxb_series and current_model not in (qxb_series, str(dd.get("model") or "").strip()):
            # Current model is neither QXB series nor localized model → overwrite with QXB series
            target_model = qxb_series if not str(dd.get("model") or "").strip() else str(dd.get("model")).strip()
        else:
            target_model = current_model  # already aligned

        # Special case: 霸道 must become 柯斯达
        if current_model == "霸道" and qxb_series:
            target_model = qxb_series

        if target_model and current_model != target_model:
            updates["model"] = target_model

        if qxb_brand and str(item.get("qxbBrand") or "").strip() != qxb_brand:
            updates["qxbBrand"] = qxb_brand
        if qxb_series and str(item.get("qxbSeries") or "").strip() != qxb_series:
            updates["qxbSeries"] = qxb_series

        # Fill brand if missing even when equal-check skipped
        if not str(item.get("brand") or "").strip() and brand:
            updates["brand"] = brand
        if not str(item.get("model") or "").strip() and (model or qxb_series):
            updates["model"] = model or qxb_series

        if not updates:
            report.append(
                {
                    "stockId": sid,
                    "action": "ok_unchanged",
                    "vin": vin,
                    "brand": item.get("brand"),
                    "model": item.get("model"),
                    "qxbBrand": qxb_brand,
                    "qxbSeries": qxb_series,
                }
            )
            continue

        if args.apply:
            item.update(updates)
            if any(k in updates for k in ("brand", "model")):
                item["title"] = build_title(item)
            # mirror onto submission
            if sub is not None:
                if "brand" in updates:
                    sub["brand"] = updates["brand"]
                if "model" in updates:
                    sub["model"] = updates["model"]
                if isinstance(sub.get("decodedData"), dict):
                    if qxb_brand:
                        sub["decodedData"]["qxbBrand"] = qxb_brand
                    if qxb_series:
                        sub["decodedData"]["qxbSeries"] = qxb_series
                    if "model" in updates:
                        sub["decodedData"]["model"] = updates["model"]
                    if "brand" in updates:
                        sub["decodedData"]["brand"] = updates["brand"]

        changed += 1
        report.append(
            {
                "stockId": sid,
                "action": "fixed" if args.apply else "would_fix",
                "vin": vin,
                "before": before,
                "updates": updates,
                "after_title": build_title({**item, **updates}),
                "qxbBrand": qxb_brand,
                "qxbSeries": qxb_series,
            }
        )

    print(json.dumps({"since": args.since, "apply": args.apply, "changed": changed, "report": report}, ensure_ascii=False, indent=2))

    if args.apply and changed:
        ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        bak_a = args.approved.with_suffix(args.approved.suffix + f".bak-qxb-brand-{ts}")
        bak_s = args.submissions.with_suffix(args.submissions.suffix + f".bak-qxb-brand-{ts}")
        shutil.copy2(args.approved, bak_a)
        shutil.copy2(args.submissions, bak_s)
        args.approved.write_text(json.dumps(approved_raw, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        args.submissions.write_text(json.dumps(subs_raw, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"backed_up": [str(bak_a), str(bak_s)]}, ensure_ascii=False))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

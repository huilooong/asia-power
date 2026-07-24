"""Export APBD leads to CSV / XLSX / JSON summary."""

from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from agents.apbd.leads.repository import DB_DIR, list_companies

ROOT = Path(__file__).resolve().parents[3]
EXPORT_DIR = ROOT / "runtime" / "apbd" / "leads" / "exports"


def _now_slug() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")


def _row(company: dict[str, Any]) -> dict[str, Any]:
    loc = company.get("location") or {}
    channels = company.get("contact_channels") or []
    phone = next((c.get("value") for c in channels if c.get("type") == "phone"), "")
    email = next((c.get("value") for c in channels if c.get("type") == "email"), "")
    website = next((c.get("value") for c in channels if c.get("type") == "website"), "")
    cr = company.get("chinese_relevance") or {}
    services = ";".join(str(s.get("service_code") or "") for s in (company.get("services") or []))
    brands = ";".join(str(b.get("brand_code") or "") for b in (company.get("brands") or []))
    return {
        "id": company.get("id"),
        "display_name": company.get("display_name"),
        "city": loc.get("city"),
        "address": loc.get("address"),
        "google_place_id": loc.get("google_place_id"),
        "phone": phone,
        "email": email,
        "website": website,
        "business_type": company.get("business_type"),
        "services": services,
        "brands": brands,
        "chinese_status": cr.get("status"),
        "chinese_evidence": cr.get("evidence_text"),
        "score": company.get("score"),
        "priority": company.get("priority"),
        "status": company.get("status"),
        "score_version": company.get("score_version"),
    }


def export_leads(
    *,
    country: str = "CA",
    status: str = "",
    priority: str = "",
    fmt: str = "csv",
) -> dict[str, Any]:
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    rows = [_row(c) for c in list_companies(country=country, status=status, priority=priority)]
    stamp = _now_slug()
    base = EXPORT_DIR / f"ca-leads-{stamp}"
    paths: dict[str, str] = {}

    json_path = base.with_suffix(".json")
    json_path.write_text(json.dumps({"count": len(rows), "rows": rows}, ensure_ascii=False, indent=2), encoding="utf-8")
    paths["json"] = str(json_path)

    csv_path = base.with_suffix(".csv")
    fieldnames = list(rows[0].keys()) if rows else list(_row({}).keys())
    with csv_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            writer.writerow(r)
    paths["csv"] = str(csv_path)

    if fmt in ("xlsx", "xls", "all"):
        xlsx_path = base.with_suffix(".xlsx")
        try:
            from openpyxl import Workbook  # type: ignore

            wb = Workbook()
            ws = wb.active
            ws.title = "leads"
            ws.append(fieldnames)
            for r in rows:
                ws.append([r.get(k) for k in fieldnames])
            wb.save(xlsx_path)
            paths["xlsx"] = str(xlsx_path)
        except ImportError:
            paths["xlsx_error"] = "openpyxl_not_installed"

    return {"ok": True, "count": len(rows), "paths": paths, "db_dir": str(DB_DIR)}

"""APBD Outreach Queue — real company outreach drafts (CEO approval required)."""

from __future__ import annotations

import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from agents.apbd.config import day_runtime_dir
from agents.apbd.constitution import APBD_DESTINATION

_CSV_FIELDS = [
    "Outreach ID",
    "Company",
    "Country",
    "City",
    "Data Source",
    "Public Email",
    "Public Phone",
    "Business Type",
    "Approval Status",
    "Suggested Landing Page",
    "Generated Time",
]

_NOT_PUBLISHED = "Not published"


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def outreach_id(lead_id: str) -> str:
    return hashlib.sha256(f"outreach|{lead_id}".encode()).hexdigest()[:20]


def infer_main_products(business_type: str, query: str) -> str:
    text = f"{business_type} {query}".lower()
    products: list[str] = []
    if any(x in text for x in ("engine", "motor")):
        products.append("Used engines")
    if any(x in text for x in ("half cut", "half-cut", "dismantl")):
        products.append("Half cuts")
    if any(x in text for x in ("parts", "spare", "component")):
        products.append("Auto parts")
    if any(x in text for x in ("truck", "commercial", "fleet")):
        products.append("Commercial vehicle parts")
    if not products:
        products = ["Auto parts", "Used engines"]
    return ", ".join(products[:4])


def suggested_landing_page(lead: dict[str, Any]) -> str:
    bt = (lead.get("business_type") or "").lower()
    if "engine" in bt or "dismantl" in bt:
        return f"{APBD_DESTINATION}/engines/"
    if "half" in bt:
        return f"{APBD_DESTINATION}/half-cuts/"
    if "truck" in bt or "commercial" in bt or "fleet" in bt:
        return f"{APBD_DESTINATION}/trucks/"
    return f"{APBD_DESTINATION}/contact.html"


def suggested_cta(lead: dict[str, Any]) -> str:
    company = lead.get("company") or "your business"
    return (
        f"Reply on WhatsApp for today's verified stock list, VIN confirmation, and export terms to {company}"
    )


def build_outreach_draft(lead: dict[str, Any]) -> dict[str, Any]:
    company = lead.get("company") or "there"
    country = lead.get("country") or ""
    city = lead.get("city") or ""
    products = lead.get("main_products") or infer_main_products(lead.get("business_type", ""), lead.get("query", ""))
    landing = suggested_landing_page(lead)
    cta = suggested_cta(lead)
    match_reason = lead.get("match_reason") or lead.get("value_reason") or ""

    short_intro = (
        f"AsiaPower connects verified China-based suppliers with {country} importers like {company}. "
        f"We support {products.lower()} with stock confirmation and export documentation."
    )

    email_draft = (
        f"Subject: AsiaPower — verified engine & parts supply for {company}\n\n"
        f"Dear {company} team,\n\n"
        f"We are AsiaPower ({APBD_DESTINATION}), a platform linking global buyers with verified auto parts and engine suppliers.\n\n"
        f"We noticed your business in {city}, {country} and believe we can support your {products.lower()} sourcing needs.\n\n"
        f"{match_reason}\n\n"
        f"Browse our catalog: {landing}\n\n"
        f"{cta}\n\n"
        f"Best regards,\nAsiaPower Business Development"
    )

    phone = lead.get("public_phone") or ""
    whatsapp_line = phone if phone != _NOT_PUBLISHED else "[add WhatsApp number]"
    whatsapp_draft = (
        f"Hello {company} team — AsiaPower here. We supply verified used engines & auto parts for {country} importers.\n"
        f"Reason we reached out: {match_reason}\n"
        f"Catalog: {landing}\n"
        f"{cta}\n"
        f"(Draft for {whatsapp_line} — CEO approval before send)"
    )

    oid = outreach_id(lead.get("lead_id") or company)
    return {
        "outreach_id": oid,
        "lead_id": lead.get("lead_id") or "",
        "company": company,
        "country": country,
        "city": city,
        "website": lead.get("website") or _NOT_PUBLISHED,
        "public_email": lead.get("public_email") or _NOT_PUBLISHED,
        "public_phone": lead.get("public_phone") or _NOT_PUBLISHED,
        "business_type": lead.get("business_type") or "",
        "main_products": products,
        "match_reason": match_reason,
        "company_page_url": lead.get("company_page_url") or lead.get("source_url") or _NOT_PUBLISHED,
        "data_source": lead.get("data_source") or lead.get("source") or "",
        "email_draft": email_draft,
        "whatsapp_draft": whatsapp_draft,
        "short_introduction": short_intro,
        "suggested_landing_page": landing,
        "suggested_cta": cta,
        "approval_status": "pending",
        "generated_at": _now_iso(),
        "destination": APBD_DESTINATION,
        "sprint": "SPRINT-001",
    }


def generate_outreach_queue(leads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    queue: list[dict[str, Any]] = []
    for lead in leads:
        oid = outreach_id(lead.get("lead_id") or "")
        if not oid or oid in seen:
            continue
        seen.add(oid)
        queue.append(build_outreach_draft(lead))
    return queue


def save_outreach_queue(
    items: list[dict[str, Any]],
    *,
    day: str | None = None,
    stats: dict[str, Any] | None = None,
) -> dict[str, Any]:
    day_str = day or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    out_dir = day_runtime_dir(day_str) / "outreach_queue"
    out_dir.mkdir(parents=True, exist_ok=True)

    json_path = out_dir / "outreach-queue.json"
    csv_path = out_dir / "outreach-queue.csv"
    summary_path = out_dir / "summary.json"

    payload = {
        "generated_at": _now_iso(),
        "day": day_str,
        "sprint": "SPRINT-001",
        "kpi": "qualified_companies_in_outreach_queue",
        "company_count": len(items),
        "pending_approval": sum(1 for i in items if i.get("approval_status") == "pending"),
        "stats": stats or {},
        "items": items,
    }
    json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    for item in items:
        item_path = out_dir / f"{item['outreach_id']}.json"
        item_path.write_text(json.dumps(item, indent=2, ensure_ascii=False), encoding="utf-8")

    with csv_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=_CSV_FIELDS)
        writer.writeheader()
        for row in items:
            writer.writerow({
                "Outreach ID": row.get("outreach_id", ""),
                "Company": row.get("company", ""),
                "Country": row.get("country", ""),
                "City": row.get("city", ""),
                "Data Source": row.get("data_source", ""),
                "Public Email": row.get("public_email", ""),
                "Public Phone": row.get("public_phone", ""),
                "Business Type": row.get("business_type", ""),
                "Approval Status": row.get("approval_status", "pending"),
                "Suggested Landing Page": row.get("suggested_landing_page", ""),
                "Generated Time": row.get("generated_at", ""),
            })

    by_country: dict[str, int] = {}
    by_source: dict[str, int] = {}
    for item in items:
        c = item.get("country") or "Unknown"
        by_country[c] = by_country.get(c, 0) + 1
        s = item.get("data_source") or "unknown"
        by_source[s] = by_source.get(s, 0) + 1

    summary = {
        "generated_at": _now_iso(),
        "day": day_str,
        "sprint": "SPRINT-001",
        "company_count": len(items),
        "pending_approval": payload["pending_approval"],
        "by_country": by_country,
        "by_source": by_source,
        "files": {"json": json_path.name, "csv": csv_path.name},
    }
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")

    return {
        "outreach_queue_dir": str(out_dir),
        "json_path": str(json_path),
        "csv_path": str(csv_path),
        "summary_path": str(summary_path),
        "company_count": len(items),
        "pending_approval": payload["pending_approval"],
        "summary": summary,
    }

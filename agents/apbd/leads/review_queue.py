"""File-based human review queue for APBD leads."""

from __future__ import annotations

import json
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from agents.apbd.leads.repository import load_companies, upsert_company

ROOT = Path(__file__).resolve().parents[3]
QUEUE_FILE = ROOT / "runtime" / "apbd" / "leads" / "db" / "review_queue.json"


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _atomic_write(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", dir=str(path.parent))
    try:
        with open(fd, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
            fh.write("\n")
        Path(tmp).replace(path)
    except Exception:
        Path(tmp).unlink(missing_ok=True)
        raise


def load_queue() -> list[dict[str, Any]]:
    if not QUEUE_FILE.is_file():
        return []
    data = json.loads(QUEUE_FILE.read_text(encoding="utf-8"))
    return list(data.get("items") or [])


def save_queue(items: list[dict[str, Any]]) -> None:
    _atomic_write(QUEUE_FILE, {"version": 1, "updated_at": _now(), "items": items})


def enqueue_needs_review(company: dict[str, Any]) -> None:
    items = load_queue()
    cid = str(company.get("id") or "")
    items = [i for i in items if i.get("company_id") != cid]
    items.append(
        {
            "company_id": cid,
            "display_name": company.get("display_name"),
            "city": (company.get("location") or {}).get("city"),
            "score": company.get("score"),
            "priority": company.get("priority"),
            "chinese": (company.get("chinese_relevance") or {}).get("status"),
            "queued_at": _now(),
            "status": "pending",
        }
    )
    save_queue(items)


def maybe_auto_status(company: dict[str, Any]) -> dict[str, Any]:
    """Light auto status: closed → rejected; high score → needs_review."""
    biz = str(company.get("business_status") or "").upper()
    if biz in ("CLOSED_PERMANENTLY", "PERMANENTLY_CLOSED"):
        company["status"] = "rejected"
        company["notes"] = ((company.get("notes") or "") + " | auto:permanently_closed").strip(" |")
        return company
    if company.get("status") in ("approved_for_outreach", "verified", "rejected"):
        return company
    score = float(company.get("score") or 0)
    if score >= 55 and company.get("status") in ("discovered", "enriched"):
        company["status"] = "needs_review"
    return company


def approve_for_outreach(company_id: str, *, reviewer: str = "ceo") -> dict[str, Any]:
    companies = {c["id"]: c for c in load_companies()}
    company = companies.get(company_id)
    if not company:
        return {"ok": False, "error": "not_found"}
    company["status"] = "approved_for_outreach"
    company["crm_status"] = "ready_to_contact"
    company["last_verified_at"] = _now()
    cr = dict(company.get("chinese_relevance") or {})
    if not cr.get("reviewed_by"):
        cr["reviewed_by"] = reviewer
        cr["reviewed_at"] = _now()
        company["chinese_relevance"] = cr
    upsert_company(company, source="human_approve")
    items = load_queue()
    for i in items:
        if i.get("company_id") == company_id:
            i["status"] = "approved"
            i["reviewed_at"] = _now()
            i["reviewed_by"] = reviewer
    save_queue(items)
    return {"ok": True, "company": company}


def reject_company(company_id: str, *, reason: str = "", reviewer: str = "ceo") -> dict[str, Any]:
    companies = {c["id"]: c for c in load_companies()}
    company = companies.get(company_id)
    if not company:
        return {"ok": False, "error": "not_found"}
    company["status"] = "rejected"
    company["notes"] = ((company.get("notes") or "") + f" | reject:{reason}").strip(" |")
    upsert_company(company, source="human_reject")
    items = load_queue()
    for i in items:
        if i.get("company_id") == company_id:
            i["status"] = "rejected"
            i["reviewed_at"] = _now()
            i["reviewed_by"] = reviewer
            i["reason"] = reason
    save_queue(items)
    return {"ok": True, "company_id": company_id}

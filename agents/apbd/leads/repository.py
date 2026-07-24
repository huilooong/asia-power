"""JSON-file lead repository (no new SQL CRM)."""

from __future__ import annotations

import json
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from agents.apbd.leads.normalize import normalize_name, normalize_phone

ROOT = Path(__file__).resolve().parents[3]
DB_DIR = ROOT / "runtime" / "apbd" / "leads" / "db"
COMPANIES_FILE = DB_DIR / "companies.json"
TASKS_FILE = DB_DIR / "search_tasks.json"
CHANGES_FILE = DB_DIR / "change_history.jsonl"
RAW_DIR = DB_DIR / "raw_places"

STATUSES = (
    "discovered",
    "enriched",
    "needs_review",
    "verified",
    "approved_for_outreach",
    "rejected",
    "stale",
)


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _atomic_write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", dir=str(path.parent))
    try:
        with open(fd, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
            fh.write("\n")
        Path(tmp).replace(path)
    except Exception:
        try:
            Path(tmp).unlink(missing_ok=True)
        except OSError:
            pass
        raise


def ensure_db() -> None:
    DB_DIR.mkdir(parents=True, exist_ok=True)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    if not COMPANIES_FILE.is_file():
        _atomic_write_json(COMPANIES_FILE, {"version": 1, "companies": []})
    if not TASKS_FILE.is_file():
        _atomic_write_json(TASKS_FILE, {"version": 1, "tasks": []})


def load_companies() -> list[dict[str, Any]]:
    ensure_db()
    data = json.loads(COMPANIES_FILE.read_text(encoding="utf-8"))
    items = data.get("companies") if isinstance(data, dict) else data
    return [c for c in (items or []) if isinstance(c, dict)]


def save_companies(companies: list[dict[str, Any]]) -> None:
    ensure_db()
    _atomic_write_json(COMPANIES_FILE, {"version": 1, "updated_at": _now(), "companies": companies})


def append_change(company_id: str, field: str, old: Any, new: Any, *, source: str, task_id: str = "") -> None:
    ensure_db()
    row = {
        "ts": _now(),
        "company_id": company_id,
        "field": field,
        "old": old,
        "new": new,
        "source": source,
        "task_id": task_id,
    }
    with CHANGES_FILE.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(row, ensure_ascii=False) + "\n")


def find_by_place_id(companies: list[dict[str, Any]], place_id: str) -> dict[str, Any] | None:
    pid = (place_id or "").strip()
    if not pid:
        return None
    for c in companies:
        loc = c.get("location") or {}
        if str(loc.get("google_place_id") or "") == pid:
            return c
        for ext in c.get("external_profiles") or []:
            if ext.get("source") == "google_places" and str(ext.get("external_id") or "") == pid:
                return c
    return None


def find_fuzzy_duplicate(companies: list[dict[str, Any]], candidate: dict[str, Any]) -> dict[str, Any] | None:
    """Secondary match: same normalized phone or (name + city)."""
    phone = normalize_phone(str((candidate.get("contact_channels") or [{}])[0].get("value") or ""))
    # also check candidate phone field
    for ch in candidate.get("contact_channels") or []:
        if ch.get("type") == "phone":
            phone = normalize_phone(str(ch.get("value") or "")) or phone
    name = normalize_name(str(candidate.get("display_name") or candidate.get("legal_name") or ""))
    city = str((candidate.get("location") or {}).get("city") or "").strip().lower()
    for c in companies:
        for ch in c.get("contact_channels") or []:
            if ch.get("type") == "phone" and phone and normalize_phone(str(ch.get("value") or "")) == phone:
                return c
        cname = normalize_name(str(c.get("display_name") or ""))
        ccity = str((c.get("location") or {}).get("city") or "").strip().lower()
        if name and cname == name and city and ccity == city:
            return c
    return None


def new_company_shell(*, country_code: str = "CA") -> dict[str, Any]:
    cid = f"lead-{uuid.uuid4().hex[:12]}"
    now = _now()
    return {
        "id": cid,
        "legal_name": "",
        "display_name": "",
        "normalized_name": "",
        "description": "",
        "business_type": "independent_repair_shop",
        "independent_status": "unknown",
        "franchise_name": "",
        "chain_status": "unknown",
        "business_status": "OPERATIONAL",
        "founded_year": None,
        "employee_range": "",
        "primary_language": "",
        "country_code": country_code,
        "location": {},
        "contact_channels": [],
        "contact_persons": [],
        "services": [],
        "brands": [],
        "external_profiles": [],
        "chinese_relevance": {
            "status": "unknown",
            "evidence_type": "",
            "evidence_text": "",
            "evidence_url": "",
            "confidence": 0.0,
            "reviewed_by": "",
            "reviewed_at": "",
        },
        "score": None,
        "score_breakdown": {},
        "score_version": "",
        "priority": "",
        "status": "discovered",
        "crm_status": "research",
        "do_not_contact": False,
        "source_urls": [],
        "notes": "",
        "human_locked_fields": [],
        "created_at": now,
        "updated_at": now,
        "last_verified_at": "",
        "outreach_activities": [],
    }


def upsert_company(company: dict[str, Any], *, source: str = "system") -> dict[str, Any]:
    companies = load_companies()
    cid = str(company.get("id") or "")
    idx = next((i for i, c in enumerate(companies) if c.get("id") == cid), -1)
    company["updated_at"] = _now()
    if idx >= 0:
        old = companies[idx]
        for key in ("status", "score", "priority", "chinese_relevance", "business_type"):
            if old.get(key) != company.get(key):
                append_change(cid, key, old.get(key), company.get(key), source=source)
        # Respect human locks
        locked = set(old.get("human_locked_fields") or [])
        merged = {**old, **company}
        for field in locked:
            if field in old:
                merged[field] = old[field]
        companies[idx] = merged
        save_companies(companies)
        return merged
    companies.append(company)
    save_companies(companies)
    append_change(cid, "*", None, "created", source=source)
    return company


def list_companies(
    *,
    country: str = "",
    city: str = "",
    status: str = "",
    priority: str = "",
    chinese: str = "",
    min_score: float | None = None,
    limit: int = 0,
) -> list[dict[str, Any]]:
    rows = load_companies()
    out: list[dict[str, Any]] = []
    for c in rows:
        if country and str(c.get("country_code") or "").upper() != country.upper():
            continue
        loc = c.get("location") or {}
        if city and str(loc.get("city") or "").lower() != city.lower():
            continue
        if status and str(c.get("status") or "") != status:
            continue
        if priority and str(c.get("priority") or "") != priority:
            continue
        if chinese:
            cr = (c.get("chinese_relevance") or {}).get("status") or "unknown"
            if cr != chinese:
                continue
        if min_score is not None:
            sc = c.get("score")
            if sc is None or float(sc) < float(min_score):
                continue
        if c.get("do_not_contact"):
            continue
        out.append(c)
    out.sort(key=lambda x: (-(float(x.get("score") or 0)), str(x.get("display_name") or "")))
    if limit > 0:
        return out[:limit]
    return out


def save_search_task(task: dict[str, Any]) -> None:
    ensure_db()
    data = json.loads(TASKS_FILE.read_text(encoding="utf-8"))
    tasks = list(data.get("tasks") or [])
    tasks.append(task)
    # keep last 2000
    data["tasks"] = tasks[-2000:]
    data["updated_at"] = _now()
    _atomic_write_json(TASKS_FILE, data)


def save_raw_place(place_id: str, payload: dict[str, Any]) -> Path:
    ensure_db()
    safe = (place_id or "unknown").replace("/", "_")
    path = RAW_DIR / f"{safe}.json"
    _atomic_write_json(path, {"fetched_at": _now(), "payload": payload})
    return path


def count_by_region(country: str = "CA") -> dict[str, int]:
    from agents.apbd.leads.market_config import get_country, load_markets

    cfg = get_country(load_markets(), country)
    counts: dict[str, int] = {}
    companies = [c for c in load_companies() if str(c.get("country_code") or "").upper() == country.upper()]
    companies = [c for c in companies if c.get("status") != "rejected"]
    for region in cfg.get("regions") or []:
        rid = str(region.get("id") or "")
        cities = {str(x).lower() for x in (region.get("cities") or [])}
        n = sum(1 for c in companies if str((c.get("location") or {}).get("city") or "").lower() in cities)
        counts[rid] = n
    counts["_total_valid"] = len(companies)
    return counts


def iter_needing_refresh(*, older_than_days: int = 60) -> Iterable[dict[str, Any]]:
    from datetime import datetime, timedelta, timezone

    cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)
    for c in load_companies():
        if c.get("status") in ("rejected",):
            continue
        raw = str(c.get("last_verified_at") or c.get("updated_at") or "")
        if not raw:
            yield c
            continue
        try:
            ts = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            yield c
            continue
        if ts < cutoff:
            yield c

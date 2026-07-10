"""Opportunity persistence service (APSALES-101)."""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from domain.opportunity.decision_stub import build_decision_stub, persist_decision_stub
from domain.opportunity.models import CHANNEL_CODES, OUTCOME_OPEN, PIPELINE_STAGE_INQUIRY, SALES_STAGE_LEAD

ROOT = Path(__file__).resolve().parent.parent.parent
OPPORTUNITIES_DIR = ROOT / "data" / "apsales" / "opportunities"
INDEX_FILE = ROOT / "data" / "apsales" / "opportunity_index.jsonl"


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def ensure_dirs() -> None:
    OPPORTUNITIES_DIR.mkdir(parents=True, exist_ok=True)
    INDEX_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not INDEX_FILE.exists():
        INDEX_FILE.touch()


def reconfigure_storage(base: Path) -> None:
    """Test helper — redirect opportunity storage."""
    global OPPORTUNITIES_DIR, INDEX_FILE
    OPPORTUNITIES_DIR = base / "opportunities"
    INDEX_FILE = base / "opportunity_index.jsonl"
    from domain.opportunity import decision_stub
    decision_stub.reconfigure_decisions_file(base / "decisions.jsonl")
    ensure_dirs()


def _opp_path(opportunity_id: str) -> Path:
    safe = re.sub(r"[^a-zA-Z0-9_-]", "", opportunity_id)
    return OPPORTUNITIES_DIR / f"{safe}.json"


def generate_opportunity_id(channel: str) -> str:
    code = CHANNEL_CODES.get((channel or "").lower(), "XX")[:3]
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    suffix = uuid.uuid4().hex[:6]
    return f"OPP-{stamp}-{code}-{suffix}"


def _parse_engine_slug(landing_page: str) -> str:
    path = landing_page
    if "://" in landing_page:
        path = urlparse(landing_page).path or landing_page
    path = path.split("?")[0].rstrip("/")
    if path.startswith("/engines/") and path.endswith(".html"):
        return path.split("/engines/")[-1].replace(".html", "")
    if path.startswith("engines/") and path.endswith(".html"):
        return path.split("engines/")[-1].replace(".html", "")
    return ""


def _infer_entry_channel(payload: dict[str, Any]) -> str:
    if payload.get("entry_channel"):
        return str(payload["entry_channel"])
    utm_medium = (payload.get("utm_medium") or "").lower()
    if utm_medium in {"cpc", "paid", "ppc"}:
        return "paid"
    utm_source = (payload.get("utm_source") or "").lower()
    if utm_source in {"google", "bing"} and not utm_medium:
        return "organic"
    source = (payload.get("channel") or payload.get("source") or "").lower()
    if source in {"facebook", "instagram", "tiktok"}:
        return "social"
    if source == "email":
        return "email"
    referrer = (payload.get("referrer") or "").lower()
    if referrer and "google" in referrer:
        return "organic"
    if referrer:
        return "organic"
    return "unknown"


def _extract_traffic(payload: dict[str, Any]) -> dict[str, Any]:
    landing = payload.get("landing_page") or payload.get("landing_url") or ""
    return {
        "landing_page": landing,
        "referrer": payload.get("referrer") or "",
        "utm_source": payload.get("utm_source") or "",
        "utm_medium": payload.get("utm_medium") or "",
        "utm_campaign": payload.get("utm_campaign") or "",
        "engine_slug": payload.get("engine_slug") or _parse_engine_slug(landing),
        "entry_channel": _infer_entry_channel(payload),
    }


def _default_opportunity(
    *,
    opportunity_id: str,
    customer_hash: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    channel = (payload.get("channel") or payload.get("source") or "unknown").lower()
    now = _now_iso()
    engine = (payload.get("engine") or payload.get("product") or "").strip()
    stub = build_decision_stub(opportunity_id)
    return {
        "opportunity_id": opportunity_id,
        "created_at": now,
        "updated_at": now,
        "customer": {
            "customer_hash": customer_hash,
            "customer_name": payload.get("customer_name") or payload.get("customer") or "unknown",
            "country": payload.get("country") or "",
            "language": payload.get("language") or payload.get("detected_language") or "en",
            "contact_channels": [channel] if channel else [],
        },
        "traffic": _extract_traffic(payload),
        "vehicle": {
            "make": payload.get("make") or "",
            "model": payload.get("model") or "",
            "year": payload.get("year") or "",
        },
        "vin": payload.get("vin") or "",
        "engine": engine,
        "gearbox": payload.get("gearbox") or "",
        "half_cut": payload.get("half_cut") or "",
        "budget": {
            "amount": payload.get("budget_amount") or 0,
            "currency": payload.get("budget_currency") or "USD",
            "band": payload.get("budget_band") or "unknown",
        },
        "urgency": payload.get("urgency") or "medium",
        "probability": 0.1,
        "sales_stage": SALES_STAGE_LEAD,
        "pipeline_stage": PIPELINE_STAGE_INQUIRY,
        "source": channel or "unknown",
        "current_status": "New inquiry received",
        "next_action": "Qualify buyer intent",
        "follow_up_at": None,
        "expected_revenue": float(payload.get("expected_revenue") or 0),
        "expected_profit": 0,
        "confidence_score": 0.0,
        "inventory_matches": [],
        "supplier_candidates": [],
        "decision_recommendation": stub,
        "quote": {
            "quote_id": "",
            "status": "",
            "sent_at": None,
            "valid_until": None,
            "total_usd": 0,
        },
        "events": [],
        "draft_ids": list(payload.get("draft_ids") or []),
        "outcome": {
            "result": OUTCOME_OPEN,
            "loss_reason": "",
            "closed_at": None,
            "actual_revenue": 0,
        },
        "prior_opportunity_ids": [],
    }


def _index_record(opportunity: dict[str, Any]) -> dict[str, Any]:
    quote = opportunity.get("quote") or {}
    outcome = opportunity.get("outcome") or {}
    customer = opportunity.get("customer") or {}
    traffic = opportunity.get("traffic") or {}
    return {
        "opportunity_id": opportunity["opportunity_id"],
        "created_at": opportunity.get("created_at"),
        "updated_at": opportunity.get("updated_at"),
        "sales_stage": opportunity.get("sales_stage"),
        "pipeline_stage": opportunity.get("pipeline_stage"),
        "outcome": outcome.get("result", OUTCOME_OPEN),
        "customer_hash": customer.get("customer_hash", ""),
        "engine": opportunity.get("engine") or "",
        "urgency": opportunity.get("urgency") or "medium",
        "expected_revenue": opportunity.get("expected_revenue") or 0,
        "quote_status": quote.get("status") or "",
        "follow_up_at": opportunity.get("follow_up_at"),
        "landing_page": traffic.get("landing_page") or "",
        "engine_slug": traffic.get("engine_slug") or "",
        "utm_campaign": traffic.get("utm_campaign") or "",
        "entry_channel": traffic.get("entry_channel") or "unknown",
    }


def _append_index(opportunity: dict[str, Any]) -> None:
    ensure_dirs()
    with INDEX_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(_index_record(opportunity), ensure_ascii=False) + "\n")


def _save(opportunity: dict[str, Any]) -> dict[str, Any]:
    ensure_dirs()
    opportunity["updated_at"] = _now_iso()
    path = _opp_path(opportunity["opportunity_id"])
    path.write_text(json.dumps(opportunity, indent=2, ensure_ascii=False), encoding="utf-8")
    _append_index(opportunity)
    return opportunity


def append_event(
    opportunity_id: str,
    event_type: str,
    *,
    actor: str = "apsales",
    note: str = "",
    payload: dict[str, Any] | None = None,
    correlation_id: str = "",
) -> dict[str, Any]:
    opp = find(opportunity_id)
    if not opp:
        raise KeyError(f"Opportunity not found: {opportunity_id}")
    entry = {
        "ts": _now_iso(),
        "type": event_type,
        "actor": actor,
        "note": note,
        "payload": payload or {},
        "correlation_id": correlation_id,
    }
    opp.setdefault("events", []).append(entry)
    return _save(opp)


def create(
    customer_hash: str,
    payload: dict[str, Any],
    *,
    correlation_id: str = "",
) -> dict[str, Any]:
    channel = (payload.get("channel") or payload.get("source") or "unknown").lower()
    opportunity_id = generate_opportunity_id(channel)
    opp = _default_opportunity(
        opportunity_id=opportunity_id,
        customer_hash=customer_hash,
        payload=payload,
    )
    persist_decision_stub(opp["decision_recommendation"])
    opp["events"].append({
        "ts": _now_iso(),
        "type": "InquiryReceived",
        "actor": "apsales_runtime",
        "note": "Opportunity created",
        "payload": dict(payload),
        "correlation_id": correlation_id,
    })
    return _save(opp)


def update(opportunity_id: str, **fields: Any) -> dict[str, Any]:
    opp = find(opportunity_id)
    if not opp:
        raise KeyError(f"Opportunity not found: {opportunity_id}")
    for key, value in fields.items():
        if key in {"opportunity_id", "created_at", "events", "decision_recommendation"}:
            continue
        opp[key] = value
    return _save(opp)


def merge(
    opportunity_id: str,
    payload: dict[str, Any],
    *,
    correlation_id: str = "",
) -> dict[str, Any]:
    opp = find(opportunity_id)
    if not opp:
        raise KeyError(f"Opportunity not found: {opportunity_id}")
    note = (payload.get("message") or payload.get("text") or "")[:200]
    opp.setdefault("events", []).append({
        "ts": _now_iso(),
        "type": "InquiryReceived",
        "actor": "apsales_runtime",
        "note": f"Merged inquiry: {note}" if note else "Merged inquiry",
        "payload": dict(payload),
        "correlation_id": correlation_id,
    })
    opp["current_status"] = "Additional inquiry merged"
    draft_id = payload.get("draft_id")
    if draft_id and draft_id not in opp.get("draft_ids", []):
        opp.setdefault("draft_ids", []).append(draft_id)
    return _save(opp)


def find(opportunity_id: str) -> dict[str, Any] | None:
    path = _opp_path(opportunity_id)
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def load_all() -> list[dict[str, Any]]:
    ensure_dirs()
    out: list[dict[str, Any]] = []
    for path in OPPORTUNITIES_DIR.glob("OPP-*.json"):
        try:
            out.append(json.loads(path.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError):
            continue
    return out


def find_merge_candidate(
    customer_hash: str,
    engine: str,
    *,
    window_days: int = 7,
) -> dict[str, Any] | None:
    engine_norm = (engine or "").strip().upper()
    cutoff = datetime.now(timezone.utc) - timedelta(days=window_days)
    for opp in load_all():
        if (opp.get("outcome") or {}).get("result") != OUTCOME_OPEN:
            continue
        cust = opp.get("customer") or {}
        if cust.get("customer_hash") != customer_hash:
            continue
        opp_engine = (opp.get("engine") or "").strip().upper()
        if engine_norm and opp_engine and opp_engine != engine_norm:
            continue
        if not engine_norm and opp_engine:
            continue
        created = opp.get("created_at") or ""
        try:
            created_dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
        except ValueError:
            continue
        if created_dt < cutoff:
            continue
        return opp
    return None


def list_open(*, limit: int = 100) -> list[dict[str, Any]]:
    items = [o for o in load_all() if (o.get("outcome") or {}).get("result") == OUTCOME_OPEN]
    items.sort(key=lambda o: o.get("updated_at", ""), reverse=True)
    return items[:limit]


def list_closed(*, limit: int = 100) -> list[dict[str, Any]]:
    closed = {"won", "lost", "dormant"}
    items = [o for o in load_all() if (o.get("outcome") or {}).get("result") in closed]
    items.sort(key=lambda o: o.get("updated_at", ""), reverse=True)
    return items[:limit]

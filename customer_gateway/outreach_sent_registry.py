"""Unified outreach sent registry — one email address, one send (ever)."""

from __future__ import annotations

import csv
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
REGISTRY_JSON = ROOT / "reports" / "outreach-sent-registry.json"
BLOCKLIST_CSV = ROOT / "reports" / "outreach-sent-blocklist.csv"
SENT_LOG = ROOT / "runtime/apbd/outreach_sent.jsonl"
BATCH_V2 = ROOT / "runtime/apbd/2026-07-05/outreach_batch_v2.json"
APBD_ROOT = ROOT / "runtime/apbd"
OUTREACH_QUEUE_DIR = ROOT / "memory/customer_gateway/outreach_queue"


def normalize_email(raw: str) -> str:
    email = (raw or "").strip().lower()
    m = re.search(r"[\w.+-]+@[\w.-]+\.[a-z]{2,}", email)
    if m:
        email = m.group(0)
    if email.endswith(".com.com"):
        email = email[:-4]
    return email


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _parse_time(value: str | None) -> datetime:
    if not value:
        return datetime.min.replace(tzinfo=timezone.utc)
    text = value.strip()
    for fmt in (
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M UTC",
    ):
        try:
            dt = datetime.strptime(text.replace("+00:00", "+0000"), fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)


def _merge_record(existing: dict[str, Any] | None, incoming: dict[str, Any]) -> dict[str, Any]:
    if not existing:
        return dict(incoming)
    if _parse_time(incoming.get("sent_at")) >= _parse_time(existing.get("sent_at")):
        merged = {**existing, **incoming}
    else:
        merged = {**incoming, **existing}
    merged["email"] = normalize_email(incoming.get("email") or existing.get("email") or "")
    sources = set(existing.get("sources") or [])
    sources.add(incoming.get("source") or "unknown")
    merged["sources"] = sorted(s for s in sources if s)
    return merged


def _iter_batch_v2_sent() -> list[dict[str, Any]]:
    if not BATCH_V2.is_file():
        return []
    try:
        data = json.loads(BATCH_V2.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    rows: list[dict[str, Any]] = []
    for draft in data.get("drafts") or []:
        if draft.get("status") != "sent":
            continue
        email = normalize_email(draft.get("email") or "")
        if not email:
            continue
        rows.append(
            {
                "email": email,
                "company": draft.get("company") or "",
                "country": draft.get("country") or "",
                "source": "outreach_batch_v2",
                "sent_at": draft.get("sent_at") or draft.get("generated_at") or "",
                "resend_id": draft.get("resend_id") or "",
            }
        )
    return rows


def _iter_sent_log() -> list[dict[str, Any]]:
    if not SENT_LOG.is_file():
        return []
    rows: list[dict[str, Any]] = []
    for line in SENT_LOG.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        email = normalize_email(row.get("email") or "")
        if email:
            rows.append({**row, "email": email})
    return rows


def _iter_apbd_queue_sent() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for queue_dir in sorted(APBD_ROOT.glob("*/outreach_queue")):
        for path in sorted(queue_dir.glob("*.json")):
            if path.name in {"outreach-queue.json", "summary.json"}:
                continue
            try:
                record = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            if record.get("approval_status") != "sent":
                continue
            email = normalize_email(record.get("public_email") or "")
            if not email:
                continue
            rows.append(
                {
                    "email": email,
                    "company": record.get("company") or "",
                    "country": record.get("country") or "",
                    "source": "apbd_outreach_queue",
                    "sent_at": record.get("sent_at") or record.get("generated_at") or "",
                    "resend_id": record.get("resend_id") or "",
                    "outreach_id": record.get("outreach_id") or "",
                }
            )
    return rows


def _iter_customer_gateway_sent() -> list[dict[str, Any]]:
    if not OUTREACH_QUEUE_DIR.is_dir():
        return []
    rows: list[dict[str, Any]] = []
    for path in sorted(OUTREACH_QUEUE_DIR.glob("outreach-*.json")):
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if record.get("status") != "sent":
            continue
        cand = record.get("candidate") or {}
        email = normalize_email(record.get("sent_to") or cand.get("email") or "")
        if not email:
            continue
        rows.append(
            {
                "email": email,
                "company": cand.get("name") or "",
                "country": cand.get("country") or "",
                "source": "website_lead_outreach",
                "sent_at": record.get("sent_at") or "",
                "resend_id": record.get("resend_id") or "",
                "outreach_id": record.get("outreach_id") or "",
            }
        )
    return rows


def collect_sent_records() -> dict[str, dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    collectors = (
        _iter_batch_v2_sent,
        _iter_sent_log,
        _iter_apbd_queue_sent,
        _iter_customer_gateway_sent,
    )
    for collector in collectors:
        for row in collector():
            email = normalize_email(row.get("email") or "")
            if not email:
                continue
            current = merged.get(email)
            row = {**row, "email": email, "sources": [row.get("source") or "unknown"]}
            merged[email] = _merge_record(current, row)
    return merged


def load_registry() -> dict[str, Any]:
    if REGISTRY_JSON.is_file():
        try:
            data = json.loads(REGISTRY_JSON.read_text(encoding="utf-8"))
            if isinstance(data, dict) and isinstance(data.get("entries"), dict):
                return data
        except (json.JSONDecodeError, OSError):
            pass
    return {"updated_at": "", "total": 0, "entries": {}}


def load_sent_emails() -> set[str]:
    registry = load_registry()
    entries = registry.get("entries") or {}
    if entries:
        return {normalize_email(e) for e in entries if normalize_email(e)}
    return set(collect_sent_records())


def is_already_sent(email: str) -> bool:
    normalized = normalize_email(email)
    if not normalized:
        return False
    return normalized in load_sent_emails()


def save_registry(entries: dict[str, dict[str, Any]]) -> dict[str, Any]:
    payload = {
        "updated_at": _now_iso(),
        "total": len(entries),
        "entries": dict(sorted(entries.items(), key=lambda kv: kv[0])),
    }
    REGISTRY_JSON.parent.mkdir(parents=True, exist_ok=True)
    REGISTRY_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    export_blocklist_csv(entries)
    return payload


def rebuild_registry() -> dict[str, Any]:
    return save_registry(collect_sent_records())


def export_blocklist_csv(entries: dict[str, dict[str, Any]] | None = None) -> Path:
    rows = entries if entries is not None else collect_sent_records()
    BLOCKLIST_CSV.parent.mkdir(parents=True, exist_ok=True)
    with BLOCKLIST_CSV.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(["email", "company", "country", "sent_at", "source", "resend_id"])
        for email in sorted(rows):
            row = rows[email]
            writer.writerow(
                [
                    email,
                    row.get("company") or "",
                    row.get("country") or "",
                    row.get("sent_at") or "",
                    ",".join(row.get("sources") or [row.get("source") or ""]),
                    row.get("resend_id") or "",
                ]
            )
    return BLOCKLIST_CSV


def append_sent_log(entry: dict[str, Any]) -> None:
    SENT_LOG.parent.mkdir(parents=True, exist_ok=True)
    with SENT_LOG.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")


def record_sent(
    *,
    email: str,
    company: str = "",
    country: str = "",
    source: str,
    resend_id: str = "",
    sent_at: str | None = None,
    **extra: Any,
) -> dict[str, Any]:
    normalized = normalize_email(email)
    if not normalized:
        raise ValueError("Invalid email for outreach registry")

    sent_at = sent_at or _now_iso()
    entry = {
        "email": normalized,
        "company": company,
        "country": country,
        "source": source,
        "sent_at": sent_at,
        "resend_id": resend_id,
        **extra,
    }
    append_sent_log(entry)

    registry = load_registry()
    entries = dict(registry.get("entries") or collect_sent_records())
    entries[normalized] = _merge_record(entries.get(normalized), entry)
    save_registry(entries)
    return entries[normalized]

"""Shared knowledge ingest — upload harvest → agent-readable knowledge base.

Facts written here are sourced, additive, and readable by all agents via
``inventory`` tool / ``data/knowledge-base/upload-learnings.json``.
"""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
KB_DIR = ROOT / "data" / "knowledge-base"
UPLOAD_LEARNINGS = KB_DIR / "upload-learnings.json"
MODEL_DICT = KB_DIR / "model-dictionary.json"
VIN_CACHE = KB_DIR / "vin-cache.json"

_VIN_RE = re.compile(r"^[A-HJ-NPR-Z0-9]{17}$", re.I)


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def reconfigure_paths(*, kb_dir: Path | None = None) -> None:
    """Point knowledge paths at a directory (for tests)."""
    global KB_DIR, UPLOAD_LEARNINGS, MODEL_DICT, VIN_CACHE
    if kb_dir is None:
        kb_dir = ROOT / "data" / "knowledge-base"
    KB_DIR = kb_dir
    UPLOAD_LEARNINGS = KB_DIR / "upload-learnings.json"
    MODEL_DICT = KB_DIR / "model-dictionary.json"
    VIN_CACHE = KB_DIR / "vin-cache.json"


def _load_json(path: Path, fallback: Any) -> Any:
    if not path.is_file():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return fallback


def _save_json_atomic(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def _entry_id(source: str, key: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", f"{source}-{key}".lower()).strip("-") or "entry"
    return f"upload-{slug}"[:80]


def _confidence_from_record(record: dict[str, Any]) -> str:
    method = str(record.get("decodeMethod") or "").lower()
    conf = str(record.get("decodeConfidence") or "").lower()
    if "ocr" in method:
        return conf or "ocr"
    if record.get("vin"):
        return "manual"
    return "import"


def _tags_from_record(record: dict[str, Any]) -> list[str]:
    tags = ["inventory", "upload", "shared"]
    brand = str(record.get("brand") or "").strip()
    brand_slug = str(record.get("brandSlug") or "").strip()
    if brand:
        tags.append(f"brand:{brand.lower()}")
    if brand_slug:
        tags.append(f"brand_slug:{brand_slug}")
    supplier = str(record.get("supplierName") or "").strip()
    if supplier:
        tags.append(f"supplier:{supplier}")
    qxb = record.get("qxb") or {}
    if qxb:
        tags.append("qxb")
    return tags


def listing_facts(record: dict[str, Any], *, source: str, source_ref: str) -> dict[str, Any]:
    """Normalize an approved listing / upload record into shared facts."""
    photos = record.get("photos") or []
    photo_labels = [str(p.get("label") or "") for p in photos if isinstance(p, dict)]
    qxb = record.get("qxb") or {}
    return {
        "stockId": record.get("stockId"),
        "submissionId": record.get("submissionId"),
        "vin": (record.get("vin") or "").strip().upper() or None,
        "brand": record.get("brand"),
        "brandSlug": record.get("brandSlug"),
        "model": record.get("model"),
        "year": record.get("year"),
        "engineCode": record.get("engineCode") or None,
        "vehicleCondition": record.get("vehicleCondition"),
        "vehicleCategory": record.get("vehicleCategory"),
        "supplierName": record.get("supplierName"),
        "supplierVerified": record.get("supplierVerified"),
        "decodeMethod": record.get("decodeMethod"),
        "decodeConfidence": record.get("decodeConfidence"),
        "photoCount": len(photos),
        "photoLabels": photo_labels,
        "title": record.get("title"),
        "slug": record.get("slug"),
        "qxbRow": qxb.get("row"),
        "qxbBrandCn": qxb.get("brandCn"),
        "qxbModelKey": qxb.get("modelKey"),
        "qxbDescription": qxb.get("description"),
        "source": source,
        "sourceRef": source_ref,
    }


def _upsert_learning_entry(
    store: dict[str, Any],
    *,
    source: str,
    key: str,
    kind: str,
    facts: dict[str, Any],
    confidence: str,
    tags: list[str],
    source_ref: str,
) -> tuple[dict[str, Any], bool]:
    entries: list[dict[str, Any]] = store.setdefault("entries", [])
    entry_id = _entry_id(source, key)
    for existing in entries:
        if existing.get("id") == entry_id:
            existing.update({
                "kind": kind,
                "source": source,
                "sourceRef": source_ref,
                "learnedAt": _iso_now(),
                "confidence": confidence,
                "facts": facts,
                "tags": sorted(set(tags)),
                "agents": ["*"],
            })
            return existing, False
    entry = {
        "id": entry_id,
        "kind": kind,
        "source": source,
        "sourceRef": source_ref,
        "learnedAt": _iso_now(),
        "confidence": confidence,
        "facts": facts,
        "tags": sorted(set(tags)),
        "agents": ["*"],
    }
    entries.append(entry)
    return entry, True


def enrich_model_dictionary(record: dict[str, Any], *, dry_run: bool = False) -> bool:
    """Additively enrich model-dictionary from an upload record (never deletes)."""
    brand_slug = str(record.get("brandSlug") or "").strip()
    qxb = record.get("qxb") or {}
    model_key = str(qxb.get("modelKey") or record.get("model") or "").strip()
    if not brand_slug or not model_key:
        return False

    store = _load_json(MODEL_DICT, {})
    brand_bucket = store.setdefault(brand_slug, {})
    if model_key in brand_bucket:
        return False

    english = str(record.get("model") or "").strip() or None
    if dry_run:
        return True

    brand_bucket[model_key] = {
        "chinese": model_key,
        "english": english,
        "source": "upload_ingest",
        "learnedAt": _iso_now(),
        "uploadSource": record.get("submissionId") or record.get("stockId"),
    }
    _save_json_atomic(MODEL_DICT, store)
    return True


def enrich_vin_cache(record: dict[str, Any], *, dry_run: bool = False) -> bool:
    """Store OCR/manual VIN from upload when not already cached."""
    vin = (record.get("vin") or "").strip().upper()
    if not vin or not _VIN_RE.match(vin):
        return False

    cache = _load_json(VIN_CACHE, {})
    if vin in cache:
        return False

    if dry_run:
        return True

    cache[vin] = {
        "vin": vin,
        "source": "upload_ingest",
        "learnedAt": _iso_now(),
        "decodeMethod": record.get("decodeMethod"),
        "decodeConfidence": record.get("decodeConfidence"),
        "brand": record.get("brand"),
        "model": record.get("model"),
        "year": record.get("year"),
        "stockId": record.get("stockId"),
        "submissionId": record.get("submissionId"),
    }
    _save_json_atomic(VIN_CACHE, cache)
    return True


def ingest_listing_record(
    record: dict[str, Any],
    *,
    source: str = "qxb_upload",
    source_ref: str = "",
    dry_run: bool = False,
    enrich_dictionaries: bool = True,
) -> dict[str, Any]:
    """Ingest one approved listing into shared upload-learnings (+ optional dicts)."""
    key = str(record.get("stockId") or record.get("submissionId") or uuid.uuid4().hex[:8])
    ref = source_ref or f"upload:{key}"
    facts = listing_facts(record, source=source, source_ref=ref)
    confidence = _confidence_from_record(record)
    tags = _tags_from_record(record)

    store = _load_json(UPLOAD_LEARNINGS, {"version": "1.0", "updated_at": _now(), "entries": []})
    entry, created = _upsert_learning_entry(
        store,
        source=source,
        key=key,
        kind="vehicle_listing",
        facts=facts,
        confidence=confidence,
        tags=tags,
        source_ref=ref,
    )
    store["version"] = "1.0"
    store["updated_at"] = _now()

    model_added = False
    vin_added = False
    if enrich_dictionaries:
        model_added = enrich_model_dictionary(record, dry_run=dry_run)
        vin_added = enrich_vin_cache(record, dry_run=dry_run)

    if not dry_run:
        _save_json_atomic(UPLOAD_LEARNINGS, store)

    return {
        "id": entry["id"],
        "created": created,
        "stockId": facts.get("stockId"),
        "modelDictionaryAdded": model_added,
        "vinCacheAdded": vin_added,
        "dryRun": dry_run,
    }


def ingest_batch(
    records: list[dict[str, Any]],
    *,
    source: str = "qxb_upload",
    source_ref_prefix: str = "",
    dry_run: bool = False,
    enrich_dictionaries: bool = True,
) -> dict[str, Any]:
    """Ingest many listing records; returns summary counts."""
    results = []
    for rec in records:
        key = str(rec.get("stockId") or rec.get("submissionId") or "")
        ref = f"{source_ref_prefix}#{key}" if source_ref_prefix and key else source_ref_prefix or ""
        results.append(
            ingest_listing_record(
                rec,
                source=source,
                source_ref=ref,
                dry_run=dry_run,
                enrich_dictionaries=enrich_dictionaries,
            )
        )
    created = sum(1 for r in results if r.get("created"))
    return {
        "total": len(results),
        "created": created,
        "updated": len(results) - created,
        "modelDictionaryAdded": sum(1 for r in results if r.get("modelDictionaryAdded")),
        "vinCacheAdded": sum(1 for r in results if r.get("vinCacheAdded")),
        "dryRun": dry_run,
        "source": source,
    }


def sync_from_import_file(
    path: Path,
    *,
    dry_run: bool = False,
    enrich_dictionaries: bool = True,
) -> dict[str, Any]:
    """Backfill shared knowledge from an approved-import JSON array."""
    records = _load_json(path, [])
    if not isinstance(records, list):
        raise ValueError(f"Expected JSON array in {path}")
    return ingest_batch(
        records,
        source="qxb_upload",
        source_ref_prefix=str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path),
        dry_run=dry_run,
        enrich_dictionaries=enrich_dictionaries,
    )


def search(query: str, *, limit: int = 20) -> list[dict[str, Any]]:
    """Search upload-learnings by keyword across facts/tags."""
    needle = (query or "").strip().lower()
    if not needle:
        return []
    store = _load_json(UPLOAD_LEARNINGS, {"entries": []})
    hits: list[dict[str, Any]] = []
    for entry in store.get("entries") or []:
        blob = json.dumps(entry, ensure_ascii=False).lower()
        if needle in blob:
            hits.append(entry)
        if len(hits) >= limit:
            break
    return hits


def format_context_snippet(query: str, *, max_entries: int = 6) -> str:
    """Compact, sourced facts for agent system prompts."""
    hits = search(query, limit=max_entries)
    if not hits:
        return ""
    lines = ["## Upload knowledge (sourced)", ""]
    for entry in hits:
        facts = entry.get("facts") or {}
        stock = facts.get("stockId") or entry.get("id")
        src = entry.get("sourceRef") or entry.get("source")
        conf = entry.get("confidence") or "unknown"
        brand = facts.get("brand") or "?"
        model = facts.get("model") or "?"
        vin = facts.get("vin") or "—"
        lines.append(
            f"- [{stock}] {brand} {model} | VIN={vin} | conf={conf} | source={src}"
        )
    return "\n".join(lines) + "\n"


def remember_batch_summary(summary: dict[str, Any], *, source: str = "qxb_upload") -> str:
    """Write a one-line batch summary into shared agent memory (inventory category)."""
    from tools import memory_tool

    total = summary.get("total", 0)
    created = summary.get("created", 0)
    updated = summary.get("updated", 0)
    body = (
        f"Upload knowledge ingest ({source}): {total} listings "
        f"({created} new, {updated} updated) → data/knowledge-base/upload-learnings.json"
    )
    return memory_tool.remember(body, category="inventory", source=source)


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Ingest upload harvest into shared knowledge base")
    parser.add_argument("command", choices=("sync", "search"))
    parser.add_argument("arg", nargs="?", default="")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-enrich", action="store_true", help="Skip model-dictionary / vin-cache")
    parser.add_argument("--remember", action="store_true", help="Append batch summary to memory")
    args = parser.parse_args()

    if args.command == "sync":
        path = Path(args.arg) if args.arg else ROOT / "reports" / "qxb-approved-import.json"
        summary = sync_from_import_file(
            path,
            dry_run=args.dry_run,
            enrich_dictionaries=not args.no_enrich,
        )
        if args.remember and not args.dry_run:
            remember_batch_summary(summary)
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return

    hits = search(args.arg)
    print(json.dumps(hits, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

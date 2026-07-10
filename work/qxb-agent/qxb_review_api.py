#!/usr/bin/env python3
"""QXB CEO review API — Codex UI + 子龙 training + live upload."""

from __future__ import annotations

import csv
import json
import os
import re
import sys
from pathlib import Path
from typing import Any
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[2]
PHOTO_ROOT = ROOT / "data/qxb-photos"
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
ROW_FOLDER_RE = re.compile(r"^row-(\d+)", re.I)
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

from inventory_core import qxb_pipeline
from inventory_core.qxb_photo_pick import (
    load_learnings,
    photo_index_from_path,
    pick_photo_slots,
    rebuild_recognition_model,
    record_photo_feedback,
    record_row_photo_index_map,
    save_learnings,
)

SLOT_KEYS = ("front", "rear", "engine", "interior", "vin")
SLOT_KEY_TO_LABEL = {
    "front": "Front view",
    "rear": "Rear view",
    "engine": "Engine bay",
    "interior": "Interior",
    "vin": "VIN / chassis plate",
}
SLOT_LABELS_ZH = {
    "front": "车头",
    "rear": "车尾",
    "engine": "机舱",
    "interior": "内饰",
    "vin": "VIN",
}
VIN_CSV = ROOT / "reports/qxb-vin-ocr-results.csv"
NEEDS_VIN_ROWS_FILE = ROOT / "reports/qxb-needs-vin-rows.json"
UPLOAD_QUEUE_FILE = ROOT / "reports/qxb-review-upload-queue.json"
BACKGROUND_UPLOAD_MAX_RETRIES = 6
BACKGROUND_UPLOAD_BACKOFF_SEC = 12.0
DECISION_AUTHORITY = {
    "confirm_and_upload": "human_confirmed_upload",
    "save_training_only": "human_confirmed",
    "skip_missing_photos": "human_skipped",
    "not_same_vehicle": "human_rejected",
}


def _media_url(rel_posix: str) -> str:
    """URL-safe path (encode each segment — spaces/中文 break raw img src)."""
    return "/media/" + "/".join(quote(part, safe="") for part in rel_posix.split("/"))


def _index_from_filename(name: str) -> int:
    m = re.match(r"^(\d+)_", name)
    return int(m.group(1)) if m else 0


def _folder_for_row(row: int) -> Path | None:
    prefix = f"row-{row:04d}_"
    if not PHOTO_ROOT.is_dir():
        return None
    for entry in PHOTO_ROOT.iterdir():
        if entry.is_dir() and entry.name.startswith(prefix):
            return entry
    return None


def _all_folder_rows() -> list[int]:
    """Every row-XXXX photo folder under data/qxb-photos — no manifest skip."""
    rows: set[int] = set()
    if not PHOTO_ROOT.is_dir():
        return []
    for entry in PHOTO_ROOT.iterdir():
        if not entry.is_dir():
            continue
        m = ROW_FOLDER_RE.match(entry.name)
        if m:
            rows.add(int(m.group(1)))
    return sorted(rows)


def _load_needs_vin_rows() -> list[int]:
    """Rows where batch upload reported OCR found no VIN (真缺 VIN)."""
    if NEEDS_VIN_ROWS_FILE.is_file():
        data = json.loads(NEEDS_VIN_ROWS_FILE.read_text(encoding="utf-8"))
        return sorted(int(r) for r in data.get("rows") or [])
    batch_path = ROOT / "reports/qxb-batch-progress.json"
    if batch_path.is_file():
        batch = json.loads(batch_path.read_text(encoding="utf-8"))
        return sorted(
            int(r["row"])
            for r in batch.get("failRows") or []
            if "OCR found no VIN" in (r.get("error") or "")
        )
    return []


def _apply_row_filter(
    ctx: qxb_pipeline.PipelineContext,
    rows: list[int],
    row_filter: str,
) -> list[int]:
    if row_filter == "needs_vin":
        allowed = set(_load_needs_vin_rows())
        return [
            r for r in rows
            if r in allowed and not (ctx.vins.get(r) or {}).get("vin")
        ]
    if row_filter == "no_vin_csv":
        return [r for r in rows if not (ctx.vins.get(r) or {}).get("vin")]
    return rows


def _photos_from_folder(row: int) -> list[dict[str, Any]]:
    """Scan row-XXXX_* folder; all images sorted by filename index (01_, 02_…)."""
    folder = _folder_for_row(row)
    if not folder:
        return []
    files = [
        f for f in folder.iterdir()
        if f.is_file() and f.suffix.lower() in IMAGE_EXT
    ]
    files.sort(key=lambda f: (_index_from_filename(f.name), f.name))
    items: list[dict[str, Any]] = []
    for f in files:
        rel = f.relative_to(ROOT).as_posix()
        idx = _index_from_filename(f.name) or (len(items) + 1)
        items.append({
            "index": idx,
            "path": str(f.resolve()),
            "local": rel,
            "url": _media_url(rel),
            "fileName": f.name,
            "label": "",
            "exists": True,
            "sourceFolder": folder.name,
        })
    return items


def _photos_for_row(ctx: qxb_pipeline.PipelineContext, row: int) -> list[dict[str, Any]]:
    """Folder scan is source of truth; manifest only fills missing metadata."""
    items = _photos_from_folder(row)
    if items:
        return items
    manifest = ctx.manifest.get(row, [])
    return [_photo_item_from_manifest(p) for p in sorted(manifest, key=lambda x: int(x["image_index"]))]


def _photo_item_from_manifest(rec: dict) -> dict:
    raw = Path(rec["local_path"])
    path = (ROOT / raw).resolve() if not raw.is_absolute() else raw.resolve()
    try:
        rel = path.relative_to(ROOT).as_posix()
    except ValueError:
        rel = raw.as_posix()
    return {
        "index": int(rec.get("image_index") or _index_from_filename(path.name)),
        "path": str(path),
        "local": rel,
        "url": _media_url(rel),
        "fileName": path.name,
        "label": "",
        "exists": path.is_file(),
        "sourceFolder": path.parent.name,
    }


def _photo_item(rec: dict) -> dict:
    return _photo_item_from_manifest(rec)


def _folder_title(row: int, folder_name: str) -> str:
    if not folder_name:
        return ""
    return re.sub(rf"^row-{row:04d}_?", "", folder_name)


def _candidate_from_row(ctx: qxb_pipeline.PipelineContext, row: int) -> dict[str, Any]:
    photo_items = _photos_for_row(ctx, row)
    folder = _folder_for_row(row)
    photos_for_pick = [
        {"local_path": p["local"], "image_index": p["index"]}
        for p in photo_items
    ]
    insp = qxb_pipeline.inspect_row(ctx, row)
    fields = insp.get("fields") or {}
    vin_info = ctx.vins.get(row) or {}
    picks, pick_meta = pick_photo_slots(photos_for_pick, vin_info or None, row=row)
    queue_entry = (ctx.queue.get("rows") or {}).get(str(row), {})
    suggestions: dict[str, dict] = {}
    for pick in picks:
        pick_path = str(Path(pick["path"]).resolve())
        for key, label in SLOT_KEY_TO_LABEL.items():
            if pick["label"] == label:
                match = next(
                    (p for p in photo_items if p["path"] == pick_path or p["local"] in pick["path"]),
                    None,
                )
                if match:
                    suggestions[key] = match
    return {
        "row": row,
        "submissionId": queue_entry.get("submissionId")
        or qxb_pipeline.resolve_submission_id(row, queue_entry),
        "vin": fields.get("vin") or vin_info.get("vin") or "",
        "brand": fields.get("brand") or "",
        "model": fields.get("model") or "",
        "year": str(fields.get("year") or ""),
        "engineCode": fields.get("engineCode") or "",
        "transmissionCode": fields.get("transmissionCode") or "",
        "drivetrain": fields.get("drivetrain") or "2WD",
        "reviewStatus": queue_entry.get("status") or "pending",
        "photos": photo_items,
        "photoFolders": [folder.name] if folder else [],
        "suggestions": suggestions,
        "pickMeta": pick_meta,
        "ready": insp.get("ready"),
        "blockers": insp.get("blockers") or [],
        "duplicateVin": insp.get("duplicateVin"),
        "duplicateVinMessage": insp.get("duplicateVinMessage") or "",
    }


def _record_row(ctx: qxb_pipeline.PipelineContext, row: int) -> dict[str, Any]:
    folder = _folder_for_row(row)
    stock_id = f"QXB{row:04d}"
    c = _candidate_from_row(ctx, row)
    return {
        "row": row,
        "stockId": stock_id,
        "localIndex": row,
        "localFolder": folder.name if folder else "",
        "localTitle": _folder_title(row, folder.name if folder else ""),
        "candidates": [c],
    }


def cmd_unuploaded(
    page_s: str,
    size_s: str,
    exclude_s: str,
    filter_s: str = "all",
) -> None:
    page = max(0, int(page_s or 0))
    size = max(1, min(50, int(size_s or 10)))
    exclude = {s.strip().upper() for s in (exclude_s or "").split(",") if s.strip()}
    row_filter = (filter_s or "all").strip().lower() or "all"

    ctx = qxb_pipeline.load_context()
    rows = [r for r in _all_folder_rows() if f"QXB{r:04d}" not in exclude]
    rows = _apply_row_filter(ctx, rows, row_filter)
    total = len(rows)
    batch = rows[page * size : page * size + size]
    records = [_record_row(ctx, row) for row in batch]

    print(
        json.dumps(
            {
                "createdAt": qxb_pipeline._iso_now(),
                "mode": "folder_index",
                "filter": row_filter,
                "photoRoot": str(PHOTO_ROOT.relative_to(ROOT)),
                "totalCount": total,
                "unuploadedCount": total,
                "page": page,
                "batchSize": size,
                "records": records,
            },
            ensure_ascii=False,
        )
    )


def cmd_memory() -> None:
    store = load_learnings()
    model = store.get("recognitionModel") or rebuild_recognition_model(store)
    exemplars = store.get("trainingExemplars") or []
    metrics: dict[str, dict[str, Any]] = {}
    for key in SLOT_KEYS:
        label = SLOT_KEY_TO_LABEL[key]
        aff = model.get("indexAffinities", {}).get(key, {}) or {}
        pen = model.get("indexPenalties", {}).get(key, {}) or {}
        aff_sum = sum(float(v) for v in aff.values())
        pen_sum = sum(float(v) for v in pen.values())
        ex_count = sum(
            1 for ex in exemplars
            if label in (ex.get("indexBands") or ex.get("bands") or {})
        )
        upload_count = sum(
            1 for ex in exemplars
            if ex.get("decision") == "confirm_and_upload"
            and label in (ex.get("indexBands") or ex.get("bands") or {})
        )
        score = min(9.9, 5.0 + aff_sum * 0.12 + ex_count * 0.2 + upload_count * 0.35 - pen_sum * 0.08)
        metrics[key] = {
            "label": f"{SLOT_LABELS_ZH[key]}识别率",
            "score": round(score, 1),
            "examples": ex_count,
            "confirmedUploads": upload_count,
        }
    events = []
    for fb in (store.get("rowFeedback") or [])[-15:]:
        events.append({
            "at": fb.get("at"),
            "stockId": fb.get("stockId"),
            "decision": fb.get("decision", ""),
            "lesson": (fb.get("lesson") or "")[:80],
        })
    print(
        json.dumps(
            {
                "metrics": metrics,
                "ceoExemplarCount": model.get("ceoExemplarCount", len(exemplars)),
                "events": events[-10:],
            },
            ensure_ascii=False,
        )
    )


def cmd_server_status() -> None:
    ctx = qxb_pipeline.load_context()
    status: dict[str, dict[str, Any]] = {}
    for key, entry in (ctx.queue.get("rows") or {}).items():
        stock = f"QXB{int(key):04d}"
        st = entry.get("status") or "pending"
        if st in ("pending_review", "uploaded", "knowledge", "parked"):
            where = "server" if entry.get("submissionId") and st == "pending_review" else "local"
            review = "pending" if st in ("pending_review", "uploaded") else st
            status[stock] = {
                "where": where,
                "reviewStatus": review,
                "submissionId": entry.get("submissionId"),
                "stockId": stock,
            }
    print(json.dumps({"status": status}, ensure_ascii=False))


def _photo_ref(photo: dict[str, Any] | None) -> str:
    if not photo:
        return ""
    return str(photo.get("path") or photo.get("local") or "")


def _autofill_slots(
    slots_ui: dict[str, Any],
    photos: list[dict[str, Any]],
    suggestions: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Fill missing CEO slots from suggestions then remaining album photos."""
    filled = {k: v for k, v in (slots_ui or {}).items() if v}
    for key, photo in (suggestions or {}).items():
        if key in SLOT_KEYS and not filled.get(key) and photo:
            filled[key] = photo
    if not photos:
        return filled
    used = {_photo_ref(filled.get(k)) for k in SLOT_KEYS if filled.get(k)}
    used.discard("")
    for i, key in enumerate(SLOT_KEYS):
        if filled.get(key):
            continue
        unused = next((p for p in photos if _photo_ref(p) and _photo_ref(p) not in used), None)
        pick = unused or photos[i % len(photos)]
        filled[key] = pick
        ref = _photo_ref(pick)
        if ref:
            used.add(ref)
    return filled


def _slots_to_training(
    slots_ui: dict[str, Any],
) -> tuple[dict[str, list[int]], dict[str, str], list[dict[str, Any]]]:
    index_bands: dict[str, list[int]] = {}
    overrides: dict[str, str] = {}
    slot_results: list[dict[str, Any]] = []
    for key, label in SLOT_KEY_TO_LABEL.items():
        photo = slots_ui.get(key)
        if not photo:
            continue
        path = str(photo.get("path") or photo.get("local") or "")
        if path and not path.startswith("/"):
            path = str((ROOT / path).resolve())
        idx = int(photo.get("index") or photo_index_from_path(path) or 0)
        if idx <= 0:
            continue
        index_bands[label] = [idx]
        overrides[label] = path
        slot_results.append({
            "label": label,
            "path": path,
            "actual": key,
            "assigned_ok": True,
            "index": idx,
        })
    return index_bands, overrides, slot_results


def _tag_exemplar_decision(row: int, decision: str, note: str) -> None:
    store = load_learnings()
    for ex in store.get("trainingExemplars", []):
        if ex.get("row") == row:
            ex["decision"] = decision
            ex["authority"] = DECISION_AUTHORITY.get(decision, "human_confirmed")
            ex["note"] = note
            if decision == "confirm_and_upload":
                ex["confirmedUpload"] = True
            break
    for fb in reversed(store.get("rowFeedback", [])):
        if fb.get("row") == row:
            fb["decision"] = decision
            break
    save_learnings(store)


def _update_vin_csv(
    row: int,
    vin: str,
    model: str = "",
    *,
    engine_code: str = "",
    transmission_code: str = "",
    image_path: str = "",
    confidence: str = "ceo_review_ui",
) -> None:
    if not vin:
        return
    ctx = qxb_pipeline.load_context()
    existing = ctx.vins.get(row) or {}
    qxb_pipeline.write_vin_csv_row(
        VIN_CSV,
        row,
        model or existing.get("model") or "",
        vin.upper(),
        image_path or existing.get("image_path") or "",
        confidence,
        engine_code=engine_code or existing.get("engine_code") or "",
        transmission_code=transmission_code or existing.get("transmission_code") or "",
    )


def _load_upload_queue() -> dict[str, Any]:
    if not UPLOAD_QUEUE_FILE.is_file():
        return {"version": "1.0", "items": []}
    try:
        data = json.loads(UPLOAD_QUEUE_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"version": "1.0", "items": []}
    data.setdefault("items", [])
    return data


def _save_upload_queue(data: dict[str, Any]) -> None:
    UPLOAD_QUEUE_FILE.parent.mkdir(parents=True, exist_ok=True)
    UPLOAD_QUEUE_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _enqueue_review_upload(row: int, stock_id: str, note: str, decision: str) -> dict[str, Any]:
    queue = _load_upload_queue()
    for item in queue["items"]:
        if item.get("row") == row and item.get("status") in ("pending", "processing"):
            return {"queued": True, "already": True, "item": item}
    item = {
        "row": row,
        "stockId": stock_id,
        "note": note,
        "decision": decision,
        "status": "pending",
        "attempts": 0,
        "enqueuedAt": qxb_pipeline._iso_now(),
        "lastError": "",
    }
    queue["items"].append(item)
    _save_upload_queue(queue)
    return {"queued": True, "already": False, "item": item}


def _run_queued_upload(item: dict[str, Any]) -> dict[str, Any]:
    row = int(item["row"])
    ctx = qxb_pipeline.load_context()
    upload_result = qxb_pipeline.process_row(
        ctx,
        row,
        dry_run=False,
        upload_max_retries=BACKGROUND_UPLOAD_MAX_RETRIES,
        upload_retry_backoff=BACKGROUND_UPLOAD_BACKOFF_SEC,
    )
    if not upload_result.get("ok"):
        err = upload_result.get("error")
        if not err and upload_result.get("inspection"):
            blockers = upload_result["inspection"].get("blockers") or []
            err = "; ".join(blockers) if blockers else "process failed"
        return {
            "ok": False,
            "stage": "process",
            "error": err or "process failed",
            "upload": upload_result,
        }
    ctx = qxb_pipeline.load_context()
    submit_result = qxb_pipeline.submit_row_for_review(
        ctx,
        row,
        upload_max_retries=BACKGROUND_UPLOAD_MAX_RETRIES,
        upload_retry_backoff=BACKGROUND_UPLOAD_BACKOFF_SEC,
    )
    if not submit_result.get("ok"):
        return {
            "ok": False,
            "stage": "submit",
            "error": submit_result.get("error") or "submit failed",
            "submit": submit_result,
        }
    entry = qxb_pipeline._queue_row(ctx, row)  # noqa: SLF001
    entry["humanReviewDecision"] = item.get("decision") or "confirm_and_upload"
    entry["humanReviewNote"] = item.get("note") or ""
    qxb_pipeline.save_queue(ctx)
    return {"ok": True, "upload": upload_result, "submit": submit_result}


def cmd_process_upload_queue(batch_s: str) -> None:
    batch = max(1, int(batch_s or 1))
    queue = _load_upload_queue()
    processed = 0
    results: list[dict[str, Any]] = []
    for item in queue["items"]:
        if item.get("status") != "pending":
            continue
        if processed >= batch:
            break
        item["status"] = "processing"
        item["attempts"] = int(item.get("attempts") or 0) + 1
        item["lastAttemptAt"] = qxb_pipeline._iso_now()
        _save_upload_queue(queue)
        outcome = _run_queued_upload(item)
        if outcome.get("ok"):
            item["status"] = "done"
            item["completedAt"] = qxb_pipeline._iso_now()
            submit = outcome.get("submit") or {}
            item["submissionId"] = submit.get("submissionId")
        elif item["attempts"] >= 12:
            item["status"] = "failed"
            item["lastError"] = outcome.get("error") or "unknown"
        else:
            item["status"] = "pending"
            item["lastError"] = outcome.get("error") or "unknown"
        _save_upload_queue(queue)
        results.append({"row": item["row"], "stockId": item.get("stockId"), **outcome})
        processed += 1
    pending = sum(1 for i in queue["items"] if i.get("status") == "pending")
    print(
        json.dumps(
            {"ok": True, "processed": processed, "pending": pending, "results": results},
            ensure_ascii=False,
        )
    )


def cmd_upload_queue_status() -> None:
    queue = _load_upload_queue()
    items = queue.get("items") or []
    print(
        json.dumps(
            {
                "ok": True,
                "pending": sum(1 for i in items if i.get("status") == "pending"),
                "processing": sum(1 for i in items if i.get("status") == "processing"),
                "failed": sum(1 for i in items if i.get("status") == "failed"),
                "done": sum(1 for i in items if i.get("status") == "done"),
                "recent": items[-12:],
            },
            ensure_ascii=False,
        )
    )


def cmd_decide(body: dict[str, Any]) -> None:
    row = int(body["row"])
    decision = str(body.get("decision") or "")
    note = str(body.get("note") or "")
    slots_ui = body.get("slots") or {}
    edits = body.get("edits") or {}
    stock_id = str(body.get("stockId") or f"QXB{row:04d}")

    if decision not in DECISION_AUTHORITY:
        print(json.dumps({"ok": False, "error": f"unknown decision {decision}"}))
        return

    ctx = qxb_pipeline.load_context()
    photos = _photos_for_row(ctx, row)
    if not photos:
        print(json.dumps({"ok": False, "error": f"row {row} has no photo folder"}))
        return

    c = _candidate_from_row(ctx, row)
    if decision in ("confirm_and_upload", "save_training_only"):
        slots_ui = _autofill_slots(slots_ui, photos, c.get("suggestions"))

    lesson = f"CEO审核 {decision}"
    if note:
        lesson += f": {note}"
    if decision == "confirm_and_upload":
        lesson = f"CEO确认可上传 {stock_id}" + (f": {note}" if note else "")

    missing = [k for k in SLOT_KEYS if k not in slots_ui or not slots_ui.get(k)]
    if decision == "confirm_and_upload" and missing:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": "blocked_missing_slots",
                    "missing": [SLOT_LABELS_ZH[k] for k in missing],
                },
                ensure_ascii=False,
            )
        )
        return

    queue_info = None
    if decision == "confirm_and_upload":
        vin_check = str(edits.get("vin") or c.get("vin") or "").strip()
        server_state = None
        pwd = os.environ.get("ADMIN_PASSWORD", "")
        if pwd:
            try:
                server_state = qxb_pipeline._admin_fetch_state(ctx.paths.api_base, pwd)
            except Exception:
                server_state = None
        dup = qxb_pipeline.find_duplicate_vin(
            ctx,
            vin_check,
            exclude_row=row,
            server_state=server_state,
        )
        if dup:
            print(
                json.dumps(
                    {
                        "ok": False,
                        "error": "duplicate_vin",
                        "message": qxb_pipeline.format_duplicate_vin_message(dup),
                        "duplicate": dup,
                    },
                    ensure_ascii=False,
                )
            )
            return

    index_bands, overrides, slot_results = _slots_to_training(slots_ui)

    training_entry = None
    if index_bands:
        training_entry = record_row_photo_index_map(
            row,
            index_bands,
            lesson=lesson,
            stock_id=stock_id,
            resolved_overrides=overrides,
        )
        _tag_exemplar_decision(row, decision, note)

    record_photo_feedback(
        row,
        stock_id=stock_id,
        brand=str(edits.get("brand") or c.get("brand") or ""),
        model=str(edits.get("model") or c.get("model") or ""),
        slot_results=slot_results,
        lesson=lesson,
        source="ceo_review_ui",
    )
    store = load_learnings()
    if store.get("rowFeedback"):
        store["rowFeedback"][-1]["decision"] = decision
        save_learnings(store)

    upload_result = None
    submit_result = None

    vin = str(edits.get("vin") or c.get("vin") or "").strip().upper()
    engine = str(edits.get("engineCode") or c.get("engineCode") or "").strip().upper()
    trans = str(edits.get("transmissionCode") or c.get("transmissionCode") or "").strip().upper()
    vin_path = ""
    vin_slot = slots_ui.get("vin") or {}
    if isinstance(vin_slot, dict):
        vin_path = str(vin_slot.get("local") or vin_slot.get("path") or "")
    if not vin_path:
        vin_path = str((ctx.vins.get(row) or {}).get("image_path") or "")

    if decision in ("confirm_and_upload", "save_training_only") and (vin or engine or trans):
        _update_vin_csv(
            row,
            vin or str((ctx.vins.get(row) or {}).get("vin") or ""),
            c.get("model") or "",
            engine_code=engine,
            transmission_code=trans,
            image_path=vin_path,
            confidence="ceo_review_ui" if decision == "confirm_and_upload" else "ceo_nameplate",
        )

    if decision == "confirm_and_upload":
        queue_info = _enqueue_review_upload(row, stock_id, note, decision)

    elif decision == "skip_missing_photos":
        qxb_pipeline.park_row(
            ctx,
            row,
            category="album_incomplete" if missing else "photo_uncertain",
            note=note or lesson,
            tier="later",
        )
    elif decision == "not_same_vehicle":
        qxb_pipeline.park_row(
            ctx,
            row,
            category="photo_uncertain",
            note=note or "不是同一台车",
            tier="later",
        )

    print(
        json.dumps(
            {
                "ok": True,
                "row": row,
                "stockId": stock_id,
                "decision": decision,
                "training": training_entry,
                "upload": upload_result,
                "submit": submit_result,
                "queued": bool(queue_info and queue_info.get("queued")),
                "queue": queue_info,
                "memory": _safe_memory_snapshot(),
            },
            ensure_ascii=False,
        )
    )


def _memory_snapshot() -> dict[str, Any]:
    import io
    from contextlib import redirect_stdout

    buf = io.StringIO()
    with redirect_stdout(buf):
        cmd_memory()
    return json.loads(buf.getvalue())


def _safe_memory_snapshot() -> dict[str, Any]:
    try:
        return _memory_snapshot()
    except Exception:
        return {"metrics": {}, "events": []}


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "usage: qxb_review_api.py <cmd> ..."}))
        return 1
    cmd = sys.argv[1]
    try:
        if cmd == "unuploaded":
            cmd_unuploaded(
                sys.argv[2] if len(sys.argv) > 2 else "0",
                sys.argv[3] if len(sys.argv) > 3 else "10",
                sys.argv[4] if len(sys.argv) > 4 else "",
                sys.argv[5] if len(sys.argv) > 5 else "all",
            )
        elif cmd == "memory":
            cmd_memory()
        elif cmd == "server-status":
            cmd_server_status()
        elif cmd == "decide":
            body = json.loads(sys.stdin.read() or "{}")
            cmd_decide(body)
        elif cmd == "process-upload-queue":
            cmd_process_upload_queue(sys.argv[2] if len(sys.argv) > 2 else "1")
        elif cmd == "upload-queue":
            cmd_upload_queue_status()
        else:
            print(json.dumps({"ok": False, "error": f"unknown command {cmd}"}))
            return 1
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

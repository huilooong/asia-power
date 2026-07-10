"""WeCom group photo inbox → 子龙 QXB pipeline (one-to-many MVP).

Per-group sessions accumulate images; an upload command commits them to a QXB row,
updates manifest.csv, runs inspect, and queues CEO review (no auto-publish).
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from inventory_core.apinventory_handler import parse_qxb_row
from inventory_core import qxb_pipeline

ROOT = Path(__file__).resolve().parents[1]
SESSIONS_PATH = ROOT / "data/wecom/group-sessions.json"
SUPPLIERS_PATH = ROOT / "config/wecom-group-suppliers.json"
GROUP_LEARNINGS_PATH = ROOT / "data/knowledge-base/wecom-group-learnings.json"
PHOTO_ROOT = ROOT / "data/qxb-photos"
MANIFEST_FIELDS = [
    "row", "brand", "model", "description", "image_index", "image_count",
    "url", "local_path", "status", "bytes", "error",
]
_UPLOAD_CMD_RE = re.compile(r"上传|upload|提交", re.I)
_SESSION_TTL_SEC = 86400 * 7


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


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


def load_supplier_map() -> dict[str, dict[str, str]]:
    """chat_id → {supplier_id, supplier_name, supplier_wechat, notes}."""
    raw = _load_json(SUPPLIERS_PATH, {})
    groups = raw.get("groups") or {}
    return {str(k): dict(v) for k, v in groups.items()}


def supplier_for_chat(chat_id: str) -> dict[str, str]:
    return load_supplier_map().get(chat_id, {})


def _load_sessions() -> dict[str, Any]:
    return _load_json(SESSIONS_PATH, {"version": "1.0", "sessions": {}})


def _save_sessions(store: dict[str, Any]) -> None:
    _save_json_atomic(SESSIONS_PATH, store)


def _session_key(chat_id: str, user_id: str = "") -> str:
    return chat_id or user_id or "unknown"


def get_session(chat_id: str, *, user_id: str = "") -> dict[str, Any]:
    store = _load_sessions()
    key = _session_key(chat_id, user_id)
    sess = store.setdefault("sessions", {}).get(key)
    if not sess:
        supplier = supplier_for_chat(chat_id)
        sess = {
            "chatId": chat_id,
            "supplierId": supplier.get("supplier_id", ""),
            "supplierName": supplier.get("supplier_name", ""),
            "pendingImages": [],
            "batches": [],
            "updatedAt": _iso_now(),
        }
        store["sessions"][key] = sess
        _save_sessions(store)
    return sess


def _update_session(chat_id: str, *, user_id: str = "", mutate: Any = None) -> dict[str, Any]:
    store = _load_sessions()
    key = _session_key(chat_id, user_id)
    sess = store.setdefault("sessions", {}).setdefault(key, {
        "chatId": chat_id,
        "supplierId": supplier_for_chat(chat_id).get("supplier_id", ""),
        "supplierName": supplier_for_chat(chat_id).get("supplier_name", ""),
        "pendingImages": [],
        "batches": [],
        "updatedAt": _iso_now(),
    })
    if mutate:
        mutate(sess)
    sess["updatedAt"] = _iso_now()
    _save_sessions(store)
    return sess


def session_status_text(chat_id: str, *, user_id: str = "") -> str:
    sess = get_session(chat_id, user_id=user_id)
    pending = sess.get("pendingImages") or []
    supplier = sess.get("supplierName") or sess.get("supplierId") or "未配置供应商"
    if not pending:
        return (
            f"子龙 · 群相册状态\n"
            f"供应商：{supplier}\n"
            f"待处理照片：0 张\n"
            f"用法：先发车辆照片，再 @AsiaPower 库存 Agent 说「子龙032 上传」"
        )
    return (
        f"子龙 · 群相册状态\n"
        f"供应商：{supplier}\n"
        f"待处理照片：{len(pending)} 张\n"
        f"发「子龙{pending[0].get('suggestedRow', 'XXX')} 上传」或指定行号开始处理"
    )


def is_wecom_upload_command(text: str) -> bool:
    """True when message is an upload instruction for 子龙."""
    body = (text or "").strip()
    if not body or not _UPLOAD_CMD_RE.search(body):
        return False
    if parse_qxb_row(body) is not None:
        return True
    lower = body.lower()
    if any(k in lower for k in ("子龙", "qxb", "汽修宝", "库存", "hc25")):
        return True
    if re.search(r"\b[A-HJ-NPR-Z0-9]{17}\b", body, re.I):
        return True
    return False


def is_session_status_command(text: str) -> bool:
    lower = (text or "").strip().lower()
    return lower in ("相册状态", "待上传", "子龙状态", "/qxb status", "上传状态")


def _safe_part(value: str, max_len: int = 80) -> str:
    value = re.sub(r"[\\/:*?\"<>|]+", "-", (value or "").strip())
    value = re.sub(r"\s+", " ", value)
    return value[:max_len].strip(" .") or "unknown"


def _folder_for_row(row: int, ctx: qxb_pipeline.PipelineContext) -> Path | None:
    prefix = f"row-{row:04d}_"
    if PHOTO_ROOT.is_dir():
        for entry in PHOTO_ROOT.iterdir():
            if entry.is_dir() and entry.name.startswith(prefix):
                return entry
    source = next((s for s in ctx.sources if s["row"] == row), None)
    if not source:
        return None
    folder_name = (
        f"row-{row:04d}_{_safe_part(source['brand_cn'])}_"
        f"{_safe_part(source['trim'])}"
    )
    folder = PHOTO_ROOT / folder_name
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def _next_image_index(row: int, manifest_path: Path) -> int:
    max_idx = 0
    if manifest_path.is_file():
        with manifest_path.open(encoding="utf-8") as fh:
            for rec in csv.DictReader(fh):
                if int(rec.get("row") or 0) == row:
                    max_idx = max(max_idx, int(rec.get("image_index") or 0))
    if PHOTO_ROOT.is_dir():
        folder = None
        prefix = f"row-{row:04d}_"
        for entry in PHOTO_ROOT.iterdir():
            if entry.is_dir() and entry.name.startswith(prefix):
                folder = entry
                break
        if folder:
            for f in folder.iterdir():
                m = re.match(r"^(\d+)_", f.name)
                if m:
                    max_idx = max(max_idx, int(m.group(1)))
    return max_idx + 1


def _append_manifest_rows(manifest_path: Path, rows: list[dict[str, Any]]) -> None:
    existing: list[dict[str, str]] = []
    if manifest_path.is_file():
        with manifest_path.open(encoding="utf-8") as fh:
            existing = list(csv.DictReader(fh))
    existing.extend({k: str(v) for k, v in r.items()} for r in rows)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    with manifest_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=MANIFEST_FIELDS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(existing)


def _record_group_learning(
    chat_id: str,
    *,
    row: int,
    photo_count: int,
    supplier: dict[str, str],
    inspect: dict[str, Any],
) -> None:
    store = _load_json(GROUP_LEARNINGS_PATH, {"version": "1.0", "groups": {}})
    groups = store.setdefault("groups", {})
    grp = groups.setdefault(chat_id, {
        "supplierId": supplier.get("supplier_id", ""),
        "supplierName": supplier.get("supplier_name", ""),
        "uploads": [],
        "totalPhotos": 0,
    })
    grp["totalPhotos"] = int(grp.get("totalPhotos") or 0) + photo_count
    grp.setdefault("uploads", []).append({
        "row": row,
        "stockId": f"QXB{row:04d}",
        "photoCount": photo_count,
        "ready": bool(inspect.get("ready")),
        "blockers": inspect.get("blockers") or [],
        "at": _iso_now(),
    })
    grp["uploads"] = grp["uploads"][-50:]
    _save_json_atomic(GROUP_LEARNINGS_PATH, store)


def ingest_group_image(
    *,
    chat_id: str,
    user_id: str,
    media_id: str,
    image_bytes: bytes,
    cfg: Any = None,
) -> str:
    """Save downloaded image into group session; return reply text."""
    if not image_bytes:
        return "子龙：图片下载失败，请重发。"

    digest = hashlib.sha256(image_bytes).hexdigest()[:12]
    inbox = ROOT / "data/wecom/inbox" / (chat_id or user_id or "direct")
    inbox.mkdir(parents=True, exist_ok=True)
    filename = f"{int(time.time())}_{digest}.jpg"
    dest = inbox / filename
    dest.write_bytes(image_bytes)

    def mutate(sess: dict[str, Any]) -> None:
        pending = sess.setdefault("pendingImages", [])
        pending.append({
            "mediaId": media_id,
            "localPath": str(dest.relative_to(ROOT)),
            "bytes": len(image_bytes),
            "fromUser": user_id,
            "receivedAt": _iso_now(),
        })
        if len(pending) > 30:
            sess["pendingImages"] = pending[-30:]

    sess = _update_session(chat_id, user_id=user_id, mutate=mutate)
    count = len(sess.get("pendingImages") or [])
    supplier = sess.get("supplierName") or "供应商群"
    return (
        f"子龙已收到第 {count} 张图（{supplier}）\n"
        f"继续发图，或 @AsiaPower 库存 Agent 说「子龙032 上传」开始处理\n"
        f"（不会自动发布，CEO 审核后上线）"
    )


def process_wecom_upload_command(
    text: str,
    *,
    chat_id: str,
    user_id: str,
    cfg: Any = None,
) -> str:
    """Commit pending group photos to QXB row, inspect, queue CEO review."""
    sess = get_session(chat_id, user_id=user_id)
    pending = list(sess.get("pendingImages") or [])
    if not pending:
        return (
            "子龙：当前没有待处理照片。\n"
            "请先在群里发车辆照片，再说「子龙032 上传」。"
        )

    row = parse_qxb_row(text)
    ctx = qxb_pipeline.load_context()
    if row is None:
        row = _suggest_next_row(ctx, chat_id)
        if row is None:
            return (
                "子龙：请指定行号，例如「子龙032 上传」。\n"
                f"当前待处理 {len(pending)} 张照片。"
            )

    source = next((s for s in ctx.sources if s["row"] == row), None)
    if not source:
        return f"子龙：Excel 里没有第 {row} 行，请核对汽修宝导出行号。"

    folder = _folder_for_row(row, ctx)
    if not folder:
        return f"子龙：无法创建 row-{row:04d} 相册目录。"

    start_idx = _next_image_index(row, ctx.paths.manifest)
    manifest_rows: list[dict[str, Any]] = []
    saved_paths: list[Path] = []

    for offset, item in enumerate(pending):
        src = ROOT / item["localPath"]
        if not src.is_file():
            continue
        idx = start_idx + offset
        dest_name = f"{idx:02d}_wecom_{hashlib.sha256(src.read_bytes()).hexdigest()[:8]}.jpg"
        dest = folder / dest_name
        shutil.copy2(src, dest)
        saved_paths.append(dest)
        manifest_rows.append({
            "row": row,
            "brand": source["brand_cn"],
            "model": source["trim"],
            "description": source.get("description") or source["trim"],
            "image_index": idx,
            "image_count": len(pending),
            "url": f"wecom://{item.get('mediaId', '')}",
            "local_path": str(dest.relative_to(ROOT)),
            "status": "exists",
            "bytes": dest.stat().st_size,
            "error": "",
        })

    if not saved_paths:
        return "子龙：待处理照片文件丢失，请重新发图。"

    _append_manifest_rows(ctx.paths.manifest, manifest_rows)

    ctx = qxb_pipeline.load_context()
    inspect = qxb_pipeline.inspect_row(ctx, row)
    supplier = supplier_for_chat(chat_id)

    def clear_pending(sess: dict[str, Any]) -> None:
        sess.setdefault("batches", []).append({
            "row": row,
            "stockId": f"QXB{row:04d}",
            "photoCount": len(saved_paths),
            "at": _iso_now(),
        })
        sess["pendingImages"] = []
        sess["batches"] = sess["batches"][-20:]

    _update_session(chat_id, user_id=user_id, mutate=clear_pending)
    _record_group_learning(
        chat_id,
        row=row,
        photo_count=len(saved_paths),
        supplier=supplier,
        inspect=inspect,
    )

    brand = source["brand_cn"]
    trim = source["trim"][:40]
    blockers = inspect.get("blockers") or []
    ready = inspect.get("ready")
    vin = (inspect.get("fields") or {}).get("vin") or "待 OCR"
    engine = (inspect.get("fields") or {}).get("engineCode") or "待识别"

    lines = [
        f"子龙 · 上传准备完成 QXB{row:04d}",
        f"车型：{brand} {trim}",
        f"照片：{len(saved_paths)} 张已写入相册",
        f"VIN：{vin}",
        f"发动机：{engine}",
    ]
    if supplier.get("supplier_name"):
        lines.append(f"供应商：{supplier['supplier_name']}")
    if ready:
        lines.append("状态：✅ 检查通过，等待 CEO 审核")
        lines.append("CEO 请打开 http://127.0.0.1:8789/review 确认后上传")
    else:
        lines.append("状态：⚠️ 尚有阻塞项")
        for b in blockers[:5]:
            lines.append(f"  · {b}")
        lines.append("CEO 可在审核页修正 VIN/选图后再确认上传")
    lines.append("（不会自动发布到官网，需 CEO 批准）")
    return "\n".join(lines)


def _suggest_next_row(ctx: qxb_pipeline.PipelineContext, chat_id: str) -> int | None:
    """Pick first row with photos but not yet uploaded — per-group hint only."""
    grp = _load_json(GROUP_LEARNINGS_PATH, {}).get("groups", {}).get(chat_id, {})
    recent_rows = [u.get("row") for u in (grp.get("uploads") or []) if u.get("row")]
    if recent_rows:
        return int(recent_rows[-1])
    for source in ctx.sources[:50]:
        row = source["row"]
        photos = ctx.manifest.get(row) or []
        if photos:
            audit = qxb_pipeline.audit_row(ctx, row)
            if audit.get("stage") not in ("live", "pending_review", "uploaded"):
                return row
    return None


def handle_group_image_message(
    msg: dict[str, Any],
    *,
    cfg: Any,
    download_media: Any = None,
) -> str:
    """Download WeCom image and add to group session."""
    from integrations.wecom_access import extract_chat_id, extract_user_id

    chat_id = extract_chat_id(msg)
    user_id = extract_user_id(msg)
    media_id = str(msg.get("MediaId") or msg.get("mediaid") or "").strip()
    if not media_id:
        return "子龙：图片缺少 MediaId，无法保存。"

    if download_media is None:
        from integrations.wecom_client import download_media as _dl
        download_media = _dl

    try:
        image_bytes = download_media(media_id, cfg=cfg)
    except Exception as exc:
        return f"子龙：图片下载失败（{exc}）"

    return ingest_group_image(
        chat_id=chat_id,
        user_id=user_id,
        media_id=media_id,
        image_bytes=image_bytes,
        cfg=cfg,
    )

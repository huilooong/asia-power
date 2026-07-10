"""Social autopilot — publish approved queue + scan replies."""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from customer_gateway.social_session import api_ready, is_logged_in

ROOT = Path(__file__).resolve().parent.parent
PROGRESS_FILE = ROOT / "memory" / "customer_gateway" / "apsales_distribution_progress.json"
REGISTRY_FILE = ROOT / "memory" / "customer_gateway" / "social_posts_registry.json"
QUEUE_FILE = ROOT / "memory" / "customer_gateway" / "apsales_pending_publish_queue.json"
REPLY_INBOX_FILE = ROOT / "memory" / "customer_gateway" / "social_reply_inbox.json"

PUBLISH_STATUSES = frozenset({
    "approved_pending_publish",
    "blocked_no_account",  # retry when session becomes available
})


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _load_json(path: Path, default: object) -> object:
    if not path.is_file():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return default


def _save_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def _normalize_platform(platform: str) -> str:
    key = (platform or "").strip().lower()
    return "x" if key == "twitter" else key


def load_pending_queue() -> list[dict[str, Any]]:
    """Merge dedicated queue + registry/progress posts awaiting publish."""
    items: list[dict[str, Any]] = []
    seen: set[str] = set()

    queue = _load_json(QUEUE_FILE, [])
    if isinstance(queue, list):
        for row in queue:
            if isinstance(row, dict) and row.get("status", "approved_pending_publish") in PUBLISH_STATUSES:
                pid = row.get("post_id") or row.get("queue_id") or ""
                if pid and pid not in seen:
                    seen.add(pid)
                    items.append(row)

    registry = _load_json(REGISTRY_FILE, [])
    if isinstance(registry, list):
        for row in registry:
            if not isinstance(row, dict):
                continue
            status = (row.get("status") or "").lower()
            if status not in PUBLISH_STATUSES:
                continue
            pid = row.get("post_id") or ""
            if pid and pid in seen:
                continue
            if pid:
                seen.add(pid)
            items.append(row)

    progress = _load_json(PROGRESS_FILE, {})
    if isinstance(progress, dict):
        for wave in progress.get("waves") or []:
            if not isinstance(wave, dict):
                continue
            wave_id = wave.get("wave_id") or ""
            for post in wave.get("posts_published") or []:
                if not isinstance(post, dict):
                    continue
                status = (post.get("status") or "").lower()
                if status not in PUBLISH_STATUSES:
                    continue
                pid = post.get("post_id") or ""
                if pid and pid in seen:
                    continue
                if pid:
                    seen.add(pid)
                merged = {**post, "wave_id": wave_id or post.get("wave_id", "")}
                items.append(merged)

    return items


def _platform_ready(platform: str) -> bool:
    return is_logged_in(platform)


def _publish_one(item: dict[str, Any]) -> dict[str, Any]:
    platform = _normalize_platform(item.get("platform", ""))
    if platform not in ("facebook", "instagram", "x"):
        return {"ok": False, "error": f"unsupported platform {platform}", "item": item}

    if not _platform_ready(platform):
        return {"ok": False, "error": "session_not_ready", "platform": platform, "item": item}

    from customer_gateway.social_post_assets import resolve_post_assets

    resolved = resolve_post_assets(item, platform)
    message = resolved["caption"]
    link = resolved["listing_url"]
    images = resolved["image_urls"]

    try:
        if api_ready(platform):
            from customer_gateway.social_api import post_via_api
            result = post_via_api(platform, message=message, link=link, image_urls=images)
        else:
            from integrations.social_browser.platform_adapter import post_via_browser
            result = post_via_browser(platform, message=message, link=link, image_urls=images)
    except Exception as exc:
        return {"ok": False, "error": str(exc), "platform": platform, "item": item}

    post_url = (result.get("post_url") or "").strip()
    if not result.get("ok"):
        err = result.get("error", "")
        if err in ("composer_not_found", "image_attach_failed"):
            try:
                from customer_gateway.social_session import mark_disconnected
                mark_disconnected(platform, reason=err)
            except Exception:
                pass
        return {"ok": False, "error": err or "publish_failed", "platform": platform, "raw": result, "item": item}
    if not post_url:
        return {"ok": False, "error": "no_post_url_captured", "platform": platform, "raw": result, "item": item}
    return {"ok": True, "platform": platform, "post_url": post_url, "method": result.get("method", "api"), "item": item}


def _mark_published(item: dict[str, Any], post_url: str) -> None:
    """Update existing pending/blocked record in place — avoid duplicate wave entries."""
    from customer_gateway.distribution_progress import (
        _append_timeline,
        load_progress,
        notify_ceo_action,
        save_progress,
    )

    post_id = item.get("post_id")
    wave_id = item.get("wave_id") or ""
    now = _now()

    progress = load_progress()
    updated = False
    for wave in progress.get("waves") or []:
        if not isinstance(wave, dict):
            continue
        if wave_id and wave.get("wave_id") != wave_id:
            continue
        for post in wave.get("posts_published") or []:
            if not isinstance(post, dict):
                continue
            if post_id and post.get("post_id") != post_id:
                continue
            if not post_id and post.get("platform") == item.get("platform") and post.get("scheme_id") == item.get("scheme_id"):
                pass
            elif post_id and post.get("post_id") == post_id:
                pass
            else:
                continue
            post["status"] = "live"
            post["post_url"] = post_url
            post["posted_at"] = now
            post["last_scan_at"] = now
            updated = True
            break

    registry = _load_json(REGISTRY_FILE, [])
    if isinstance(registry, list):
        for rec in registry:
            if not isinstance(rec, dict):
                continue
            if post_id and rec.get("post_id") != post_id:
                continue
            rec["status"] = "live"
            rec["post_url"] = post_url
            rec["posted_at"] = now
            rec["last_scan_at"] = now
            updated = True
        _save_json(REGISTRY_FILE, registry)

    queue = _load_json(QUEUE_FILE, [])
    if isinstance(queue, list):
        for rec in queue:
            if isinstance(rec, dict) and rec.get("post_id") == post_id:
                rec["status"] = "published"
                rec["post_url"] = post_url
                rec["published_at"] = now
        _save_json(QUEUE_FILE, queue)

    progress["last_verified_action_at"] = now
    _append_timeline(
        progress,
        action="post_published",
        summary=f"自动发布 · {item.get('platform', '?')} · 方案{item.get('scheme_id', '?')}",
        wave_id=wave_id,
        details={**item, "post_url": post_url, "posted_at": now, "status": "live"},
    )
    save_progress(progress)

    notify_ceo_action(
        "post_published",
        fields={
            **item,
            "post_url": post_url,
            "market": item.get("market") or item.get("language_market", ""),
        },
        wave_id=wave_id,
    )


def process_publish_queue(*, max_posts: int | None = None) -> dict[str, Any]:
    if os.getenv("APSALES_SOCIAL_AUTOPILOT", "1").strip() == "0":
        return {"skipped": True, "reason": "APSALES_SOCIAL_AUTOPILOT=0"}

    limit = max_posts
    if limit is None:
        limit = int(os.getenv("APSALES_SOCIAL_MAX_POSTS_PER_RUN", "3"))

    pending = load_pending_queue()
    results: list[dict[str, Any]] = []
    published = 0

    for item in pending:
        if published >= limit:
            break
        platform = _normalize_platform(item.get("platform", ""))
        if platform == "instagram" and os.getenv("APSALES_SOCIAL_SKIP_INSTAGRAM", "1").strip() == "1":
            results.append({"ok": False, "skipped": True, "reason": "instagram_paused_today", "platform": platform})
            continue
        if not _platform_ready(platform):
            results.append({"ok": False, "skipped": True, "reason": "needs_login", "platform": platform})
            continue
        outcome = _publish_one(item)
        results.append(outcome)
        if outcome.get("ok"):
            _mark_published(item, outcome["post_url"])
            published += 1
        else:
            _notify_failure(outcome)

    return {
        "ran_at": _now(),
        "pending_count": len(pending),
        "published": published,
        "results": results,
    }


def _notify_failure(outcome: dict[str, Any]) -> None:
    if outcome.get("skipped"):
        return
    try:
        from customer_gateway.distribution_progress import _send_telegram
        platform = outcome.get("platform") or outcome.get("item", {}).get("platform", "?")
        err = outcome.get("error", "unknown")
        _send_telegram(
            f"❌ 子敬 · 社媒自动发帖失败\n平台: {platform}\n原因: {err}\n看板: https://asia-power.com/admin/apsales-progress.html"
        )
    except Exception:
        pass


def promote_blocked_when_sessions_ready() -> int:
    """When login exists, move blocked CEO-approved posts to approved_pending_publish."""
    from customer_gateway.distribution_progress import load_progress, save_progress

    changed = 0
    progress = load_progress()
    for wave in progress.get("waves") or []:
        if not isinstance(wave, dict):
            continue
        for post in wave.get("posts_published") or []:
            if not isinstance(post, dict):
                continue
            if post.get("status") != "blocked_no_account":
                continue
            if not post.get("ceo_approved_at") and not post.get("test_batch"):
                continue
            platform = _normalize_platform(post.get("platform", ""))
            if _platform_ready(platform):
                post["status"] = "approved_pending_publish"
                changed += 1

    registry = _load_json(REGISTRY_FILE, [])
    if isinstance(registry, list):
        for rec in registry:
            if not isinstance(rec, dict):
                continue
            if rec.get("status") != "blocked_no_account":
                continue
            if not rec.get("ceo_approved_at") and not rec.get("test_batch"):
                continue
            platform = _normalize_platform(rec.get("platform", ""))
            if _platform_ready(platform):
                rec["status"] = "approved_pending_publish"
                changed += 1
        if changed:
            _save_json(REGISTRY_FILE, registry)

    if changed:
        save_progress(progress)
    return changed


def enqueue_post(item: dict[str, Any]) -> dict[str, Any]:
    queue = _load_json(QUEUE_FILE, [])
    if not isinstance(queue, list):
        queue = []
    record = {
        "queue_id": item.get("queue_id") or f"q-{uuid.uuid4().hex[:10]}",
        "post_id": item.get("post_id") or f"post-{uuid.uuid4().hex[:8]}",
        "status": "approved_pending_publish",
        "queued_at": _now(),
        **item,
    }
    queue.append(record)
    _save_json(QUEUE_FILE, queue)
    return record


def scan_replies_for_live_posts(*, max_posts: int = 10) -> dict[str, Any]:
    """Browser/API scan → social_reply_inbox.json for hourly reply watch."""
    registry = _load_json(REGISTRY_FILE, [])
    if not isinstance(registry, list):
        registry = []

    inbox = _load_json(REPLY_INBOX_FILE, [])
    if not isinstance(inbox, list):
        inbox = []

    existing_keys = {
        f"{r.get('platform')}:{r.get('customer_handle')}:{r.get('snippet', '')[:60]}"
        for r in inbox if isinstance(r, dict)
    }

    new_replies: list[dict[str, Any]] = []
    scanned = 0

    for post in registry:
        if scanned >= max_posts:
            break
        if post.get("status") not in ("live", "posted", "active"):
            continue
        platform = _normalize_platform(post.get("platform", ""))
        post_url = (post.get("post_url") or "").strip()
        if not post_url or not _platform_ready(platform):
            continue
        if api_ready(platform):
            continue  # API comment fetch needs separate permissions — browser for now

        try:
            from integrations.social_browser.platform_adapter import scan_post_comments_browser
            rows = scan_post_comments_browser(platform, post_url)
        except Exception:
            continue

        scanned += 1
        post["last_scan_at"] = _now()
        for row in rows:
            key = f"{row.get('platform')}:{row.get('customer_handle')}:{row.get('snippet', '')[:60]}"
            if key in existing_keys:
                continue
            existing_keys.add(key)
            entry = {
                "reply_id": f"rep-{uuid.uuid4().hex[:10]}",
                "status": "pending_draft",
                "language": post.get("language_market", "en")[:2].lower() if post.get("language_market") else "en",
                "scheme_id": post.get("scheme_id", ""),
                "listing_url": post.get("listing_url", "https://asia-power.com/half-cuts/"),
                "found_at": _now(),
                **row,
            }
            inbox.append(entry)
            new_replies.append(entry)

    if scanned:
        _save_json(REGISTRY_FILE, registry)
    if new_replies:
        _save_json(REPLY_INBOX_FILE, inbox)
        try:
            from customer_gateway.distribution_progress import record_event
            for row in new_replies:
                record_event(
                    "reply_found",
                    notify=False,
                    platform=row.get("platform"),
                    customer_handle=row.get("customer_handle"),
                    snippet=row.get("snippet"),
                )
        except Exception:
            pass

    return {"scanned": scanned, "new_replies": len(new_replies), "replies": new_replies}


def run_autopilot(*, publish: bool = True, scan_replies: bool = True) -> dict[str, Any]:
    promote_blocked_when_sessions_ready()
    out: dict[str, Any] = {"ran_at": _now()}
    if publish:
        out["publish"] = process_publish_queue()
    if scan_replies and os.getenv("APSALES_SOCIAL_BROWSER_SCAN", "1").strip() == "1":
        out["reply_scan"] = scan_replies_for_live_posts()
    return out

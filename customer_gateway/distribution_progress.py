"""子敬 · 分销推广进度追踪 + CEO Telegram 反馈."""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
PROGRESS_FILE = ROOT / "memory" / "customer_gateway" / "apsales_distribution_progress.json"
REGISTRY_FILE = ROOT / "memory" / "customer_gateway" / "social_posts_registry.json"
STALE_HOURS = float(os.getenv("APSALES_PROGRESS_STALE_HOURS", "24"))
MAX_POST_CONTENT = 2000

SOCIAL_BLOCKED_STATUSES = frozenset({
    "blocked_no_account",
    "pending_ceo_manual",
    "approved_pending_publish",
})

ACTION_LABELS = {
    "group_join": "加入小组",
    "post_published": "发布帖文",
    "post_pending": "社媒受阻（无账号）",
    "post_blocked": "社媒受阻（无账号）",
    "reply_found": "客户回复",
    "followup_drafted": "跟进草稿",
    "scan_done": "回复扫描",
    "email_received": "收到邮件",
    "email_sent": "邮件已发送",
    "engagement_planned": "互动计划",
    "engagement_post": "互动发帖",
    "engagement_comment": "互动评论",
    "engagement_follow": "互动关注",
    "engagement_reply": "互动回复",
}

PLATFORM_LABELS = {
    "facebook": "Facebook",
    "instagram": "Instagram",
    "x": "X",
    "twitter": "X",
    "whatsapp": "WhatsApp",
}

DEFAULT_WAVES: list[dict[str, Any]] = [
    {
        "wave_id": "wave1-en-gh-ng",
        "label": "第1波 · EN · Ghana/Nigeria",
        "language": "EN",
        "markets": ["Ghana", "Nigeria"],
        "schemes": ["A", "B"],
        "targets": {"groups_joined": 4, "posts_published": 2},
    },
    {
        "wave_id": "wave1-en-ke-tz-ug",
        "label": "第1波 · EN · Kenya/TZ/Uganda",
        "language": "EN",
        "markets": ["Kenya", "Tanzania", "Uganda"],
        "schemes": ["A", "D"],
        "targets": {"groups_joined": 4, "posts_published": 2},
    },
    {
        "wave_id": "wave2-fr-ci-sn-cm",
        "label": "第2波 · FR · CI/Senegal/Cameroon",
        "language": "FR",
        "markets": ["Côte d'Ivoire", "Senegal", "Cameroon"],
        "schemes": ["A", "D"],
        "targets": {"groups_joined": 3, "posts_published": 2},
    },
    {
        "wave_id": "wave2-en-za-zm",
        "label": "第2波 · EN · South Africa/Zambia",
        "language": "EN",
        "markets": ["South Africa", "Zambia"],
        "schemes": ["A", "E"],
        "targets": {"groups_joined": 3, "posts_published": 2},
    },
    {
        "wave_id": "wave3-fr-drc-ml-bf",
        "label": "第3波 · FR · DRC/Mali/Burkina",
        "language": "FR",
        "markets": ["DRC", "Mali", "Burkina Faso"],
        "schemes": ["A", "C"],
        "targets": {"groups_joined": 2, "posts_published": 1},
    },
    {
        "wave_id": "wave3-pt-ao-mz",
        "label": "第3波 · PT · Angola/Mozambique",
        "language": "PT",
        "markets": ["Angola", "Mozambique"],
        "schemes": ["A", "B"],
        "targets": {"groups_joined": 3, "posts_published": 2},
    },
]

VERIFIED_ACTIONS = frozenset({
    "group_join",
    "post_published",
    "post_pending",
    "post_blocked",
    "scan_done",
    "reply_found",
    "followup_drafted",
    "email_received",
    "email_sent",
    "engagement_planned",
    "engagement_post",
    "engagement_comment",
    "engagement_follow",
    "engagement_reply",
})

ENGAGEMENT_ACTIONS = frozenset({
    "engagement_planned",
    "engagement_post",
    "engagement_comment",
    "engagement_follow",
    "engagement_reply",
})


def _is_social_blocked_status(status: str) -> bool:
    return (status or "").strip().lower() in SOCIAL_BLOCKED_STATUSES


def _platform_session_ready(platform: str) -> bool:
    try:
        from customer_gateway.social_session import is_logged_in
        return is_logged_in(platform)
    except Exception:
        return False


def migrate_social_posts_to_blocked(*, wave_id: str = "") -> int:
    """Honest dashboard: FB/IG/X without login → blocked_no_account; with login → pending publish."""
    progress = load_progress()
    changed = 0
    waves = progress.get("waves") or []
    for wave in waves:
        if not isinstance(wave, dict):
            continue
        if wave_id and wave.get("wave_id") != wave_id:
            continue
        posts = wave.get("posts_published") or []
        for post in posts:
            if not isinstance(post, dict):
                continue
            platform = (post.get("platform") or "").lower()
            if platform not in ("facebook", "instagram", "x", "twitter"):
                continue
            if post.get("status") == "live":
                continue
            ready = _platform_session_ready(platform)
            if ready and (post.get("ceo_approved_at") or post.get("test_batch")):
                if post.get("status") != "approved_pending_publish":
                    post["status"] = "approved_pending_publish"
                    post.pop("block_reason", None)
                    changed += 1
                continue
            if _is_social_blocked_status(post.get("status", "")):
                if post.get("status") != "blocked_no_account":
                    post["status"] = "blocked_no_account"
                    post["block_reason"] = post.get("block_reason") or "无人持有 FB/IG/X 登录权限"
                    changed += 1
    registry = _load_json(REGISTRY_FILE, [])
    if isinstance(registry, list):
        for rec in registry:
            if not isinstance(rec, dict):
                continue
            platform = (rec.get("platform") or "").lower()
            if platform not in ("facebook", "instagram", "x", "twitter"):
                continue
            if rec.get("status") == "live":
                continue
            ready = _platform_session_ready(platform)
            if ready and (rec.get("ceo_approved_at") or rec.get("test_batch")):
                if rec.get("status") != "approved_pending_publish":
                    rec["status"] = "approved_pending_publish"
                    rec.pop("block_reason", None)
                    changed += 1
                continue
            if _is_social_blocked_status(rec.get("status", "")):
                if rec.get("status") != "blocked_no_account":
                    rec["status"] = "blocked_no_account"
                    rec["block_reason"] = rec.get("block_reason") or "无人持有 FB/IG/X 登录权限"
                    changed += 1
        if changed:
            _save_json(REGISTRY_FILE, registry)
    if changed:
        save_progress(progress)
    return changed


def get_social_session_status() -> dict[str, Any]:
    try:
        from customer_gateway.social_session import get_all_session_status
        return get_all_session_status()
    except Exception:
        return {"platforms": {}, "any_ready": False}


def get_executable_channels() -> dict[str, Any]:
    """Channels we can actually use today — honest status for CEO dashboard."""
    try:
        from customer_gateway.email_outbound import send_enabled
        email_ready = send_enabled()
    except Exception:
        email_ready = False
    wa_send = os.getenv("WHATSAPP_SEND_ENABLED", "").strip() == "1"
    social = get_social_session_status().get("platforms") or {}

    def _social_channel(key: str, *, blocked_detail: str, blocked_next: str, ready_detail: str) -> dict[str, Any]:
        st = social.get(key) or {}
        ready = bool(st.get("logged_in"))
        if key == "instagram" and os.getenv("APSALES_SOCIAL_SKIP_INSTAGRAM", "1").strip() == "1":
            ready = False
            blocked_detail = "今日暂停 · INS 打不开"
            blocked_next = "今日跳过 Instagram，专注 FB + X"
        method = st.get("method") or ""
        return {
            "label": st.get("label") or PLATFORM_LABELS.get(key, key),
            "can_send_today": ready,
            "status": "ready" if ready else "blocked_no_account",
            "status_label": st.get("status_label") or ("✅ 已登录" if ready else "❌ 需子敬登录一次"),
            "detail": ready_detail if ready else blocked_detail,
            "next_step": "Autopilot 自动发帖" if ready else blocked_next,
            "login_method": method,
            "logged_in_at": st.get("logged_in_at"),
        }

    return {
        "email": {
            "label": "邮件",
            "can_send_today": email_ready,
            "status": "ready" if email_ready else "blocked",
            "detail": "Resend · sales@asia-power.com" if email_ready else "需 RESEND_API_KEY + EMAIL_SEND_ENABLED=1",
            "next_step": "网站 Lead 跟进 / 进口商开发信（CEO 批准后发）",
        },
        "whatsapp": {
            "label": "WhatsApp",
            "can_send_today": wa_send,
            "status": "readonly" if not wa_send else "ready",
            "detail": "当前只读同步" if not wa_send else "Business API 已连接",
            "next_step": "需 CEO 扫码 Business 或开通 Cloud API",
        },
        "website": {
            "label": "官网 SEO",
            "can_send_today": True,
            "status": "live",
            "detail": "asia-power.com 在线 · sitemap · 半切目录",
            "next_step": "持续更新库存与详情页",
        },
        "facebook": _social_channel(
            "facebook",
            blocked_detail="无 Business Manager / 无 Page 登录",
            blocked_next="子敬运行 scripts/apsales-social-login.py --platform facebook",
            ready_detail="Meta Page · Autopilot 自动发帖",
        ),
        "instagram": _social_channel(
            "instagram",
            blocked_detail="今日暂停 · INS 打不开",
            blocked_next="今日跳过 Instagram，专注 FB + X",
            ready_detail="IG Business · 建议 Meta Graph API",
        ),
        "x": _social_channel(
            "x",
            blocked_detail="无 X 账号 / API",
            blocked_next="子敬运行 scripts/apsales-social-login.py --platform x",
            ready_detail="X 账号或 API · Autopilot 自动发帖",
        ),
        "telegram": {
            "label": "Telegram 群",
            "can_send_today": False,
            "status": "manual",
            "detail": "可人工加非洲汽配群，但需真人账号",
            "next_step": "有 TG 账号后可试；非自动化",
        },
    }


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _parse_ts(value: str) -> datetime | None:
    if not value:
        return None
    for fmt in ("%Y-%m-%d %H:%M UTC", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S%z"):
        try:
            dt = datetime.strptime(value.replace("+00:00", " UTC"), fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    return None


def hours_since(value: str) -> float | None:
    dt = _parse_ts(value)
    if not dt:
        return None
    return (datetime.now(timezone.utc) - dt).total_seconds() / 3600.0


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


def _default_progress() -> dict[str, Any]:
    waves = []
    for spec in DEFAULT_WAVES:
        waves.append({
            **spec,
            "groups_joined": [],
            "posts_published": [],
            "completion_pct": 0,
        })
    return {
        "version": 1,
        "updated_at": _now(),
        "last_verified_action_at": None,
        "waves": waves,
        "metrics": {
            "replies_scanned": 0,
            "followups_drafted": 0,
            "emails_received": 0,
        },
        "timeline": [],
        "daily_digest": {"last_sent_at": None},
    }


def _ensure_progress(raw: dict[str, Any] | None) -> dict[str, Any]:
    if not raw or not isinstance(raw, dict):
        return _default_progress()
    if not raw.get("waves"):
        raw["waves"] = _default_progress()["waves"]
    known = {w["wave_id"] for w in raw["waves"] if isinstance(w, dict) and w.get("wave_id")}
    for spec in DEFAULT_WAVES:
        if spec["wave_id"] not in known:
            raw["waves"].append({
                **spec,
                "groups_joined": [],
                "posts_published": [],
                "completion_pct": 0,
            })
    raw.setdefault("metrics", {"replies_scanned": 0, "followups_drafted": 0, "emails_received": 0})
    raw.setdefault("timeline", [])
    raw.setdefault("daily_digest", {"last_sent_at": None})
    return raw


def _wave_by_id(progress: dict[str, Any], wave_id: str) -> dict[str, Any] | None:
    for wave in progress.get("waves") or []:
        if isinstance(wave, dict) and wave.get("wave_id") == wave_id:
            return wave
    return None


def _count_wave_posts(wave: dict[str, Any]) -> int:
    posts = wave.get("posts_published") or []
    return sum(
        1 for p in posts
        if isinstance(p, dict) and not p.get("example")
    )


def _compute_wave_pct(wave: dict[str, Any]) -> int:
    targets = wave.get("targets") or {}
    tg = max(1, int(targets.get("groups_joined") or 1))
    tp = max(1, int(targets.get("posts_published") or 1))
    groups = sum(
        1 for g in (wave.get("groups_joined") or [])
        if isinstance(g, dict) and not g.get("example")
    )
    posts = _count_wave_posts(wave)
    pct = (min(groups, tg) / tg + min(posts, tp) / tp) / 2 * 100
    return int(round(pct))


def _recompute(progress: dict[str, Any]) -> dict[str, Any]:
    for wave in progress.get("waves") or []:
        if isinstance(wave, dict):
            wave["completion_pct"] = _compute_wave_pct(wave)
    progress["updated_at"] = _now()
    return progress


def load_progress() -> dict[str, Any]:
    raw = _load_json(PROGRESS_FILE, {})
    return _recompute(_ensure_progress(raw if isinstance(raw, dict) else {}))


def save_progress(progress: dict[str, Any]) -> None:
    _save_json(PROGRESS_FILE, _recompute(progress))


def is_stale(progress: dict[str, Any] | None = None) -> bool:
    data = progress or load_progress()
    last = data.get("last_verified_action_at") or ""
    hours = hours_since(last)
    if hours is None:
        return True
    return hours >= STALE_HOURS


def _append_timeline(
    progress: dict[str, Any],
    *,
    action: str,
    summary: str,
    wave_id: str = "",
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    entry = {
        "event_id": f"evt-{uuid.uuid4().hex[:10]}",
        "action": action,
        "at": _now(),
        "wave_id": wave_id or "",
        "summary": summary,
        "details": details or {},
    }
    timeline = progress.setdefault("timeline", [])
    if isinstance(timeline, list):
        timeline.insert(0, entry)
        progress["timeline"] = timeline[:200]
    return entry


def _truncate_content(text: str, limit: int = MAX_POST_CONTENT) -> str:
    value = (text or "").strip()
    if len(value) <= limit:
        return value
    return value[: limit - 1] + "…"


def _content_preview(text: str, limit: int = 120) -> str:
    value = (text or "").strip().replace("\n", " ")
    if len(value) <= limit:
        return value
    return value[: limit - 1] + "…"


def _platform_label(platform: str) -> str:
    key = (platform or "").strip().lower()
    return PLATFORM_LABELS.get(key, platform or "—")


def _register_post_in_registry(payload: dict[str, Any]) -> None:
    registry = _load_json(REGISTRY_FILE, [])
    if not isinstance(registry, list):
        registry = []
    post_id = payload.get("post_id") or f"post-{uuid.uuid4().hex[:8]}"
    content = _truncate_content(payload.get("post_content") or payload.get("content") or "")
    status = (payload.get("status") or "live").strip() or "live"
    record = {
        "post_id": post_id,
        "platform": payload.get("platform", "facebook"),
        "language_market": payload.get("language_market") or payload.get("market", ""),
        "scheme_id": payload.get("scheme_id", ""),
        "wave_id": payload.get("wave_id", ""),
        "post_url": payload.get("post_url", ""),
        "listing_url": payload.get("listing_url", "https://asia-power.com/half-cuts/"),
        "post_content": content,
        "content_preview": _content_preview(content),
        "posted_at": payload.get("posted_at") or _now(),
        "ceo_approved_at": payload.get("ceo_approved_at", ""),
        "last_scan_at": payload.get("posted_at") or _now(),
        "status": status,
        "test_batch": bool(payload.get("test_batch")),
        "image_urls": payload.get("image_urls") or [],
        "caption_short": payload.get("caption_short") or "",
    }
    registry.append(record)
    _save_json(REGISTRY_FILE, registry)


def _build_post_record(
    fields: dict[str, Any],
    *,
    wave_id: str,
    status: str = "live",
) -> dict[str, Any]:
    raw_content = fields.get("post_content") or fields.get("content") or ""
    post_content = _truncate_content(raw_content)
    market = fields.get("market") or fields.get("language_market", "")
    return {
        "post_id": fields.get("post_id") or f"post-{uuid.uuid4().hex[:8]}",
        "scheme_id": fields.get("scheme_id", ""),
        "platform": fields.get("platform", "facebook"),
        "language_market": market,
        "market": market,
        "wave_id": wave_id or fields.get("wave_id", ""),
        "post_url": (fields.get("post_url") or fields.get("url") or "").strip(),
        "listing_url": fields.get("listing_url", "https://asia-power.com/half-cuts/"),
        "post_content": post_content,
        "content_preview": _content_preview(post_content),
        "posted_at": fields.get("posted_at") or _now(),
        "ceo_approved_at": fields.get("ceo_approved_at") or _now(),
        "screenshot_note": fields.get("screenshot_note") or fields.get("proof") or "",
        "example": bool(fields.get("example")),
        "test_batch": bool(fields.get("test_batch")),
        "status": status,
        "image_urls": fields.get("image_urls") or [],
        "caption_short": fields.get("caption_short") or "",
        "manual_note": fields.get("manual_note") or "",
    }


def demote_example_records(*, wave_id: str = "wave1-en-gh-ng") -> int:
    """Remove example records from active wave arrays (keeps archived note in timeline)."""
    progress = load_progress()
    wave = _wave_by_id(progress, wave_id)
    if not wave:
        return 0
    removed = 0
    before_groups = wave.get("groups_joined") or []
    wave["groups_joined"] = [
        g for g in before_groups
        if not (isinstance(g, dict) and g.get("example"))
    ]
    removed += len(before_groups) - len(wave["groups_joined"])
    before_posts = wave.get("posts_published") or []
    kept_posts = [p for p in before_posts if not (isinstance(p, dict) and p.get("example"))]
    removed += len(before_posts) - len(kept_posts)
    wave["posts_published"] = kept_posts

    registry = _load_json(REGISTRY_FILE, [])
    if isinstance(registry, list):
        registry = [
            r for r in registry
            if not (
                isinstance(r, dict)
                and (
                    r.get("example")
                    or "example" in str(r.get("post_url", ""))
                )
            )
        ]
        _save_json(REGISTRY_FILE, registry)

    if removed:
        _append_timeline(
            progress,
            action="scan_done",
            summary=f"已移除示例帖文 · {removed} 条",
            wave_id=wave_id,
            details={"note": "example records demoted for CEO test batch"},
        )
    save_progress(progress)
    return removed


def register_test_batch_wave1(*, notify: bool = True) -> dict[str, Any]:
    """CEO-approved test batch: FB(A) + IG(B) + X(A) — blocked until Meta/X accounts exist."""
    from customer_gateway.social_post_assets import caption_for_scheme, pick_images_for_scheme

    demote_example_records(wave_id="wave1-en-gh-ng")
    scheme_a = (
        "Custom dismantling. Parts on demand.\n\n"
        "AsiaPower connects verified China suppliers with workshops, fleet operators and parts dealers "
        "across Africa — half-cuts, engines, gearboxes and truck cabs, matched to your spec.\n\n"
        "Browse supplier-verified listings with photos, engine codes and EXW pricing on our website.\n\n"
        "👉 https://asia-power.com/half-cuts/\n\n"
        "Have a requirement? Email sales@asia-power.com — we reply with options and photos. "
        "WhatsApp +86 166 3880 1930 also works.\n\n"
        "We don't close deals in comments — visit the site to explore the catalog."
    )
    scheme_b = (
        "2010 Toyota Vios · 2NZ-FE · 5MT · ~100,000 km\n\n"
        "Supplier-verified half-cut on AsiaPower — engine & gearbox assembly, front clip, "
        "wiring harness, radiator pack. EXW from China.\n\n"
        "Popular for Vios / Yaris / Echo rebuilds across English-speaking Africa.\n\n"
        "📋 Full photos & specs on our website:\n"
        "https://asia-power.com/half-cuts/detail.html?slug=toyota-vios-2010-2nz-fe-half-cut-hc250509\n\n"
        "Interested? Email sales@asia-power.com with HC250509 — we'll confirm availability and send a quote. "
        "WhatsApp +86 166 3880 1930.\n\n"
        "Browse first, email when ready — we don't negotiate prices in DMs."
    )
    scheme_a_x = (
        "Custom dismantling. Parts on demand.\n\n"
        "AsiaPower — verified half-cuts, engines & gearboxes from China for Africa.\n\n"
        "Browse: https://asia-power.com/half-cuts/\n"
        "Quote: sales@asia-power.com · WhatsApp +86 166 3880 1930"
    )
    caption_a_fb = caption_for_scheme("A", "facebook")
    caption_a_x = caption_for_scheme("A", "x")
    caption_b_ig = caption_for_scheme("B", "instagram")
    posts = [
        {
            "platform": "facebook",
            "scheme_id": "A",
            "market": "EN-Ghana/Nigeria",
            "listing_url": "https://asia-power.com/half-cuts/",
            "content": scheme_a,
            "caption_short": caption_a_fb,
            "image_urls": pick_images_for_scheme("A"),
            "manual_note": "Facebook 西非汽配/Tokunbo 小组发主帖，附 hero 配图",
        },
        {
            "platform": "instagram",
            "scheme_id": "B",
            "market": "EN-Ghana/Nigeria",
            "listing_url": "https://asia-power.com/half-cuts/detail.html?slug=toyota-vios-2010-2nz-fe-half-cut-hc250509",
            "content": scheme_b,
            "caption_short": caption_b_ig,
            "image_urls": pick_images_for_scheme("B"),
            "manual_note": "Instagram Feed 发 carousel（车头+发动机），Bio 链 half-cuts/",
        },
        {
            "platform": "x",
            "scheme_id": "A",
            "market": "EN-Ghana/Nigeria",
            "listing_url": "https://asia-power.com/half-cuts/",
            "content": scheme_a_x,
            "caption_short": caption_a_x,
            "image_urls": pick_images_for_scheme("A"),
            "manual_note": "X 发原创帖 + 配图，可带 #Tokunbo #AutoParts",
        },
    ]
    results = []
    for spec in posts:
        result = record_event(
            "post_pending",
            wave_id="wave1-en-gh-ng",
            notify=notify,
            test_batch=True,
            ceo_approved_at=_now(),
            **spec,
        )
        results.append(result)
    return {"ok": True, "registered": len(results), "results": results}


def record_event(
    action: str,
    *,
    wave_id: str = "",
    notify: bool = True,
    **fields: Any,
) -> dict[str, Any]:
    """Record a verified distribution action and optionally notify CEO."""
    progress = load_progress()
    action = (action or "").strip().lower()
    if action not in VERIFIED_ACTIONS:
        raise ValueError(f"Unknown action: {action}")

    wave = _wave_by_id(progress, wave_id) if wave_id else None
    entry_details = dict(fields)
    summary = ""

    if action == "group_join":
        group = {
            "group_id": fields.get("group_id") or f"grp-{uuid.uuid4().hex[:8]}",
            "group_name": fields.get("group_name") or fields.get("name") or "未命名小组",
            "name": fields.get("group_name") or fields.get("name") or "未命名小组",
            "group_url": fields.get("group_url") or fields.get("url") or "",
            "url": fields.get("group_url") or fields.get("url") or "",
            "platform": fields.get("platform", "facebook"),
            "language_market": fields.get("language_market") or fields.get("market", ""),
            "market": fields.get("market") or fields.get("language_market", ""),
            "wave_id": wave_id or fields.get("wave_id", ""),
            "joined_at": fields.get("joined_at") or _now(),
            "status": fields.get("status", "joined"),
            "screenshot_note": fields.get("screenshot_note") or fields.get("proof") or "",
            "example": bool(fields.get("example")),
        }
        if wave:
            wave.setdefault("groups_joined", []).append(group)
        summary = f"加入小组 · {_platform_label(group['platform'])} · {group['group_name']}"
        entry_details = group

    elif action == "post_published":
        post_url = (fields.get("post_url") or fields.get("url") or "").strip()
        if not post_url:
            raise ValueError("post_url is required for post_published")
        post = _build_post_record(fields, wave_id=wave_id, status="live")
        if wave:
            wave.setdefault("posts_published", []).append(post)
        _register_post_in_registry({**post, "language_market": post["market"], "status": "live"})
        preview = post["content_preview"] or f"方案{post['scheme_id']}"
        summary = f"发布帖文 · {_platform_label(post['platform'])} · 方案{post['scheme_id']} · {preview}"
        entry_details = post

    elif action == "post_pending":
        post = _build_post_record(fields, wave_id=wave_id, status="blocked_no_account")
        post["block_reason"] = fields.get("block_reason") or "无人持有 FB/IG/X 登录权限"
        if wave:
            wave.setdefault("posts_published", []).append(post)
        _register_post_in_registry({
            **post,
            "language_market": post["market"],
            "status": "blocked_no_account",
        })
        preview = post["content_preview"] or f"方案{post['scheme_id']}"
        summary = (
            f"社媒受阻 · {_platform_label(post['platform'])} · "
            f"方案{post['scheme_id']} · 无账号可发 · {preview}"
        )
        entry_details = post

    elif action == "post_blocked":
        post = _build_post_record(fields, wave_id=wave_id, status="blocked_no_account")
        post["block_reason"] = fields.get("block_reason") or "无人持有 FB/IG/X 登录权限"
        if wave:
            wave.setdefault("posts_published", []).append(post)
        _register_post_in_registry({
            **post,
            "language_market": post["market"],
            "status": "blocked_no_account",
        })
        preview = post["content_preview"] or f"方案{post['scheme_id']}"
        summary = (
            f"社媒受阻 · {_platform_label(post['platform'])} · "
            f"方案{post['scheme_id']} · {preview}"
        )
        entry_details = post

    elif action == "scan_done":
        count = int(fields.get("posts_scanned") or fields.get("count") or 0)
        progress["metrics"]["replies_scanned"] = int(progress["metrics"].get("replies_scanned") or 0) + max(count, 1)
        summary = f"回复扫描 · {count or 1} 条帖文"

    elif action == "reply_found":
        progress["metrics"]["replies_scanned"] = int(progress["metrics"].get("replies_scanned") or 0) + 1
        summary = f"发现客户回复 · {fields.get('platform', '?')} · {fields.get('customer_handle', '?')}"

    elif action == "followup_drafted":
        progress["metrics"]["followups_drafted"] = int(progress["metrics"].get("followups_drafted") or 0) + 1
        summary = f"跟进草稿 · {fields.get('draft_id', '?')}"

    elif action == "email_received":
        progress["metrics"]["emails_received"] = int(progress["metrics"].get("emails_received") or 0) + 1
        summary = f"收到邮件 · {fields.get('thread_id', fields.get('subject', '?'))}"

    elif action == "email_sent":
        progress["metrics"]["emails_sent"] = int(progress["metrics"].get("emails_sent") or 0) + 1
        summary = (
            f"邮件已发送 · {fields.get('to', '?')} · "
            f"{fields.get('subject', fields.get('outreach_id', '?'))}"
        )

    progress["last_verified_action_at"] = _now()
    event = _append_timeline(
        progress,
        action=action,
        summary=summary,
        wave_id=wave_id,
        details=entry_details,
    )
    save_progress(progress)

    result = {"ok": True, "action": action, "event": event, "progress": get_progress()}
    if notify:
        result["notified"] = notify_ceo_action(action, fields=fields, wave_id=wave_id, event=event)
    return result


def notify_ceo_action(
    action: str,
    *,
    fields: dict[str, Any] | None = None,
    wave_id: str = "",
    event: dict[str, Any] | None = None,
) -> int:
    """Send Telegram feedback for a verified action."""
    fields = fields or {}
    wave = None
    if wave_id:
        wave = _wave_by_id(load_progress(), wave_id)
    wave_label = wave.get("label", wave_id) if wave else ""

    lines: list[str] = []
    if action == "group_join":
        lines = [
            "✅ 子敬 · 已成功加入小组",
            f"波次: {wave_label or '—'}",
            f"组名: {fields.get('group_name') or fields.get('name', '—')}",
            f"链接: {fields.get('group_url') or fields.get('url', '—')}",
        ]
        proof = fields.get("screenshot_note") or fields.get("proof")
        if proof:
            lines.append(f"截图/证明: {proof}")
    elif action == "post_published":
        content = fields.get("post_content") or fields.get("content") or ""
        preview = _content_preview(content, 200) if content else ""
        lines = [
            "✅ 子敬 · 帖文已发布",
            f"波次: {wave_label or '—'}",
            f"方案: {fields.get('scheme_id', '—')} · 市场: {fields.get('market') or fields.get('language_market', '—')}",
            f"平台: {_platform_label(fields.get('platform', '—'))}",
            f"帖文: {fields.get('post_url') or fields.get('url', '—')}",
            f"落地页: {fields.get('listing_url', 'https://asia-power.com/half-cuts/')}",
        ]
        if preview:
            lines.append(f"内容: {preview}")
    elif action == "post_pending" or action == "post_blocked":
        content = fields.get("post_content") or fields.get("content") or ""
        preview = _content_preview(content, 200) if content else ""
        reason = fields.get("block_reason") or "无人持有 FB/IG/X 登录权限"
        lines = [
            "🚫 子敬 · 社媒帖文无法发布（无账号）",
            f"波次: {wave_label or '—'}",
            f"方案: {fields.get('scheme_id', '—')} · 市场: {fields.get('market') or fields.get('language_market', '—')}",
            f"平台: {_platform_label(fields.get('platform', '—'))}",
            f"原因: {reason}",
            "替代: 邮件 outreach 或 CEO 开 Meta/X 账号",
            f"落地页: {fields.get('listing_url', 'https://asia-power.com/half-cuts/')}",
        ]
        if preview:
            lines.append(f"内容（待发）: {preview}")
    elif action == "email_sent":
        lines = [
            "✅ 子敬 · 主动开发邮件已发送",
            f"收件人: {fields.get('to', '—')}",
            f"主题: {fields.get('subject', '—')}",
            f"outreach_id: {fields.get('outreach_id', '—')}",
            f"Resend ID: {fields.get('resend_id', '—')}",
        ]
    elif action == "scan_done":
        lines = [
            "🔍 子敬 · 社媒回复扫描完成",
            f"扫描帖文: {fields.get('posts_scanned') or fields.get('count', '—')} 条",
            f"待起草跟进: {fields.get('pending_replies', '—')}",
        ]
    elif action == "reply_found":
        lines = [
            "💬 子敬 · 发现客户回复",
            f"平台: {fields.get('platform', '—')}",
            f"客户: {fields.get('customer_handle', '—')}",
            f"摘要: {(fields.get('snippet') or '')[:120]}",
        ]
    elif action == "followup_drafted":
        lines = [
            "📝 子敬 · 跟进草稿已生成",
            f"draft_id: {fields.get('draft_id', '—')}",
            f"客户: {fields.get('customer_handle', '—')}",
            "→ CEO 批准后才可发送",
        ]
    elif action == "email_received":
        lines = [
            "📧 子敬 · 分销相关邮件",
            f"主题: {fields.get('subject', '—')}",
            f"thread: {fields.get('thread_id', '—')}",
        ]
    else:
        lines = [f"📊 子敬 · {action}", event.get("summary", "") if event else ""]

    lines.append("")
    lines.append("📈 进度看板: https://asia-power.com/admin/apsales-progress.html")
    text = "\n".join(lines)
    return _send_telegram(text)


def _send_telegram(text: str) -> int:
    from coo_core.approval_gate import notify_ceo, parse_allowed_chat_ids
    from tools import message_tool

    chat_ids = parse_allowed_chat_ids(os.getenv("COO_TELEGRAM_ALLOWED_CHAT_IDS"))
    if chat_ids and message_tool.coo_telegram_token():
        return notify_ceo(text)

    fallback_chat = (
        os.getenv("ASIAPOWER_TELEGRAM_CHAT_ID")
        or os.getenv("TELEGRAM_CHAT_ID")
        or ""
    ).strip()
    fallback_token = (
        os.getenv("ASIAPOWER_TELEGRAM_BOT_TOKEN")
        or os.getenv("TELEGRAM_BOT_TOKEN")
        or ""
    ).strip()
    if fallback_chat and fallback_token:
        message_tool.send_telegram_message(fallback_chat, text, token=fallback_token)
        return 1
    return 0


def _build_links(record: dict[str, Any]) -> list[dict[str, str]]:
    links: list[dict[str, str]] = []
    post_url = (record.get("post_url") or "").strip()
    group_url = (record.get("group_url") or record.get("url") or "").strip()
    listing_url = (record.get("listing_url") or "").strip()
    if post_url:
        links.append({"label": "帖文", "url": post_url})
    if group_url:
        links.append({"label": "小组", "url": group_url})
    if listing_url:
        links.append({"label": "落地页", "url": listing_url})
    return links


def _normalize_group(raw: dict[str, Any], wave: dict[str, Any] | None = None) -> dict[str, Any]:
    name = raw.get("group_name") or raw.get("name") or "未命名小组"
    url = raw.get("group_url") or raw.get("url") or ""
    platform = raw.get("platform", "facebook")
    market = raw.get("language_market") or raw.get("market") or ""
    wave_id = raw.get("wave_id") or (wave or {}).get("wave_id", "")
    at = raw.get("joined_at") or raw.get("at") or ""
    record = {
        **raw,
        "type": "group_join",
        "type_label": ACTION_LABELS["group_join"],
        "group_name": name,
        "group_url": url,
        "platform": platform,
        "platform_label": _platform_label(platform),
        "language_market": market,
        "market": market,
        "wave_id": wave_id,
        "wave_label": (wave or {}).get("label", wave_id),
        "at": at,
        "content_preview": name,
        "post_content": "",
        "links": _build_links({"group_url": url}),
        "example": bool(raw.get("example")),
    }
    return record


def _normalize_post(raw: dict[str, Any], wave: dict[str, Any] | None = None) -> dict[str, Any]:
    content = raw.get("post_content") or raw.get("content") or ""
    if content and not raw.get("content_preview"):
        preview = _content_preview(content)
    else:
        preview = raw.get("content_preview") or _content_preview(content)
    platform = raw.get("platform", "facebook")
    market = raw.get("language_market") or raw.get("market") or ""
    wave_id = raw.get("wave_id") or (wave or {}).get("wave_id", "")
    at = raw.get("posted_at") or raw.get("at") or ""
    status = raw.get("status") or "live"
    blocked = _is_social_blocked_status(status)
    pending_publish = status == "approved_pending_publish"
    record = {
        **raw,
        "type": "post_blocked" if blocked else ("post_pending" if pending_publish else "post_published"),
        "type_label": (
            ACTION_LABELS["post_blocked"]
            if blocked
            else ("待自动发布" if pending_publish else ACTION_LABELS["post_published"])
        ),
        "status": status if pending_publish else ("blocked_no_account" if blocked else status),
        "platform": platform,
        "platform_label": _platform_label(platform),
        "language_market": market,
        "market": market,
        "wave_id": wave_id,
        "wave_label": (wave or {}).get("label", wave_id),
        "at": at,
        "post_content": content,
        "content_preview": preview or f"方案{raw.get('scheme_id', '—')}",
        "links": _build_links(raw),
        "example": bool(raw.get("example")),
    }
    return record


def _normalize_timeline_event(item: dict[str, Any]) -> dict[str, Any]:
    action = item.get("action") or ""
    details = item.get("details") if isinstance(item.get("details"), dict) else {}
    platform = details.get("platform") or item.get("platform") or ""
    market = (
        details.get("language_market")
        or details.get("market")
        or item.get("language_market")
        or item.get("market")
        or ""
    )
    content = details.get("post_content") or details.get("content") or details.get("snippet") or ""
    record = {
        **item,
        "type": action,
        "type_label": ACTION_LABELS.get(action, action),
        "platform": platform,
        "platform_label": _platform_label(platform) if platform else "—",
        "language_market": market,
        "market": market,
        "at": item.get("at") or "",
        "content_preview": _content_preview(content) if content else (item.get("summary") or ""),
        "post_content": content,
        "links": _build_links(details),
        "wave_id": item.get("wave_id") or details.get("wave_id") or "",
        "example": bool(details.get("example") or item.get("example")),
    }
    return record


def build_action_sections(data: dict[str, Any]) -> dict[str, Any]:
    """Build audit-trail sections for dashboard/API."""
    groups: list[dict[str, Any]] = []
    posts: list[dict[str, Any]] = []
    followups: list[dict[str, Any]] = []
    engagement: list[dict[str, Any]] = []

    for wave in data.get("waves") or []:
        if not isinstance(wave, dict):
            continue
        for raw in wave.get("groups_joined") or []:
            if isinstance(raw, dict):
                groups.append(_normalize_group(raw, wave))
        for raw in wave.get("posts_published") or []:
            if isinstance(raw, dict):
                posts.append(_normalize_post(raw, wave))

    for item in data.get("timeline") or []:
        if not isinstance(item, dict):
            continue
        action = item.get("action") or ""
        if action in ENGAGEMENT_ACTIONS:
            engagement.append(_normalize_timeline_event(item))
        elif action in ("reply_found", "followup_drafted", "scan_done", "email_received"):
            followups.append(_normalize_timeline_event(item))

    groups.sort(key=lambda r: r.get("at") or "", reverse=True)
    posts.sort(key=lambda r: r.get("at") or "", reverse=True)
    followups.sort(key=lambda r: r.get("at") or "", reverse=True)
    engagement.sort(key=lambda r: r.get("at") or "", reverse=True)

    action_log = groups + posts + engagement + followups
    action_log.sort(key=lambda r: r.get("at") or "", reverse=True)

    engagement_summary = _build_engagement_summary(data)

    return {
        "groups": groups,
        "posts": posts,
        "followups": followups,
        "engagement": engagement,
        "engagement_summary": engagement_summary,
        "action_log": action_log,
        "has_records": bool(groups or posts or followups or engagement),
    }


def _build_engagement_summary(data: dict[str, Any]) -> dict[str, Any]:
    """Today's planned/completed engagement from queue + metrics."""
    try:
        from customer_gateway.social_engagement_engine import get_today_summary
        summary = get_today_summary()
    except Exception:
        summary = {}
    metrics = data.get("metrics") or {}
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_engagement = [
        item for item in (data.get("timeline") or [])
        if isinstance(item, dict)
        and str(item.get("at") or "").startswith(today)
        and (item.get("action") or "") in ENGAGEMENT_ACTIONS
    ]
    return {
        **summary,
        "today_events": len(today_engagement),
        "metrics": {
            "planned": metrics.get("engagement_planned", 0),
            "posts": metrics.get("engagement_post", 0),
            "comments": metrics.get("engagement_comment", 0),
            "follows": metrics.get("engagement_follow", 0),
            "replies": metrics.get("engagement_reply", 0),
        },
    }


def get_progress() -> dict[str, Any]:
    """Return progress with computed fields for dashboard/API."""
    data = load_progress()
    waves = []
    total_pct = 0
    for wave in data.get("waves") or []:
        if not isinstance(wave, dict):
            continue
        pct = _compute_wave_pct(wave)
        waves.append({**wave, "completion_pct": pct})
        total_pct += pct
    overall_pct = int(round(total_pct / max(len(waves), 1)))
    last = data.get("last_verified_action_at") or ""
    hours = hours_since(last)
    sections = build_action_sections({**data, "waves": waves})
    migrate_social_posts_to_blocked()
    return {
        **data,
        "waves": waves,
        "overall_completion_pct": overall_pct,
        "is_stale": is_stale(data),
        "hours_since_last_action": round(hours, 1) if hours is not None else None,
        "stale_warning": "无进展" if is_stale(data) else "",
        "dashboard_url": "https://asia-power.com/admin/apsales-progress.html",
        "executable_channels": get_executable_channels(),
        "social_sessions": get_social_session_status(),
        **sections,
    }


def format_progress_text() -> str:
    data = get_progress()
    lines = [
        "📊 子敬 · 分销推广进度",
        f"总完成度: {data['overall_completion_pct']}%",
        f"最后真实动作: {data.get('last_verified_action_at') or '尚无'}",
    ]
    if data.get("is_stale"):
        lines.append(f"⚠️ {data.get('stale_warning') or '无进展'}（>{STALE_HOURS:g}h 无验证动作）")
    lines.append("")
    for wave in data.get("waves") or []:
        groups = len(wave.get("groups_joined") or [])
        posts = len(wave.get("posts_published") or [])
        tg = (wave.get("targets") or {}).get("groups_joined", "?")
        tp = (wave.get("targets") or {}).get("posts_published", "?")
        bar = "█" * (wave.get("completion_pct", 0) // 10) + "░" * (10 - wave.get("completion_pct", 0) // 10)
        lines.append(
            f"{wave.get('label', wave.get('wave_id'))}: {wave.get('completion_pct', 0)}% [{bar}] "
            f"组{groups}/{tg} · 帖{posts}/{tp}"
        )
    metrics = data.get("metrics") or {}
    lines.extend([
        "",
        f"扫描: {metrics.get('replies_scanned', 0)} · "
        f"跟进草稿: {metrics.get('followups_drafted', 0)} · "
        f"邮件: {metrics.get('emails_received', 0)}",
        f"看板: {data.get('dashboard_url')}",
    ])
    return "\n".join(lines)


def actions_today(progress: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    data = progress or load_progress()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    out: list[dict[str, Any]] = []
    for item in data.get("timeline") or []:
        if not isinstance(item, dict):
            continue
        at = str(item.get("at") or "")
        if at.startswith(today):
            out.append(item)
    return out


def format_daily_digest() -> str:
    data = get_progress()
    today_actions = actions_today(data)
    lines = [
        "📅 子敬 · 分销推广日报（09:00 UTC）",
        f"日期: {datetime.now(timezone.utc).strftime('%Y-%m-%d')}",
        "",
        f"今日验证动作: {len(today_actions)} 条",
    ]
    if not today_actions:
        lines.append("⚠️ 今日零动作 — 请确认子敬是否在执行推广计划")
    else:
        for item in today_actions[:15]:
            lines.append(f"  · {item.get('at', '')} — {item.get('summary', item.get('action', ''))}")
    lines.extend([
        "",
        f"总进度: {data['overall_completion_pct']}%",
        f"最后动作: {data.get('last_verified_action_at') or '尚无'}",
    ])
    if data.get("is_stale"):
        lines.append(f"🔴 {data.get('stale_warning') or '无进展'}（>{STALE_HOURS:g}h）")
    lines.append(f"看板: {data.get('dashboard_url')}")
    return "\n".join(lines)


def send_daily_digest(*, force: bool = False) -> int:
    progress = load_progress()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    last_sent = (progress.get("daily_digest") or {}).get("last_sent_at") or ""
    if not force and last_sent.startswith(today):
        return 0
    text = format_daily_digest()
    sent = _send_telegram(text)
    if sent:
        progress.setdefault("daily_digest", {})["last_sent_at"] = _now()
        save_progress(progress)
    return sent


def progress_summary_line() -> str:
    data = get_progress()
    stale = " ⚠️无进展" if data.get("is_stale") else ""
    return f"📈 总进度 {data['overall_completion_pct']}%{stale} · 看板 {data.get('dashboard_url')}"

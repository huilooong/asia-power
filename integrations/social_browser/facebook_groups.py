"""Facebook group discovery, join, and human greeting — traffic to asia-power.com."""

from __future__ import annotations

import json
import os
import random
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

from integrations.social_browser.platform_adapter import (
    _attach_images_facebook,
    _cleanup_temp_files,
    _compose_text,
    _dismiss_facebook_overlays,
    _download_images,
    verify_login,
)

from customer_gateway.outreach_copy import (
    build_group_greet_steps,
    copy_version_label,
    link_gap_seconds,
    max_links_per_conversation,
)

ROOT = Path(__file__).resolve().parent.parent.parent
GROUPS_FILE = ROOT / "config" / "apsales_fb_target_groups.yaml"
POLICY_FILE = ROOT / "config" / "apsales_social_engagement_policy.yaml"
STATE_FILE = ROOT / "memory" / "customer_gateway" / "fb_groups_state.json"

DEFAULT_GREETING = (
    "Hi everyone 👋 New here — I'm from China, we supply verified half-cuts & engines "
    "with photos on our site. Happy to help if you're looking for specific engine codes. "
    "https://asia-power.com/half-cuts/"
)

FALLBACK_LISTING = {
    "listing_url": "https://asia-power.com/half-cuts/detail.html?slug=toyota-vios-2010-2nz-fe-half-cut-hc250509",
    "image_urls": ["https://asia-power.com/assets/images/hero-composite-ship-truck-machinery.png"],
    "label": "Toyota Vios 2NZ-FE half-cut",
}

RATE_LIMIT_PATTERNS = re.compile(
    r"temporarily blocked|action blocked|try again later|"
    r"can't post|cannot post|restricted|unusual activity|"
    r"暂时无法|操作受限|请稍后再试",
    re.I,
)

JOIN_SELECTORS = (
    '[aria-label="Join group"][role="button"]',
    '[aria-label="Join Group"][role="button"]',
    '[aria-label="加入小组"][role="button"]',
    'div[role="button"]:has-text("Join group")',
    'div[role="button"]:has-text("Join Group")',
    'div[role="button"]:has-text("加入小组")',
    'span:has-text("Join group")',
    'span:has-text("Join Group")',
)


def _now_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _human_delay(min_s: float = 2.0, max_s: float = 5.0) -> None:
    time.sleep(random.uniform(min_s, max_s))


def _load_yaml(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    try:
        import yaml  # type: ignore

        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _save_yaml(path: Path, data: dict[str, Any]) -> None:
    try:
        import yaml  # type: ignore

        path.write_text(
            yaml.dump(data, allow_unicode=True, default_flow_style=False, sort_keys=False),
            encoding="utf-8",
        )
    except Exception:
        pass


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


def load_groups_config() -> dict[str, Any]:
    return _load_yaml(GROUPS_FILE)


def save_groups_config(data: dict[str, Any]) -> None:
    _save_yaml(GROUPS_FILE, data)


def load_groups_state() -> dict[str, Any]:
    state = _load_json(STATE_FILE, {})
    if not isinstance(state, dict):
        state = {}
    if state.get("date") != _today():
        state = {
            "date": _today(),
            "joins_today": 0,
            "greetings_today": 0,
            "comments_today": 0,
            "searches_today": 0,
            "timeline_posts_disabled_until": state.get("timeline_posts_disabled_until"),
        }
    return state


def save_groups_state(state: dict[str, Any]) -> None:
    state["date"] = _today()
    _save_json(STATE_FILE, state)


def load_group_policy() -> dict[str, Any]:
    policy = _load_yaml(POLICY_FILE)
    fb = (policy.get("platforms") or {}).get("facebook") or {}
    groups = policy.get("facebook_groups") or {}
    unlimited = 9999

    def _cap(val: Any, default: int = unlimited) -> int:
        if val is None:
            return default
        try:
            n = int(val)
            return default if n >= unlimited else n
        except (TypeError, ValueError):
            return default

    return {
        "max_joins_per_day": _cap(fb.get("max_group_joins_per_day") or groups.get("max_joins_per_day")),
        "max_greetings_per_day": _cap(fb.get("max_group_greetings_per_day") or groups.get("max_greetings_per_day")),
        "max_comments_per_day": _cap(fb.get("max_group_comments_per_day") or groups.get("max_comments_per_day")),
        "greeting_template": str(groups.get("greeting_template") or DEFAULT_GREETING).strip(),
        "search_per_day": _cap(groups.get("max_searches_per_day"), 9999),
        "platform_block_only": str(policy.get("stop_condition") or "") == "platform_block_only",
    }


def _action_paused(action_type: str) -> bool:
    try:
        from customer_gateway.fb_platform_limits import is_action_paused

        paused, _ = is_action_paused(action_type)
        return paused
    except Exception:
        return False


def _normalize_group_url(url: str) -> str:
    url = (url or "").strip().split("?")[0].rstrip("/")
    m = re.search(r"facebook\.com/groups/([^/?#]+)", url, re.I)
    if m:
        return f"https://www.facebook.com/groups/{m.group(1)}"
    return url


def _groups_list(cfg: dict[str, Any]) -> list[dict[str, Any]]:
    groups = cfg.get("groups") or []
    return [g for g in groups if isinstance(g, dict)]


def _upsert_group(cfg: dict[str, Any], entry: dict[str, Any]) -> None:
    url = _normalize_group_url(str(entry.get("group_url") or ""))
    if not url:
        return
    groups = _groups_list(cfg)
    for g in groups:
        if _normalize_group_url(str(g.get("group_url") or "")) == url:
            g.update({k: v for k, v in entry.items() if v is not None})
            cfg["groups"] = groups
            return
    groups.append({**entry, "group_url": url})
    cfg["groups"] = groups


def _search_queries(cfg: dict[str, Any]) -> list[str]:
    targets = cfg.get("keyword_search_targets") or {}
    combined = targets.get("combined_queries") or []
    if combined:
        return [str(q).strip() for q in combined if str(q).strip()]
    base = targets.get("base_keywords") or ["tokunbo", "half cut", "spare parts"]
    countries = targets.get("country_modifiers") or ["Ghana", "Nigeria", "Kenya"]
    out: list[str] = []
    for kw in base[:6]:
        for c in countries[:4]:
            out.append(f"{kw} {c}")
    return out[:12]


def _pick_listing_for_greeting() -> dict[str, Any]:
    try:
        from customer_gateway.outreach_copy import get_listing

        listing = get_listing("hc250509")
        return {
            "listing_url": listing.get("url"),
            "image_urls": listing.get("image_urls") or [],
            "label": listing.get("label"),
        }
    except Exception:
        pass
    try:
        from customer_gateway.social_post_assets import pick_images_for_scheme

        images = pick_images_for_scheme("B") or pick_images_for_scheme("A")
        if images:
            return {
                "listing_url": FALLBACK_LISTING["listing_url"],
                "image_urls": images[:1],
                "label": FALLBACK_LISTING["label"],
            }
    except Exception:
        pass
    return dict(FALLBACK_LISTING)


def build_greeting_message(template: str | None = None, *, include_listing: bool = True) -> tuple[str, list[str], str]:
    """Return (intro text only, image_urls for follow-up, listing_url). Staggered post uses build_group_greet_steps."""
    steps = build_group_greet_steps()
    intro = steps[0]["text"] if steps else (template or DEFAULT_GREETING).strip()
    listing = _pick_listing_for_greeting()
    follow = steps[1] if len(steps) > 1 else {}
    image_urls = list(follow.get("image_urls") or listing.get("image_urls") or [])[:1]
    listing_url = str(listing.get("listing_url") or listing.get("url") or "https://asia-power.com/half-cuts/")
    if include_listing and listing_url in intro:
        intro = intro.replace(listing_url, "").strip()
    return intro, image_urls, listing_url


def _post_group_composer_text(page, text: str, *, image_paths: list | None = None) -> bool:
    composer = page.locator(
        '[aria-label="Write something..."], [aria-label="写点什么..."], '
        '[role="button"]:has-text("Write something"), [role="button"]:has-text("写点什么")'
    ).first
    if not composer.count():
        composer = page.locator(
            '[aria-label="Create a post"], [aria-label="创建帖子"], '
            '[role="button"]:has-text("Create post"), [role="button"]:has-text("创建公开帖")'
        ).first
    if not composer.count():
        return False
    _human_delay(1.5, 3.0)
    composer.click(timeout=15_000)
    time.sleep(1)
    local_paths = list(image_paths or [])
    if local_paths:
        attached = _attach_images_facebook(page, local_paths)
        if attached:
            time.sleep(1)
    page.keyboard.type(text[:63206])
    _human_delay(1.0, 2.5)
    page.locator(
        '[aria-label="Post"], [aria-label="发布"], '
        '[role="button"]:has-text("Post"), [role="button"]:has-text("发布")'
    ).last.click(timeout=15_000)
    time.sleep(4)
    return True


def _comment_on_own_post(page, text: str, *, image_paths: list | None = None) -> bool:
    """Reply under the most recent post in the group feed (own intro)."""
    post = page.locator('[role="article"]').first
    if not post.count():
        return False
    try:
        post.scroll_into_view_if_needed(timeout=5000)
    except Exception:
        pass
    comment_box = page.locator(
        '[aria-label="Write a comment"], [aria-label="写评论"], '
        '[placeholder*="comment"], [placeholder*="评论"]'
    ).first
    if not comment_box.count():
        try:
            post.click(timeout=5000)
            time.sleep(1)
        except Exception:
            pass
        comment_box = page.locator(
            '[aria-label="Write a comment"], [aria-label="写评论"]'
        ).first
    if not comment_box.count():
        return False
    comment_box.click(timeout=10_000)
    time.sleep(0.8)
    local_paths = list(image_paths or [])
    if local_paths:
        attached = _attach_images_facebook(page, local_paths)
        if attached:
            time.sleep(1)
            comment_box = page.locator(
                '[aria-label="Write a comment"], [aria-label="写评论"]'
            ).first
            if comment_box.count():
                comment_box.click(timeout=5000)
    page.keyboard.type(text[:8000])
    _human_delay(0.8, 1.5)
    page.locator(
        '[aria-label="Comment"], [aria-label="评论"], '
        '[aria-label="Post"], [aria-label="发布"], '
        '[role="button"]:has-text("Comment"), [role="button"]:has-text("评论")'
    ).last.click(timeout=10_000)
    time.sleep(2)
    return True


def search_groups(
    keywords: str | list[str] | None = None,
    *,
    max_results: int = 8,
    page=None,
    context=None,
) -> dict[str, Any]:
    """Find Facebook groups via search and save discovered URLs to config."""
    if page is None:
        from integrations.social_browser.session_manager import acquire_browser

        with acquire_browser("facebook") as sess:
            return search_groups(keywords, max_results=max_results, page=sess.page, context=sess.context)

    cfg = load_groups_config()
    state = load_groups_state()
    pol = load_group_policy()
    if not pol.get("platform_block_only") and state.get("searches_today", 0) >= pol["search_per_day"]:
        return {"ok": True, "skipped": True, "reason": "search_cap", "found": 0}
    if _action_paused("search"):
        return {"ok": True, "skipped": True, "reason": "platform_block_search", "found": 0}

    queries = [keywords] if isinstance(keywords, str) and keywords.strip() else []
    if not queries:
        if isinstance(keywords, list) and keywords:
            queries = [str(k).strip() for k in keywords if str(k).strip()]
        else:
            queries = _search_queries(cfg)

    query = random.choice(queries)
    found: list[dict[str, str]] = []

    try:
        page.goto("https://www.facebook.com/", wait_until="domcontentloaded", timeout=120_000)
        time.sleep(2)
        _dismiss_facebook_overlays(page)
        if not verify_login("facebook", page=page, context=context, close=False):
            return {"ok": False, "error": "not_logged_in", "found": 0}

        url = f"https://www.facebook.com/search/groups/?q={quote(query)}"
        page.goto(url, wait_until="domcontentloaded", timeout=120_000)
        time.sleep(3)
        _dismiss_facebook_overlays(page)

        links = page.evaluate(
            """() => {
            const out = [];
            const seen = new Set();
            for (const a of document.querySelectorAll('a[href*="/groups/"]')) {
                const href = a.href || '';
                const m = href.match(/facebook\\.com\\/groups\\/([^/?#]+)/);
                if (!m) continue;
                const slug = m[1];
                if (['feed', 'discover', 'create', 'joins', 'requests'].includes(slug)) continue;
                const clean = 'https://www.facebook.com/groups/' + slug;
                if (seen.has(clean)) continue;
                seen.add(clean);
                const name = (a.innerText || a.textContent || slug).trim().slice(0, 120);
                if (name.length < 2) continue;
                out.push({ url: clean, name });
                if (out.length >= 20) break;
            }
            return out;
        }"""
        )
        if isinstance(links, list):
            for row in links[:max_results]:
                if not isinstance(row, dict):
                    continue
                gurl = _normalize_group_url(str(row.get("url") or ""))
                name = str(row.get("name") or "").strip()
                if not gurl:
                    continue
                found.append({"group_url": gurl, "name": name, "discovered_via": query})
                _upsert_group(cfg, {
                    "group_url": gurl,
                    "name": name,
                    "status": "discovered",
                    "market": _guess_market(query),
                    "language": "en",
                    "discovered_via": query,
                    "discovered_at": _now_str(),
                })

        cfg["last_search"] = {"query": query, "at": _now_str(), "found": len(found)}
        save_groups_config(cfg)
        state["searches_today"] = int(state.get("searches_today", 0)) + 1
        save_groups_state(state)

        return {"ok": True, "query": query, "found": len(found), "groups": found}
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:200], "found": len(found), "query": query}


def _guess_market(query: str) -> str:
    q = query.lower()
    for c in ("ghana", "nigeria", "kenya", "tanzania", "uganda", "senegal", "south africa", "uae"):
        if c in q:
            return c.title()
    return "Africa"


def join_group(
    url: str,
    *,
    page=None,
    context=None,
) -> dict[str, Any]:
    """Request to join a Facebook group (human-paced)."""
    if page is None:
        from integrations.social_browser.session_manager import acquire_browser

        with acquire_browser("facebook") as sess:
            return join_group(url, page=sess.page, context=sess.context)

    group_url = _normalize_group_url(url)
    if not group_url:
        return {"ok": False, "error": "missing_group_url"}

    cfg = load_groups_config()
    state = load_groups_state()
    pol = load_group_policy()
    if not pol.get("platform_block_only") and state.get("joins_today", 0) >= pol["max_joins_per_day"]:
        return {"ok": True, "skipped": True, "reason": "daily_join_cap", "group_url": group_url}
    if _action_paused("group_join"):
        return {"ok": True, "skipped": True, "reason": "platform_block_group_join", "group_url": group_url}

    try:
        page.goto(group_url, wait_until="domcontentloaded", timeout=120_000)
        time.sleep(2)
        _dismiss_facebook_overlays(page)
        if not verify_login("facebook", page=page, context=context, close=False):
            return {"ok": False, "error": "not_logged_in", "group_url": group_url}

        body_text = ""
        try:
            body_text = page.inner_text("body", timeout=5000)[:4000]
        except Exception:
            pass

        if RATE_LIMIT_PATTERNS.search(body_text):
            _record_platform_block("group_join", body_text[:200])
            return {"ok": False, "error": "rate_limited", "group_url": group_url}

        joined = False
        pending = False
        for sel in JOIN_SELECTORS:
            try:
                btn = page.locator(sel).first
                if btn.count() and btn.is_visible(timeout=1500):
                    _human_delay(1.5, 3.5)
                    btn.click(timeout=10_000)
                    time.sleep(2)
                    joined = True
                    break
            except Exception:
                continue

        page_text = ""
        try:
            page_text = page.inner_text("body", timeout=3000)[:3000].lower()
        except Exception:
            pass

        if "pending" in page_text or "requested" in page_text or "等待" in page_text or "已发送" in page_text:
            pending = True

        if "member" in page_text or "成员" in page_text:
            status = "joined"
        elif pending:
            status = "pending"
        elif joined:
            status = "pending"
        else:
            status = "discovered"

        _upsert_group(cfg, {
            "group_url": group_url,
            "status": status,
            "joined_at": _now_str() if status in ("joined", "pending") else None,
        })
        save_groups_config(cfg)

        if status in ("joined", "pending"):
            state["joins_today"] = int(state.get("joins_today", 0)) + 1
            save_groups_state(state)

        return {
            "ok": True,
            "group_url": group_url,
            "status": status,
            "joined_today": state.get("joins_today", 0),
        }
    except Exception as exc:
        err = str(exc)[:200]
        if RATE_LIMIT_PATTERNS.search(err):
            _record_platform_block("group_join", err)
            return {"ok": False, "error": "rate_limited", "group_url": group_url}
        return {"ok": False, "error": err, "group_url": group_url}


def post_group_greeting(
    group_url: str,
    message: str | None = None,
    *,
    page=None,
    context=None,
) -> dict[str, Any]:
    """Human short intro + half-cuts link + optional listing photo."""
    if page is None:
        from integrations.social_browser.session_manager import acquire_browser

        with acquire_browser("facebook") as sess:
            return post_group_greeting(group_url, message, page=sess.page, context=sess.context)

    url = _normalize_group_url(group_url)
    if not url:
        return {"ok": False, "error": "missing_group_url"}

    cfg = load_groups_config()
    state = load_groups_state()
    pol = load_group_policy()
    if not pol.get("platform_block_only") and state.get("greetings_today", 0) >= pol["max_greetings_per_day"]:
        return {"ok": True, "skipped": True, "reason": "daily_greeting_cap", "group_url": url}
    if _action_paused("group_greeting"):
        return {"ok": True, "skipped": True, "reason": "platform_block_group_greeting", "group_url": url}

    group_meta: dict[str, Any] = {}
    for g in _groups_list(cfg):
        if _normalize_group_url(str(g.get("group_url") or "")) == url:
            group_meta = g
            break

    steps = build_group_greet_steps(
        group_url=url,
        group_name=str(group_meta.get("name") or group_meta.get("title") or ""),
        group_meta=group_meta,
    )
    if not steps:
        text, image_urls, listing_url = build_greeting_message(message or pol.get("greeting_template"))
        steps = [{"step": "intro", "text": text, "image_urls": image_urls, "delay_after": 0}]

    local_paths: list = []
    temp_paths: list = []
    links_posted = 0
    max_links = max_links_per_conversation()

    try:
        page.goto(url, wait_until="domcontentloaded", timeout=120_000)
        time.sleep(3)
        _dismiss_facebook_overlays(page)
        if not verify_login("facebook", page=page, context=context, close=False):
            return {"ok": False, "error": "not_logged_in", "group_url": url}

        body_text = ""
        try:
            body_text = page.inner_text("body", timeout=5000)[:4000]
        except Exception:
            pass
        if RATE_LIMIT_PATTERNS.search(body_text):
            _record_platform_block("group_greeting", body_text[:200])
            return {"ok": False, "error": "rate_limited", "group_url": url}

        posted_steps: list[str] = []
        for i, step in enumerate(steps):
            if step.get("optional") and links_posted >= max_links:
                continue
            if i > 0:
                delay = int(step.get("delay_after") or link_gap_seconds())
                if step.get("has_link") and delay < link_gap_seconds():
                    delay = link_gap_seconds()
                if delay > 0:
                    time.sleep(delay)

            text = str(step.get("text") or "").strip()
            if not text:
                continue
            image_urls = step.get("image_urls") or []
            step_paths = _download_images(image_urls, max_images=1) if image_urls else []
            temp_paths.extend(step_paths)

            if i == 0:
                ok = _post_group_composer_text(page, text, image_paths=None)
            elif step.get("reply_to_own_post"):
                ok = _comment_on_own_post(page, text, image_paths=step_paths or None)
            else:
                ok = _post_group_composer_text(page, text, image_paths=step_paths or None)

            if not ok:
                return {"ok": False, "error": "post_failed", "group_url": url, "step": step.get("step")}

            if step.get("has_link"):
                links_posted += 1
            posted_steps.append(str(step.get("step") or i))

        _upsert_group(cfg, {
            "group_url": url,
            "status": "greeted",
            "greeted_at": _now_str(),
        })
        save_groups_config(cfg)
        state["greetings_today"] = int(state.get("greetings_today", 0)) + 1
        save_groups_state(state)

        return {
            "ok": True,
            "group_url": url,
            "post_url": page.url,
            "greetings_today": state.get("greetings_today", 0),
            "steps_completed": posted_steps,
            "copy_version": copy_version_label("group_greet"),
            "links_posted": links_posted,
        }
    except Exception as exc:
        err = str(exc)[:200]
        if RATE_LIMIT_PATTERNS.search(err):
            _record_platform_block("group_greeting", err)
            return {"ok": False, "error": "rate_limited", "group_url": url}
        return {"ok": False, "error": err, "group_url": url}
    finally:
        _cleanup_temp_files(temp_paths)


def _record_platform_block(action_type: str, message: str = "") -> None:
    """Pause only this action type for 24h; timeline post also disables timeline."""
    try:
        from customer_gateway.fb_platform_limits import record_platform_block

        record_platform_block(action_type, message)
    except Exception:
        pass


def _record_rate_limit(state: dict[str, Any]) -> None:
    """Legacy — timeline disable on rate limit."""
    _record_platform_block("post", "timeline_rate_limit")


def groups_needing_join(limit: int = 3) -> list[dict[str, Any]]:
    cfg = load_groups_config()
    out = [g for g in _groups_list(cfg) if g.get("status") in ("discovered", None, "")]
    return out[:limit]


def groups_needing_greeting(limit: int = 5) -> list[dict[str, Any]]:
    cfg = load_groups_config()
    out = [
        g for g in _groups_list(cfg)
        if g.get("status") in ("joined", "pending") and not g.get("greeted_at")
    ]
    return out[:limit]


def run_daily_group_actions(
    *,
    max_joins: int | None = None,
    max_greetings: int | None = None,
    search_first: bool = True,
    page=None,
    context=None,
) -> dict[str, Any]:
    """Search → join → greet pipeline for daily-run."""
    if page is None:
        from integrations.social_browser.session_manager import acquire_browser

        with acquire_browser("facebook") as sess:
            return run_daily_group_actions(
                max_joins=max_joins,
                max_greetings=max_greetings,
                search_first=search_first,
                page=sess.page,
                context=sess.context,
            )

    pol = load_group_policy()
    joins_cap = max_joins if max_joins is not None else pol["max_joins_per_day"]
    greet_cap = max_greetings if max_greetings is not None else pol["max_greetings_per_day"]

    result: dict[str, Any] = {
        "ok": True,
        "search": None,
        "joins": [],
        "greetings": [],
        "errors": [],
    }

    if search_first:
        result["search"] = search_groups(page=page, context=context)

    join_blocked = False
    for grp in groups_needing_join(joins_cap):
        url = str(grp.get("group_url") or "")
        jr = join_group(url, page=page, context=context)
        result["joins"].append(jr)
        if jr.get("error") == "rate_limited":
            result["errors"].append("rate_limited")
            join_blocked = True
            break
        if jr.get("skipped"):
            break
        _human_delay(3.0, 6.0)

    for grp in groups_needing_greeting(greet_cap):
        url = str(grp.get("group_url") or "")
        gr = post_group_greeting(url, page=page, context=context)
        result["greetings"].append(gr)
        if gr.get("error") == "rate_limited":
            result["errors"].append("rate_limited")
            break
        if gr.get("skipped"):
            break
        _human_delay(4.0, 8.0)

    if result["errors"]:
        result["ok"] = False
    return result


def timeline_posts_allowed() -> tuple[bool, str]:
    state = load_groups_state()
    until = str(state.get("timeline_posts_disabled_until") or "")
    if not until:
        return True, "ok"
    try:
        dt = datetime.strptime(until, "%Y-%m-%d %H:%M UTC").replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) < dt:
            return False, f"timeline_disabled_until_{until}"
    except ValueError:
        pass
    return True, "ok"

"""Versioned outreach copy — human DM / group greet / X / comments."""

from __future__ import annotations

import os
import random
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
COPY_FILE = ROOT / "config" / "apsales_outreach_copy.yaml"

_URL_RE = re.compile(r"https?://[^\s<>\"']+", re.I)


def _demo_mode() -> bool:
    return os.getenv("APSALES_SOCIAL_DEMO_MODE", "0").strip() == "1"


@lru_cache(maxsize=1)
def load_outreach_copy() -> dict[str, Any]:
    if not COPY_FILE.is_file():
        return {"version": 2, "rules": {}, "templates": {}, "listings": {}}
    try:
        import yaml  # type: ignore

        data = yaml.safe_load(COPY_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {"version": 2, "rules": {}, "templates": {}, "listings": {}}


def link_gap_seconds() -> int:
    cfg = load_outreach_copy()
    rules = cfg.get("rules") or {}
    sec = int(rules.get("min_seconds_between_links") or 120)
    if _demo_mode():
        return max(5, min(sec, 10))
    return sec


def max_links_per_conversation() -> int:
    cfg = load_outreach_copy()
    rules = cfg.get("rules") or {}
    return int(rules.get("max_links_per_conversation") or 2)


def catalog_url() -> str:
    cfg = load_outreach_copy()
    return str(cfg.get("catalog_url") or "https://asia-power.com/half-cuts/")


def get_listing(key: str = "hc250509") -> dict[str, Any]:
    cfg = load_outreach_copy()
    listings = cfg.get("listings") or {}
    row = listings.get(key) if isinstance(listings, dict) else None
    if isinstance(row, dict):
        return dict(row)
    return {
        "sku": "HC250509",
        "label": "Vios 2NZ-FE",
        "url": "https://asia-power.com/half-cuts/detail.html?slug=toyota-vios-2010-2nz-fe-half-cut-hc250509",
        "image_urls": ["https://asia-power.com/uploads/photos/photo-1783000347587-ffc6bbc7_full.webp"],
    }


def _first_name(name: str) -> str:
    raw = (name or "").strip()
    if not raw:
        return "there"
    token = raw.split()[0][:40]
    return token or "there"


def _format_text(template: str, listing: dict[str, Any], *, name: str = "") -> str:
    first = _first_name(name)
    return (
        (template or "")
        .replace("{listing_label}", str(listing.get("label") or ""))
        .replace("{listing_url}", str(listing.get("url") or ""))
        .replace("{catalog_url}", catalog_url())
        .replace("{sku}", str(listing.get("sku") or ""))
        .replace("{first_name}", first)
        .replace("{name}", first)
        .strip()
    )


def _message_has_link(text: str) -> bool:
    return bool(_URL_RE.search(text or ""))


def _template_name(kind: str) -> str:
    """Map active_version human_v3 → group_greet_human_v3 / dm_human_v3."""
    ver = active_copy_version()
    suffix = ver if ver.startswith("human_") else f"human_{ver}"
    return f"{kind}_{suffix}"


def _locale_messages(tpl: dict[str, Any], locale: str | None = None) -> list[dict[str, Any]]:
    loc = (locale or tpl.get("locale_default") or "en").strip().lower()
    locales = tpl.get("locales") or {}
    if isinstance(locales, dict):
        block = locales.get(loc) or locales.get("en") or {}
        msgs = block.get("messages") if isinstance(block, dict) else None
        if isinstance(msgs, list) and msgs:
            return [m for m in msgs if isinstance(m, dict)]
    legacy = tpl.get("messages")
    if isinstance(legacy, list):
        return [m for m in legacy if isinstance(m, dict)]
    return []


def _build_steps_from_messages(
    rows: list[dict[str, Any]],
    listing: dict[str, Any],
    *,
    name: str = "",
    for_group: bool = False,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    link_count = 0
    max_links = max_links_per_conversation()

    for i, row in enumerate(rows):
        if not isinstance(row, dict):
            continue
        if row.get("optional") and link_count >= max_links:
            continue
        text = _format_text(str(row.get("text") or ""), listing, name=name)
        has_link = bool(row.get("has_link")) or _message_has_link(text)
        if has_link:
            if link_count >= max_links:
                continue
            link_count += 1

        step: dict[str, Any] = {
            "step": row.get("id") or f"msg_{i}",
            "text": text,
            "has_link": has_link,
            "delay_after": int(row.get("delay_after") or 0),
            "image_urls": [],
        }
        if row.get("attach_image"):
            urls = listing.get("image_urls") or []
            step["image_urls"] = [str(u) for u in urls if str(u).strip()][:1]
        if for_group:
            step["reply_to_own_post"] = bool(row.get("reply_to_own_post")) or i > 0
        if row.get("optional"):
            step["optional"] = True
        out.append(step)

    return out


def build_dm_messages(*, name: str = "", listing_key: str | None = None, locale: str | None = None) -> list[dict[str, Any]]:
    """Staggered DM sequence for send_dm_staggered."""
    cfg = load_outreach_copy()
    tpl_key = _template_name("dm")
    tpl = (cfg.get("templates") or {}).get(tpl_key) or {}
    if not tpl:
        tpl = (cfg.get("templates") or {}).get("dm_human_v2") or {}
    listing_ref = listing_key or tpl.get("default_listing") or "hc250509"
    listing = get_listing(str(listing_ref))

    rows = _locale_messages(tpl, locale)
    if rows:
        return _build_steps_from_messages(rows, listing, name=name, for_group=False)

    out: list[dict[str, Any]] = []
    link_count = 0
    max_links = max_links_per_conversation()

    for row in tpl.get("messages") or []:
        if not isinstance(row, dict):
            continue
        if row.get("optional") and link_count >= max_links:
            continue
        text = _format_text(str(row.get("text") or ""), listing, name=name)
        has_link = bool(row.get("has_link")) or _message_has_link(text)
        if has_link:
            if link_count >= max_links:
                continue
            link_count += 1

        msg: dict[str, Any] = {
            "id": row.get("id"),
            "text": text,
            "delay_after": int(row.get("delay_after") or 0),
            "has_link": has_link,
        }
        if row.get("attach_image"):
            urls = listing.get("image_urls") or []
            msg["image_urls"] = [str(u) for u in urls if str(u).strip()][:1]
        out.append(msg)

    return out


def infer_group_locale(*, group_url: str = "", group_name: str = "", group_meta: dict[str, Any] | None = None) -> str:
    """Pick en vs zh for group greet copy."""
    meta = group_meta or {}
    explicit = str(meta.get("locale") or meta.get("copy_locale") or "").strip().lower()
    if explicit in ("zh", "cn", "zh-cn", "chinese"):
        return "zh"
    if explicit in ("en", "english"):
        return "en"
    blob = f"{group_url} {group_name} {meta.get('name') or ''} {meta.get('region') or ''}".lower()
    if re.search(r"[\u4e00-\u9fff]", blob):
        return "zh"
    if re.search(r"\b(china|chinese|guangzhou|shanghai|beijing|shenzhen|中文|华人)\b", blob, re.I):
        return "zh"
    return "en"


def build_group_greet_steps(
    *,
    listing_key: str | None = None,
    locale: str | None = None,
    group_url: str = "",
    group_name: str = "",
    group_meta: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Intro post → pitch comment → catalog link comment (120s after pitch)."""
    cfg = load_outreach_copy()
    tpl_key = _template_name("group_greet")
    tpl = (cfg.get("templates") or {}).get(tpl_key) or {}
    if not tpl:
        tpl = (cfg.get("templates") or {}).get("group_greet_human_v2") or {}
    listing_ref = listing_key or tpl.get("default_listing") or "hc250509"
    listing = get_listing(str(listing_ref))

    loc = locale or infer_group_locale(group_url=group_url, group_name=group_name, group_meta=group_meta)
    rows = _locale_messages(tpl, loc)
    if rows:
        return _build_steps_from_messages(rows, listing, for_group=True)

    steps: list[dict[str, Any]] = []
    intro = tpl.get("intro") or {}
    intro_text = _format_text(str(intro.get("text") or ""), listing)
    steps.append({
        "step": "intro",
        "text": intro_text,
        "has_link": bool(intro.get("has_link")) or _message_has_link(intro_text),
        "image_urls": [],
        "delay_after": 0,
    })

    follow = tpl.get("follow_up") or {}
    follow_text = _format_text(str(follow.get("text") or ""), listing)
    urls = list(listing.get("image_urls") or [])[:1] if follow.get("attach_image") else []
    steps.append({
        "step": "follow_up",
        "text": follow_text,
        "has_link": True,
        "image_urls": [str(u) for u in urls if str(u).strip()],
        "delay_after": int(follow.get("delay_after") or link_gap_seconds()),
        "reply_to_own_post": True,
    })

    catalog = tpl.get("catalog_reply") or {}
    if catalog:
        cat_text = _format_text(str(catalog.get("text") or ""), listing)
        steps.append({
            "step": "catalog",
            "text": cat_text,
            "has_link": True,
            "image_urls": [],
            "delay_after": int(catalog.get("delay_after") or link_gap_seconds()),
            "reply_to_own_post": True,
            "optional": bool(catalog.get("optional")),
        })

    return steps


def pick_x_post(*, listing_key: str | None = None) -> dict[str, Any]:
    cfg = load_outreach_copy()
    tpl = (cfg.get("templates") or {}).get("x_short_v2") or {}
    listing_ref = listing_key or tpl.get("default_listing") or "hc250509"
    listing = get_listing(str(listing_ref))
    variants = tpl.get("variants") or []
    text = _format_text(random.choice(variants) if variants else "", listing)
    images: list[str] = []
    if tpl.get("attach_image"):
        images = [str(u) for u in (listing.get("image_urls") or [])[:1] if str(u).strip()]
    return {"text": text[:280], "image_urls": images, "listing_url": listing.get("url")}


def pick_comment(*, with_link: bool = False) -> str:
    cfg = load_outreach_copy()
    key = "comment_human_v2_with_link" if with_link else "comment_human_v2_no_link"
    tpl = (cfg.get("templates") or {}).get(key) or {}
    variants = tpl.get("variants") or []
    listing = get_listing("hc250509")
    text = _format_text(random.choice(variants) if variants else "", listing)
    return text


def active_copy_version() -> str:
    cfg = load_outreach_copy()
    return str(cfg.get("active_version") or "human_v3")


def copy_version_label(kind: str = "group_greet") -> str:
    return _template_name(kind)


def enforce_link_delays(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Ensure ≥120s gap before any message that contains a link (after first link)."""
    gap = link_gap_seconds()
    seen_link = False
    for msg in messages:
        if msg.get("has_link") or _message_has_link(str(msg.get("text") or "")):
            if seen_link:
                msg["delay_after"] = max(int(msg.get("delay_after") or 0), gap)
            seen_link = True
    return messages

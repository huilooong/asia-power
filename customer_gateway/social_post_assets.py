"""Resolve scheme-aware captions and image URLs for social autopilot."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
SCHEMES_FILE = ROOT / "config" / "apsales_social_schemes.yaml"

_FALLBACK_SCHEMES: dict[str, dict[str, Any]] = {
    "A": {
        "listing_url": "https://asia-power.com/half-cuts/",
        "image_urls": ["https://asia-power.com/assets/images/hero-composite-ship-truck-machinery.png"],
        "caption_short": {
            "facebook": (
                "Custom dismantling · parts on demand 🇬🇭🇳🇬\n\n"
                "Verified half-cuts, engines & gearboxes from China → Africa.\n\n"
                "👉 asia-power.com/half-cuts/\n\n"
                "Need parts? sales@asia-power.com"
            ),
            "x": (
                "Custom dismantling · parts on demand. Verified half-cuts & engines for Africa 🇬🇭🇳🇬\n\n"
                "👉 asia-power.com/half-cuts/\n"
                "sales@asia-power.com"
            ),
        },
    },
}


def _normalize_platform(platform: str) -> str:
    key = (platform or "").strip().lower()
    return "x" if key == "twitter" else key


def _strip_block(value: str) -> str:
    return (value or "").strip()


@lru_cache(maxsize=1)
def _load_config() -> dict[str, Any]:
    if not SCHEMES_FILE.is_file():
        return {"schemes": _FALLBACK_SCHEMES, "defaults": {"max_images_per_post": 4, "caption_limits": {"facebook": 500, "x": 280}}}
    try:
        import yaml  # type: ignore

        data = yaml.safe_load(SCHEMES_FILE.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    return {"schemes": _FALLBACK_SCHEMES, "defaults": {"max_images_per_post": 4}}


def get_scheme(scheme_id: str) -> dict[str, Any]:
    key = (scheme_id or "A").strip().upper()
    schemes = _load_config().get("schemes") or {}
    if isinstance(schemes, dict) and key in schemes:
        row = schemes[key]
        return row if isinstance(row, dict) else {}
    return _FALLBACK_SCHEMES.get("A", {})


def pick_images_for_scheme(scheme_id: str, *, platform: str = "", limit: int | None = None) -> list[str]:
    """Return image URLs for a scheme (1–4 images for carousel)."""
    cfg = _load_config()
    defaults = cfg.get("defaults") if isinstance(cfg.get("defaults"), dict) else {}
    max_images = limit or int(defaults.get("max_images_per_post") or 4)
    scheme = get_scheme(scheme_id)
    urls = scheme.get("image_urls") or []
    if not isinstance(urls, list):
        return []
    cleaned = [str(u).strip() for u in urls if str(u).strip()]
    return cleaned[:max_images]


def caption_for_scheme(scheme_id: str, platform: str) -> str:
    scheme = get_scheme(scheme_id)
    caps = scheme.get("caption_short") or {}
    if not isinstance(caps, dict):
        return ""
    plat = _normalize_platform(platform)
    return _strip_block(str(caps.get(plat) or caps.get("default") or ""))


def _caption_limit(platform: str) -> int:
    cfg = _load_config()
    defaults = cfg.get("defaults") if isinstance(cfg.get("defaults"), dict) else {}
    limits = defaults.get("caption_limits") if isinstance(defaults.get("caption_limits"), dict) else {}
    plat = _normalize_platform(platform)
    return int(limits.get(plat) or limits.get("default") or (280 if plat == "x" else 500))


def resolve_post_assets(item: dict[str, Any], platform: str) -> dict[str, Any]:
    """Merge queue item with scheme defaults → caption, images, listing_url."""
    plat = _normalize_platform(platform)
    scheme_id = (item.get("scheme_id") or "A").strip().upper()
    scheme = get_scheme(scheme_id)

    listing_url = _strip_block(item.get("listing_url") or scheme.get("listing_url") or "https://asia-power.com/half-cuts/")

    caption = _strip_block(item.get("caption_short") or "")
    if not caption:
        caption = caption_for_scheme(scheme_id, plat)
    if not caption:
        caption = _strip_block(item.get("post_content") or item.get("content") or "")

    limit = _caption_limit(plat)
    if len(caption) > limit:
        caption = caption[: limit - 1].rstrip() + "…"

    images = item.get("image_urls") or []
    if not images:
        images = pick_images_for_scheme(scheme_id, platform=plat)
    if isinstance(images, list):
        images = [str(u).strip() for u in images if str(u).strip()][:4]
    else:
        images = []

    return {
        "caption": caption,
        "image_urls": images,
        "listing_url": listing_url,
        "scheme_id": scheme_id,
    }

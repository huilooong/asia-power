#!/usr/bin/env python3
"""Hourly Facebook Page poster: 2 unused Available listings per run.

Reuses the Graph API album-post flow validated 2026-07-18:
  POST /{page-id}/photos (published=false) → POST /{page-id}/feed attached_media

Dedup ledger: data/fb-posted-stock-ids.json
Inventory: inventory-site half-cut-approved.json (prod) or local data/ fallback.
Facebook only — Instagram not wired (account not bound yet).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except ModuleNotFoundError:
    pass

SITE_PUBLIC = "https://asia-power.com"
GRAPH_BASE = os.getenv("META_GRAPH_API_BASE", "https://graph.facebook.com/v21.0").rstrip("/")

# Canonical ledger lives next to AsiaPower scripts (today's batch wrote here).
POSTED_PATH = ROOT / "data" / "fb-posted-stock-ids.json"
# Plan also mentioned inventory-site path — keep as secondary mirror.
POSTED_MIRROR = Path("/root/.openclaw/workspace/inventory-site/data/fb-posted-stock-ids.json")

APPROVED_CANDIDATES = [
    Path("/root/.openclaw/workspace/inventory-site/data/half-cut-approved.json"),
    ROOT / "data" / "half-cut-approved.json",
    ROOT / "work" / "half-cut-approved-prod.json",
]

LABELED_PHOTO_HINTS = (
    "vehicle front",
    "vehicle rear",
    "engine",
    "interior",
    "vin plate",
    "dashboard",
    "left side",
    "right side",
)


def log(msg: str) -> None:
    print(msg, flush=True)


def _graph_get(path: str, token: str, fields: str = "") -> dict[str, Any]:
    params = {"access_token": token}
    if fields:
        params["fields"] = fields
    url = f"{GRAPH_BASE}/{path.lstrip('/')}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=45) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _graph_post(path: str, token: str, fields: dict[str, Any]) -> dict[str, Any]:
    data = dict(fields)
    data["access_token"] = token
    body = urllib.parse.urlencode(data).encode("utf-8")
    url = f"{GRAPH_BASE}/{path.lstrip('/')}"
    req = urllib.request.Request(url, data=body, method="POST", headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Graph API HTTP {exc.code}: {detail[:500]}") from exc


def resolve_page_token(page_id: str, token: str) -> str:
    """Prefer Page access_token (System User token must be exchanged)."""
    try:
        page = _graph_get(page_id, token, fields="access_token,name")
        page_tok = str(page.get("access_token") or "").strip()
        if page_tok:
            log(f"page token ok (page={page.get('name') or page_id})")
            return page_tok
    except Exception as exc:
        log(f"page token exchange skipped: {exc}")
    return token


def load_approved() -> list[dict[str, Any]]:
    for path in APPROVED_CANDIDATES:
        if path.is_file():
            raw = json.loads(path.read_text(encoding="utf-8"))
            items = raw if isinstance(raw, list) else raw.get("approved") or raw.get("items") or []
            if not isinstance(items, list):
                continue
            log(f"inventory: {path} ({len(items)} records)")
            return [it for it in items if isinstance(it, dict)]
    raise FileNotFoundError("half-cut-approved.json not found in known paths")


def load_posted() -> list[dict[str, Any]]:
    for path in (POSTED_PATH, POSTED_MIRROR):
        if path.is_file():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(data, list):
                    return [x for x in data if isinstance(x, dict)]
            except json.JSONDecodeError:
                log(f"warn: corrupt posted ledger {path}, starting empty")
    return []


def save_posted(entries: list[dict[str, Any]]) -> None:
    POSTED_PATH.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(entries, indent=2, ensure_ascii=False) + "\n"
    POSTED_PATH.write_text(text, encoding="utf-8")
    try:
        if POSTED_MIRROR.parent.is_dir():
            POSTED_MIRROR.write_text(text, encoding="utf-8")
    except OSError as exc:
        log(f"warn: mirror ledger write failed: {exc}")


def photo_url(photo: dict[str, Any]) -> str:
    url = str(photo.get("url") or "").strip()
    if not url:
        return ""
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if not url.startswith("/"):
        url = "/" + url
    return SITE_PUBLIC + url


def is_generic_photo_label(label: str) -> bool:
    return label.strip().lower().startswith("photo ")


def labeled_photo_score(item: dict[str, Any]) -> int:
    score = 0
    for p in item.get("photos") or []:
        if not isinstance(p, dict):
            continue
        lab = str(p.get("label") or "").strip().lower()
        if not lab or is_generic_photo_label(lab):
            continue
        score += 2
        if any(h in lab for h in LABELED_PHOTO_HINTS):
            score += 3
    return score


def pick_photos(item: dict[str, Any], *, max_n: int = 5) -> list[dict[str, Any]]:
    photos = [p for p in (item.get("photos") or []) if isinstance(p, dict) and photo_url(p)]
    labeled = [p for p in photos if not is_generic_photo_label(str(p.get("label") or ""))]
    chosen = (labeled or photos)[:max_n]
    if len(chosen) < 4 and photos:
        # fill from remaining if labeled set too small
        seen = {id(p) for p in chosen}
        for p in photos:
            if id(p) in seen:
                continue
            chosen.append(p)
            if len(chosen) >= 4:
                break
    return chosen[:max_n]


def build_caption(item: dict[str, Any]) -> str:
    is_cab = str(item.get("truckPartType") or "").lower() == "cab"
    is_truck = str(item.get("vehicleCategory") or "").lower() == "truck" and not is_cab
    brand = str(item.get("brand") or "").strip()
    model = str(item.get("model") or "").strip()
    year = str(item.get("year") or "").strip()
    price = item.get("priceUsd")
    slug = str(item.get("slug") or "").strip()
    engine = str(item.get("engineCode") or "").strip()
    trans = str(item.get("transmissionCode") or "").strip()

    if is_cab:
        title = f"🚛 {year} {brand} {model} Truck Cab".strip()
        body = (
            "Real, physical unit in China — not a stock photo. "
            "Complete driver cab, ready to ship. We also do custom dismantle: "
            "need just one part off it, tell us and we cut only that."
        )
    elif is_truck:
        title = f"🚚 {year} {brand} {model} — Half-Cut Truck, Ready to Dismantle".strip()
        body = (
            "Real, physical unit in China — not a stock photo. "
            "Custom dismantle: tell us the exact part you need, we cut and ship only that."
        )
    else:
        title = f"🚗 {year} {brand} {model} — Half-Cut, Ready to Dismantle".strip()
        body = (
            "Real, physical unit in China — not a stock photo. "
            "Custom dismantle: tell us the exact part you need, we cut and ship only that."
        )

    specs = " · ".join(
        x
        for x in [
            f"Engine: {engine}" if engine else "",
            f"Transmission: {trans}" if trans else "",
        ]
        if x
    )
    parts = [title]
    if specs:
        parts.append(specs)
    if price is not None and str(price).strip() != "":
        parts.append(f"Price: {price} USD")
    parts.append("")
    parts.append(body)
    parts.append("")
    parts.append(f"Full details & photos: {SITE_PUBLIC}/half-cuts/detail.html?slug={slug}")
    return "\n".join(parts)


def eligible_candidates(items: list[dict[str, Any]], posted_ids: set[str]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for it in items:
        stock_id = str(it.get("stockId") or "").strip()
        if not stock_id or stock_id in posted_ids:
            continue
        if str(it.get("status") or "").strip() != "Available":
            continue
        photos = pick_photos(it)
        if len(photos) < 4:
            continue
        if not str(it.get("slug") or "").strip():
            continue
        out.append(it)
    out.sort(key=lambda x: (-labeled_photo_score(x), str(x.get("stockId") or "")))
    return out


def select_diverse(candidates: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    """Prefer labeled-photo quality + brand/category diversity."""
    picked: list[dict[str, Any]] = []
    used_brands: set[str] = set()
    used_cats: set[str] = set()

    def cat_key(it: dict[str, Any]) -> str:
        if str(it.get("truckPartType") or "").lower() == "cab":
            return "cab"
        return str(it.get("vehicleCategory") or "other").lower()

    # Pass 1: different brand + category when possible
    for it in candidates:
        if len(picked) >= limit:
            break
        brand = str(it.get("brand") or "").strip().lower()
        cat = cat_key(it)
        if brand and brand in used_brands:
            continue
        if cat in used_cats and len(candidates) > limit:
            continue
        picked.append(it)
        if brand:
            used_brands.add(brand)
        used_cats.add(cat)

    # Pass 2: fill remaining ignoring category, still prefer new brands
    if len(picked) < limit:
        for it in candidates:
            if len(picked) >= limit:
                break
            if it in picked:
                continue
            brand = str(it.get("brand") or "").strip().lower()
            if brand and brand in used_brands and len(candidates) > limit:
                continue
            picked.append(it)
            if brand:
                used_brands.add(brand)

    # Pass 3: fill anything left
    if len(picked) < limit:
        for it in candidates:
            if len(picked) >= limit:
                break
            if it not in picked:
                picked.append(it)
    return picked[:limit]


def post_listing(
    item: dict[str, Any],
    *,
    page_id: str,
    token: str,
    dry_run: bool = False,
    force_bad_url: bool = False,
) -> str | None:
    stock_id = str(item.get("stockId") or "")
    photos = pick_photos(item)
    if force_bad_url and photos:
        # Validation mode: break every URL so the listing cannot publish.
        photos = [
            {**p, "url": f"/uploads/photos/__missing_force_404_{i}__.jpg"}
            for i, p in enumerate(photos)
        ]

    caption = build_caption(item)
    log(f"  photos={len(photos)} labeled_score={labeled_photo_score(item)}")
    log(f"  caption preview:\n{caption[:280]}{'…' if len(caption) > 280 else ''}")

    if dry_run:
        log("  dry-run: skip Graph API")
        return f"dry-run:{stock_id}"

    media_ids: list[str] = []
    for p in photos:
        url = photo_url(p)
        try:
            resp = _graph_post(f"{page_id}/photos", token, {"url": url, "published": "false"})
            mid = str(resp.get("id") or "").strip()
            if mid:
                media_ids.append(mid)
                log(f"  uploaded photo {mid}")
        except Exception as exc:
            log(f"  photo upload failed ({url}): {exc}")

    # Need a real album (≥4). Partial failures must not publish a thin/broken post.
    if len(media_ids) < 4:
        log(f"  skip {stock_id}: only {len(media_ids)} media uploaded (need ≥4)")
        return None

    params: dict[str, Any] = {"message": caption}
    for i, mid in enumerate(media_ids):
        params[f"attached_media[{i}]"] = json.dumps({"media_fbid": mid})
    try:
        feed = _graph_post(f"{page_id}/feed", token, params)
    except Exception as exc:
        log(f"  feed post failed for {stock_id}: {exc}")
        return None
    post_id = str(feed.get("id") or "").strip()
    return post_id or None


def main() -> int:
    ap = argparse.ArgumentParser(description="AsiaPower Facebook hourly scheduled posts (2/run)")
    ap.add_argument("--limit", type=int, default=2, help="How many listings to post this run (default 2)")
    ap.add_argument("--delay", type=float, default=5.0, help="Seconds between posts (default 5)")
    ap.add_argument("--dry-run", action="store_true", help="Select + build captions only, no publish")
    ap.add_argument(
        "--simulate-bad-url",
        action="store_true",
        help="Force first photo URL 404 on first candidate (validation; never marks posted on failure)",
    )
    args = ap.parse_args()

    page_id = (os.getenv("META_PAGE_ID") or "").strip()
    token = (os.getenv("META_PAGE_ACCESS_TOKEN") or "").strip()
    if not page_id or not token:
        log("❌ Missing META_PAGE_ID or META_PAGE_ACCESS_TOKEN in .env")
        return 1

    try:
        page_token = token if args.dry_run else resolve_page_token(page_id, token)
    except Exception as exc:
        log(f"❌ cannot resolve page token: {exc}")
        return 1

    try:
        items = load_approved()
    except Exception as exc:
        log(f"❌ inventory load failed: {exc}")
        return 1

    posted = load_posted()
    posted_ids = {str(x.get("stockId") or "") for x in posted if x.get("stockId")}
    log(f"already posted: {len(posted_ids)}")

    candidates = eligible_candidates(items, posted_ids)
    if not candidates:
        log("本轮无新库存可发 (no unused Available listings with ≥4 photos)")
        return 0

    selected = select_diverse(candidates, max(1, args.limit))
    log(f"selected {len(selected)} / pool {len(candidates)}: {[x.get('stockId') for x in selected]}")

    ok_count = 0
    for i, item in enumerate(selected):
        stock_id = str(item.get("stockId") or "")
        log(f"[{i + 1}/{len(selected)}] posting {stock_id} {item.get('brand')} {item.get('model')}…")
        force_bad = bool(args.simulate_bad_url and i == 0)
        try:
            post_id = post_listing(
                item,
                page_id=page_id,
                token=page_token,
                dry_run=args.dry_run,
                force_bad_url=force_bad,
            )
        except Exception as exc:
            log(f"  unexpected error (continuing): {exc}")
            post_id = None

        if post_id and not args.dry_run:
            posted.append({"stockId": stock_id, "post_id": post_id, "ts": time.time()})
            save_posted(posted)
            posted_ids.add(stock_id)
            ok_count += 1
            log(f"  OK: {post_id}")
        elif post_id and args.dry_run:
            ok_count += 1
            log("  OK (dry-run)")
        else:
            log(f"  FAILED {stock_id} — not added to posted ledger")

        if i + 1 < len(selected) and args.delay > 0:
            time.sleep(args.delay)

    log(f"done: published={ok_count} selected={len(selected)}")
    return 0 if ok_count or not selected else 1


if __name__ == "__main__":
    raise SystemExit(main())

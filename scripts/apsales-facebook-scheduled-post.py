#!/usr/bin/env python3
"""Hourly Facebook Page poster: 2 unused Available listings per run.

Rules (CEO 2026-07-24):
  - ≥1 photo OR a postable video is enough
  - Prefer video post when self-hosted mp4 exists; else photo album / single photo
  - Titles must be accurate (brand/model/year/part/stockId; no Chinese model junk)
  - Never re-post a stockId already in the ledger
  - New/updated Available inventory auto-enters the pool each cron run (newest first)

Graph flows:
  - Video: POST /{page-id}/videos (file_url + title + description)
  - Photos: POST /{page-id}/photos (published=false) → POST /{page-id}/feed attached_media
  - Single photo: POST /{page-id}/photos (published=true, caption)

Dedup ledger: data/fb-posted-stock-ids.json
Facebook only — Instagram not wired.
"""

from __future__ import annotations

import argparse
import json
import os
import re
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

SITE_PUBLIC = (os.getenv("PUBLIC_SITE_URL") or "https://asia-power.com").rstrip("/")
R2_PUBLIC = (os.getenv("CLOUDFLARE_R2_PUBLIC_BASE") or "https://media.asia-power.com").rstrip("/")
GRAPH_BASE = os.getenv("META_GRAPH_API_BASE", "https://graph.facebook.com/v21.0").rstrip("/")
MIN_MEDIA = 1  # CEO: 1 photo is enough
CJK_RE = re.compile(r"[\u4e00-\u9fff]+")

POSTED_PATH = ROOT / "data" / "fb-posted-stock-ids.json"
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


def _graph_post(path: str, token: str, fields: dict[str, Any], *, timeout: int = 120) -> dict[str, Any]:
    data = dict(fields)
    data["access_token"] = token
    body = urllib.parse.urlencode(data).encode("utf-8")
    url = f"{GRAPH_BASE}/{path.lstrip('/')}"
    req = urllib.request.Request(url, data=body, method="POST", headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
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


def absolute_media_url(url: str) -> str:
    url = str(url or "").strip().split("?")[0]
    if not url:
        return ""
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if not url.startswith("/"):
        url = "/" + url
    # Prefer CDN for uploads when available (R2 public)
    if url.startswith("/uploads/") and R2_PUBLIC:
        return R2_PUBLIC + url
    return SITE_PUBLIC + url


def photo_url(photo: dict[str, Any]) -> str:
    return absolute_media_url(str(photo.get("url") or ""))


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
    chosen = list(labeled or photos)[:max_n]
    if len(chosen) < max_n and photos:
        seen = {id(p) for p in chosen}
        for p in photos:
            if id(p) in seen:
                continue
            chosen.append(p)
            if len(chosen) >= max_n:
                break
    return chosen[:max_n]


def youtube_url(item: dict[str, Any]) -> str:
    video = item.get("video") if isinstance(item.get("video"), dict) else {}
    for raw in (item.get("videoUrl"), video.get("url"), item.get("youtubeVideoId"), video.get("youtubeId")):
        s = str(raw or "").strip()
        if not s:
            continue
        if "youtube.com" in s or "youtu.be" in s:
            return s.split("?")[0] if "youtu.be" in s else s
        if re.fullmatch(r"[A-Za-z0-9_-]{6,}", s):
            return f"https://www.youtube.com/watch?v={s}"
    return ""


def self_hosted_video_url(item: dict[str, Any]) -> str:
    """Public mp4 URL Facebook can fetch (not a YouTube watch page)."""
    video = item.get("video") if isinstance(item.get("video"), dict) else {}
    candidates = [
        video.get("sourceLocalPath"),
        item.get("videoUrl"),
        video.get("url"),
    ]
    for raw in candidates:
        u = str(raw or "").strip().split("?")[0]
        if not u:
            continue
        if "youtube.com" in u or "youtu.be" in u:
            continue
        if "/uploads/videos/" in u or u.startswith("/uploads/videos/"):
            if "/uploads/" in u and not u.startswith("/"):
                # unlikely
                pass
            idx = u.find("/uploads/videos/")
            path = u[idx:] if idx >= 0 else u
            if not path.startswith("/"):
                path = "/" + path
            return absolute_media_url(path)
        if u.startswith("http") and u.lower().endswith((".mp4", ".mov", ".webm")):
            return u
    return ""


def has_postable_media(item: dict[str, Any]) -> bool:
    if self_hosted_video_url(item):
        return True
    if pick_photos(item, max_n=1):
        return True
    # YouTube-only still counts: we can post a link/caption post
    if youtube_url(item):
        return True
    return False


def english_token(value: Any) -> str:
    s = str(value or "").strip()
    if not s:
        return ""
    if CJK_RE.search(s):
        return ""
    return s


def model_from_slug(slug: str, brand: str) -> str:
    raw = str(slug or "").strip().lower()
    if not raw:
        return ""
    parts = [p for p in raw.split("-") if p]
    brand_l = str(brand or "").strip().lower()
    if brand_l and parts and parts[0] == brand_l:
        parts = parts[1:]
    skip = {
        "half",
        "cut",
        "truck",
        "engine",
        "gearbox",
        "cab",
        "machinery",
        "passenger",
        "2wd",
        "4wd",
        "awd",
    }
    out: list[str] = []
    for p in parts:
        if re.fullmatch(r"hc\d+", p):
            break
        if re.fullmatch(r"20\d{2}", p):
            break
        if p in skip:
            continue
        if re.fullmatch(r"[a-z0-9]+", p) and not re.fullmatch(r"\d+", p):
            out.append(p.upper() if len(p) <= 3 else p.capitalize())
        if len(out) >= 2:
            break
    return " ".join(out)


def part_type_label(item: dict[str, Any]) -> str:
    truck_part = str(item.get("truckPartType") or "").strip().lower()
    pass_part = str(item.get("passengerPartType") or "").strip().lower()
    cat = str(item.get("vehicleCategory") or "").strip().lower()
    if truck_part == "cab":
        return "Truck Cab"
    if truck_part == "engine" or pass_part == "engine":
        return "Truck Engine" if cat == "truck" else "Engine"
    if truck_part in ("gearbox", "transmission") or pass_part in ("gearbox", "transmission"):
        return "Truck Gearbox" if cat == "truck" else "Gearbox"
    if cat == "machinery":
        return "Machinery"
    if cat == "truck":
        return "Truck Half Cut"
    return "Half Cut"


def resolve_detail_path(item: dict[str, Any]) -> str:
    cat = str(item.get("vehicleCategory") or "").strip().lower()
    if cat == "truck":
        return "/trucks/detail.html"
    if cat == "machinery":
        return "/machinery/detail.html"
    return "/half-cuts/detail.html"


def detail_page_url(item: dict[str, Any]) -> str:
    slug = str(item.get("slug") or "").strip()
    path = resolve_detail_path(item)
    if not slug:
        return f"{SITE_PUBLIC}{path.rsplit('/', 1)[0]}/"
    return f"{SITE_PUBLIC}{path}?slug={urllib.parse.quote(slug)}"


def build_title(item: dict[str, Any]) -> str:
    """Accurate FB title: year brand model engine part | stockId (English only)."""
    year = str(item.get("year") or "").strip()
    brand = english_token(item.get("brand")) or CJK_RE.sub("", str(item.get("brand") or "")).strip()
    model = english_token(item.get("model")) or model_from_slug(str(item.get("slug") or ""), brand)
    eng = english_token(item.get("engineCode"))
    if not eng:
        eng = CJK_RE.sub("", str(item.get("engineCode") or "")).strip()
    part = part_type_label(item)
    sid = str(item.get("stockId") or "").strip()
    bits = [b for b in (year, brand, model, eng, part) if b]
    title = re.sub(r"\s+", " ", " ".join(bits)).strip()
    if sid:
        title = f"{title} | {sid}" if title else sid
    return title[:200]


def build_caption(item: dict[str, Any]) -> str:
    title = build_title(item)
    price = item.get("priceUsd")
    engine = english_token(item.get("engineCode")) or CJK_RE.sub("", str(item.get("engineCode") or "")).strip()
    trans = english_token(item.get("transmissionCode")) or CJK_RE.sub(
        "", str(item.get("transmissionCode") or "")
    ).strip()
    part = part_type_label(item)
    yt = youtube_url(item)

    if part == "Truck Cab":
        body = (
            "Real physical unit in China — not a stock photo. "
            "Complete driver cab, ready to ship. Custom dismantle available."
        )
    elif "Engine" in part:
        body = (
            "Real physical unit in China — not a stock photo. "
            "Used engine for export. Ask for compression test / photos of your match."
        )
    elif "Gearbox" in part:
        body = (
            "Real physical unit in China — not a stock photo. "
            "Used gearbox for export. Tell us your vehicle match for confirmation."
        )
    else:
        body = (
            "Real physical unit in China — not a stock photo. "
            "Custom dismantle: tell us the exact part you need, we cut and ship only that."
        )

    specs = " · ".join(
        x
        for x in [
            f"Engine: {engine}" if engine else "",
            f"Transmission: {trans}" if trans else "",
            f"Type: {part}",
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
    parts.append(f"Full details: {detail_page_url(item)}")
    if yt:
        parts.append(f"Startup video: {yt}")
    return "\n".join(parts)


def item_recency_ts(item: dict[str, Any]) -> float:
    for key in ("updatedAt", "approvedAt", "createdAt"):
        raw = str(item.get(key) or "").strip()
        if not raw:
            continue
        try:
            # 2026-07-24T10:41:19Z
            from datetime import datetime

            return datetime.fromisoformat(raw.replace("Z", "+00:00")).timestamp()
        except ValueError:
            continue
    return 0.0


def eligible_candidates(items: list[dict[str, Any]], posted_ids: set[str]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for it in items:
        stock_id = str(it.get("stockId") or "").strip()
        if not stock_id or stock_id in posted_ids:
            continue
        if str(it.get("status") or "").strip() != "Available":
            continue
        if not str(it.get("slug") or "").strip():
            continue
        if not has_postable_media(it):
            continue
        out.append(it)
    # Newest updates first, then photo quality — so new uploads join the front of the queue
    out.sort(key=lambda x: (-item_recency_ts(x), -labeled_photo_score(x), str(x.get("stockId") or "")))
    return out


def select_diverse(candidates: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    """Prefer newest + brand/category diversity."""
    picked: list[dict[str, Any]] = []
    used_brands: set[str] = set()
    used_cats: set[str] = set()

    def cat_key(it: dict[str, Any]) -> str:
        return part_type_label(it)

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

    if len(picked) < limit:
        for it in candidates:
            if len(picked) >= limit:
                break
            if it not in picked:
                picked.append(it)
    return picked[:limit]


def post_video(
    item: dict[str, Any],
    *,
    page_id: str,
    token: str,
    video_url: str,
    title: str,
    caption: str,
) -> str | None:
    try:
        resp = _graph_post(
            f"{page_id}/videos",
            token,
            {
                "file_url": video_url,
                "title": title[:255],
                "description": caption[:5000],
                "published": "true",
            },
            timeout=300,
        )
    except Exception as exc:
        log(f"  video upload failed ({video_url}): {exc}")
        return None
    vid = str(resp.get("id") or "").strip()
    if not vid:
        return None
    # Video publish returns video id; page post id is often {page_id}_{video_id}
    post_id = str(resp.get("post_id") or "").strip() or f"{page_id}_{vid}"
    log(f"  uploaded video {vid}")
    return post_id


def post_photos_feed(
    item: dict[str, Any],
    *,
    page_id: str,
    token: str,
    photos: list[dict[str, Any]],
    caption: str,
) -> str | None:
    if len(photos) == 1:
        url = photo_url(photos[0])
        try:
            resp = _graph_post(
                f"{page_id}/photos",
                token,
                {"url": url, "published": "true", "caption": caption[:5000]},
            )
        except Exception as exc:
            log(f"  single photo failed ({url}): {exc}")
            return None
        pid = str(resp.get("post_id") or resp.get("id") or "").strip()
        log(f"  uploaded single photo {resp.get('id')}")
        return pid or None

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

    if len(media_ids) < MIN_MEDIA:
        log(f"  skip {item.get('stockId')}: only {len(media_ids)} media uploaded (need ≥{MIN_MEDIA})")
        return None

    params: dict[str, Any] = {"message": caption}
    for i, mid in enumerate(media_ids):
        params[f"attached_media[{i}]"] = json.dumps({"media_fbid": mid})
    try:
        feed = _graph_post(f"{page_id}/feed", token, params)
    except Exception as exc:
        log(f"  feed post failed for {item.get('stockId')}: {exc}")
        return None
    return str(feed.get("id") or "").strip() or None


def post_link_only(
    item: dict[str, Any],
    *,
    page_id: str,
    token: str,
    caption: str,
    link: str,
) -> str | None:
    try:
        feed = _graph_post(
            f"{page_id}/feed",
            token,
            {"message": caption[:5000], "link": link},
        )
    except Exception as exc:
        log(f"  link post failed for {item.get('stockId')}: {exc}")
        return None
    return str(feed.get("id") or "").strip() or None


def post_listing(
    item: dict[str, Any],
    *,
    page_id: str,
    token: str,
    dry_run: bool = False,
    force_bad_url: bool = False,
) -> str | None:
    stock_id = str(item.get("stockId") or "")
    title = build_title(item)
    caption = build_caption(item)
    photos = pick_photos(item)
    video = self_hosted_video_url(item)
    yt = youtube_url(item)

    if force_bad_url:
        photos = [
            {**p, "url": f"/uploads/photos/__missing_force_404_{i}__.jpg"}
            for i, p in enumerate(photos)
        ]
        video = f"{SITE_PUBLIC}/uploads/videos/__missing_force_404__.mp4" if video else ""

    log(f"  title: {title}")
    log(f"  photos={len(photos)} video={'yes' if video else 'no'} youtube={'yes' if yt else 'no'}")
    log(f"  caption preview:\n{caption[:280]}{'…' if len(caption) > 280 else ''}")

    if dry_run:
        log("  dry-run: skip Graph API")
        return f"dry-run:{stock_id}"

    # Prefer real mp4 video post when available
    if video:
        post_id = post_video(
            item,
            page_id=page_id,
            token=token,
            video_url=video,
            title=title,
            caption=caption,
        )
        if post_id:
            return post_id
        log("  video post failed — falling back to photos/link")

    if photos:
        return post_photos_feed(
            item,
            page_id=page_id,
            token=token,
            photos=photos,
            caption=caption,
        )

    if yt:
        return post_link_only(item, page_id=page_id, token=token, caption=caption, link=yt)

    log(f"  skip {stock_id}: no usable media")
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description="AsiaPower Facebook hourly scheduled posts (2/run)")
    ap.add_argument("--limit", type=int, default=2, help="How many listings to post this run (default 2)")
    ap.add_argument("--delay", type=float, default=5.0, help="Seconds between posts (default 5)")
    ap.add_argument("--dry-run", action="store_true", help="Select + build captions only, no publish")
    ap.add_argument(
        "--simulate-bad-url",
        action="store_true",
        help="Force media URLs 404 on first candidate (validation; never marks posted on failure)",
    )
    ap.add_argument("--stock", action="append", default=[], help="Force include stockId(s) if eligible")
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
    want = {s.strip().upper() for s in (args.stock or []) if s.strip()}
    if want:
        forced = [c for c in candidates if str(c.get("stockId") or "").upper() in want]
        missing = want - {str(c.get("stockId") or "").upper() for c in forced}
        if missing:
            log(f"warn: --stock not eligible / already posted: {sorted(missing)}")
        others = [c for c in candidates if str(c.get("stockId") or "").upper() not in want]
        # Honor forced stockIds first (bypass brand diversity for explicit ops)
        fill_n = max(0, max(1, args.limit) - len(forced))
        selected = forced[: max(1, args.limit)] + select_diverse(others, fill_n)
        selected = selected[: max(1, args.limit)]
    else:
        if not candidates:
            log("本轮无新库存可发 (no unused Available listings with ≥1 photo or video)")
            return 0
        selected = select_diverse(candidates, max(1, args.limit))

    if not selected:
        log("本轮无新库存可发 (no unused Available listings with ≥1 photo or video)")
        return 0

    log(f"selected {len(selected)} / pool {len(candidates)}: {[x.get('stockId') for x in selected]}")

    ok_count = 0
    for i, item in enumerate(selected):
        stock_id = str(item.get("stockId") or "")
        # Hard guard: never post twice even if race
        if stock_id in posted_ids and not args.dry_run:
            log(f"[{i + 1}/{len(selected)}] skip {stock_id} — already in ledger")
            continue
        log(f"[{i + 1}/{len(selected)}] posting {stock_id} {build_title(item)}…")
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
            posted.append(
                {
                    "stockId": stock_id,
                    "post_id": post_id,
                    "ts": time.time(),
                    "title": build_title(item),
                }
            )
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

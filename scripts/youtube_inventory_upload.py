#!/usr/bin/env python3
"""Upload AsiaPower inventory startup videos to YouTube and patch half-cut JSON.

Prereq (one-time):
  1. Google Cloud: enable YouTube Data API v3 + add youtube.upload scope
  2. Prefer Desktop OAuth JSON at work/youtube-inventory-migrate/client_secret.json
     OR reuse site Web client with Authorized redirect URIs:
       http://127.0.0.1:8765/  and  http://localhost:8765/
  3. Run:  .venv/bin/python scripts/youtube_inventory_upload.py --auth
  4. Run:  .venv/bin/python scripts/youtube_inventory_upload.py --upload-all

Auto-sync (production):
  Node enqueues into reports/youtube-upload-queue.json after approve/promote.
  Worker:  .venv/bin/python scripts/youtube_inventory_upload.py --process-queue

Manual:
  .venv/bin/python scripts/youtube_inventory_upload.py --upload-stock HC250590
  .venv/bin/python scripts/youtube_inventory_upload.py --set-youtube HC250036=1VAdccf-VH8
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "work" / "youtube-inventory-migrate"
MANIFEST = WORK / "manifest.json"
TOKEN = WORK / "youtube-oauth-token.json"
CLIENT_SECRET = WORK / "client_secret.json"
RESULTS = WORK / "upload-results.json"
QUEUE_FILE = ROOT / "reports" / "youtube-upload-queue.json"
APPROVED_FILE = ROOT / "data" / "half-cut-approved.json"
CACHE_DIR = WORK / "cache"

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]
# Fixed port so a Web OAuth client can whitelist an exact redirect URI.
OAUTH_LOCAL_PORT = 8765
CJK_RE = re.compile(r"[\u4e00-\u9fff]+")
RETRYABLE_MARKERS = (
    "uploadLimitExceeded",
    "quotaExceeded",
    "rateLimitExceeded",
    "backendError",
    "internalError",
    "transient",
    "timed out",
    "Timeout",
    "503",
    "500",
)
def _public_base() -> str:
    return (os.getenv("PUBLIC_SITE_URL") or "https://asia-power.com").rstrip("/")


def _internal_base() -> str:
    return (
        os.getenv("INVENTORY_SITE_INTERNAL_URL")
        or os.getenv("YOUTUBE_VIDEO_FETCH_BASE")
        or "http://127.0.0.1:8080"
    ).rstrip("/")


def _r2_public_base() -> str:
    return (os.getenv("CLOUDFLARE_R2_PUBLIC_BASE") or "").rstrip("/")


def _download_ua() -> str:
    return (
        os.getenv("YOUTUBE_VIDEO_FETCH_UA")
        or "Mozilla/5.0 (compatible; AsiaPowerYouTubeSync/1.0; +https://asia-power.com/)"
    )


def _iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _load_dotenv() -> None:
    env = ROOT / ".env"
    if not env.is_file():
        return
    for line in env.read_text(encoding="utf-8", errors="ignore").splitlines():
        if not line or line.strip().startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip().strip("'").strip('"')
        if k and k not in os.environ:
            os.environ[k] = v


def ensure_client_secret() -> Path:
    """Accept Desktop (installed) or Web client JSON.

    Web client (site login) works only if Google Console has redirect URIs:
      http://127.0.0.1:8765/  and  http://localhost:8765/
    Never wrap a Web client as fake "installed" — Google rejects that.
    """
    if CLIENT_SECRET.is_file():
        try:
            data = json.loads(CLIENT_SECRET.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise SystemExit(f"Invalid JSON in {CLIENT_SECRET}: {exc}") from exc
        if "installed" in data:
            return CLIENT_SECRET
        if "web" in data:
            return CLIENT_SECRET
        raise SystemExit(
            f"{CLIENT_SECRET} must have top-level key 'installed' or 'web'.\n"
            "See: docs/ops/ops-youtube-oauth-desktop-setup.md"
        )

    cid = (os.getenv("GOOGLE_OAUTH_CLIENT_ID") or "").strip()
    csec = (os.getenv("GOOGLE_OAUTH_CLIENT_SECRET") or "").strip()
    if cid and csec:
        WORK.mkdir(parents=True, exist_ok=True)
        payload = {
            "web": {
                "client_id": cid,
                "client_secret": csec,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [
                    f"http://127.0.0.1:{OAUTH_LOCAL_PORT}/",
                    f"http://localhost:{OAUTH_LOCAL_PORT}/",
                ],
            }
        }
        CLIENT_SECRET.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print(
            "NOTE: Using site Web OAuth client. In Google Console → Credentials → "
            "this client → Authorized redirect URIs, add:\n"
            f"  http://127.0.0.1:{OAUTH_LOCAL_PORT}/\n"
            f"  http://localhost:{OAUTH_LOCAL_PORT}/"
        )
        return CLIENT_SECRET

    raise SystemExit(
        "Missing OAuth client for YouTube upload.\n"
        f"Put Desktop or Web client JSON at:\n  {CLIENT_SECRET}\n"
        "Guide: docs/ops/ops-youtube-oauth-desktop-setup.md"
    )


def get_credentials(*, force_auth: bool = False):
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow

    ensure_client_secret()
    data = json.loads(CLIENT_SECRET.read_text(encoding="utf-8"))
    is_web = "web" in data and "installed" not in data
    creds = None
    if TOKEN.is_file() and not force_auth:
        creds = Credentials.from_authorized_user_file(str(TOKEN), SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token and not force_auth:
            creds.refresh(Request())
            TOKEN.write_text(creds.to_json(), encoding="utf-8")
        else:
            flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT_SECRET), SCOPES)
            # Web clients need an exact whitelisted redirect; Desktop can use any port.
            port = OAUTH_LOCAL_PORT if is_web else 0
            creds = flow.run_local_server(
                port=port,
                prompt="consent",
                open_browser=True,
                bind_addr="127.0.0.1",
            )
        TOKEN.write_text(creds.to_json(), encoding="utf-8")
    return creds


def youtube_title(row: dict) -> str:
    if row.get("youtubeTitle"):
        return str(row["youtubeTitle"])[:100]
    brand = str(row.get("brand") or "").strip()
    model = str(row.get("model") or "").strip()
    model_en = model if model and not CJK_RE.search(model) else ""
    year = str(row.get("year") or "").strip()
    eng = str(row.get("engineCode") or "").strip()
    sid = str(row.get("stockId") or "").strip()
    bits = [sid, brand, model_en, year, eng, "Half Cut Startup Video", "| AsiaPower"]
    return re.sub(r"\s+", " ", " ".join(b for b in bits if b)).strip()[:100]


def youtube_description(row: dict) -> str:
    sid = row.get("stockId") or ""
    slug = str(row.get("slug") or "").strip()
    detail = row.get("detailPage") or (
        f"https://asia-power.com/half-cuts/detail.html?slug={slug}" if slug else "https://asia-power.com/half-cuts/"
    )
    return (
        f"AsiaPower inventory startup / walkthrough video for stock {sid}.\n"
        f"View listing: {detail}\n\n"
        "Whole-vehicle startup video available before dismantling. "
        "Half-cuts, engines and gearboxes for export from China.\n"
        "Website: https://asia-power.com/\n"
        "Business inquiry: sales@asia-power.com\n"
        "WhatsApp: +86 166 3880 1930"
    )


def load_manifest() -> list[dict]:
    if not MANIFEST.is_file():
        raise SystemExit(f"Missing manifest: {MANIFEST}")
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def _atomic_write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
            fh.write("\n")
        os.replace(tmp_name, path)
    except Exception:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise


def load_queue() -> dict:
    if not QUEUE_FILE.is_file():
        return {"version": 1, "items": []}
    try:
        data = json.loads(QUEUE_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"version": 1, "items": []}
    if not isinstance(data, dict):
        return {"version": 1, "items": []}
    data.setdefault("version", 1)
    data.setdefault("items", [])
    return data


def save_queue(data: dict) -> None:
    _atomic_write_json(QUEUE_FILE, data)


def load_approved(path: Path | None = None) -> list[dict]:
    p = path or Path(os.getenv("HALF_CUT_APPROVED_JSON") or APPROVED_FILE)
    if not p.is_file():
        raise SystemExit(f"Missing approved JSON: {p}")
    data = json.loads(p.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise SystemExit(f"Expected list in {p}")
    return data


def save_approved(items: list[dict], path: Path | None = None) -> None:
    p = path or Path(os.getenv("HALF_CUT_APPROVED_JSON") or APPROVED_FILE)
    bak = p.with_suffix(p.suffix + ".pre-youtube.bak")
    if not bak.is_file() and p.is_file():
        shutil.copy2(p, bak)
    _atomic_write_json(p, items)


def find_item(items: list[dict], stock_id: str) -> dict | None:
    want = stock_id.strip().upper()
    for it in items:
        if str(it.get("stockId") or "").upper() == want:
            return it
    return None


def item_video_url(item: dict) -> str:
    video = item.get("video") if isinstance(item.get("video"), dict) else {}
    url = str(item.get("videoUrl") or video.get("url") or "").strip().split("?")[0]
    return url


def apply_youtube_to_item(item: dict, youtube_id: str, *, source_local: str | None = None) -> None:
    url = f"https://www.youtube.com/watch?v={youtube_id}"
    video = item.get("video") if isinstance(item.get("video"), dict) else {}
    source = source_local or video.get("sourceLocalPath") or item_video_url(item)
    if source and ("youtube.com" in source or "youtu.be" in source):
        source = video.get("sourceLocalPath") or source_local
    item["videoUrl"] = url
    item["youtubeVideoId"] = youtube_id
    item["video"] = {
        "url": url,
        "fileName": "youtube",
        "mimeType": "video/youtube",
        "external": True,
        "youtubeId": youtube_id,
        "sourceLocalPath": source or None,
    }
    item["updatedAt"] = _iso_now()


def resolve_local_video(stock_id: str, local_video_url: str, item: dict) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    candidates: list[str] = []
    for raw in (
        local_video_url,
        item_video_url(item),
        (item.get("video") or {}).get("sourceLocalPath") if isinstance(item.get("video"), dict) else "",
    ):
        u = str(raw or "").strip().split("?")[0]
        if u and u not in candidates:
            candidates.append(u)

    for u in candidates:
        if u.startswith("/uploads/"):
            local = ROOT / u.lstrip("/")
            if local.is_file():
                return local
        elif u.startswith("uploads/"):
            local = ROOT / u
            if local.is_file():
                return local
        p = Path(u)
        if p.is_file():
            return p

    # Fallback: previously cached migrate files
    matches = list((WORK / "videos").glob(f"{stock_id}.*")) if (WORK / "videos").is_dir() else []
    if matches:
        return matches[0]

    # Download from internal site / R2 public / public site (hotlink may block bare UA)
    remotes: list[str] = []
    for u in candidates:
        if not u:
            continue
        if u.startswith("http://") or u.startswith("https://"):
            remotes.append(u)
            continue
        if not u.startswith("/uploads/"):
            continue
        remotes.append(f"{_internal_base()}{u}")
        r2_base = _r2_public_base()
        if r2_base:
            remotes.append(f"{r2_base}{u}")
        remotes.append(f"{_public_base()}{u}")

    # de-dupe preserving order
    seen: set[str] = set()
    ordered: list[str] = []
    for remote in remotes:
        if remote in seen:
            continue
        seen.add(remote)
        ordered.append(remote)

    errors: list[str] = []
    ua = _download_ua()
    for remote in ordered:
        ext = Path(remote.split("?")[0]).suffix or ".mp4"
        dest = CACHE_DIR / f"{stock_id}{ext}"
        print(f"download {stock_id} <- {remote}", flush=True)
        try:
            req = urllib.request.Request(remote, headers={"User-Agent": ua})
            with urllib.request.urlopen(req, timeout=120) as resp:  # noqa: S310
                data = resp.read()
            if len(data) < 1000:
                errors.append(f"{remote}: too small ({len(data)} bytes)")
                continue
            dest.write_bytes(data)
            return dest
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            errors.append(f"{remote}: {exc}")
            continue

    raise FileNotFoundError(
        f"No local/public video file for {stock_id}; tried={'; '.join(errors) or 'none'}"
    )


def upload_file(youtube, row: dict, local: Path) -> dict:
    from googleapiclient.http import MediaFileUpload

    sid = row["stockId"]
    body = {
        "snippet": {
            "title": youtube_title(row),
            "description": youtube_description(row),
            "tags": [
                "AsiaPower",
                "half cut",
                "used engine",
                "China export",
                str(row.get("brand") or ""),
                str(sid),
            ],
            "categoryId": "2",  # Autos & Vehicles
        },
        "status": {
            "privacyStatus": "public",
            "selfDeclaredMadeForKids": False,
        },
    }
    media = MediaFileUpload(str(local), resumable=True, chunksize=1024 * 1024)
    request = youtube.videos().insert(part="snippet,status", body=body, media_body=media)
    response = None
    while response is None:
        _status, response = request.next_chunk()
    vid = response["id"]
    return {
        "stockId": sid,
        "youtubeId": vid,
        "youtubeUrl": f"https://www.youtube.com/watch?v={vid}",
        "title": body["snippet"]["title"],
        "localFile": str(local),
    }


def upload_one(youtube, row: dict) -> dict:
    sid = row["stockId"]
    local = WORK / row.get("localFile", f"videos/{sid}.mp4")
    if not local.is_file():
        matches = list((WORK / "videos").glob(f"{sid}.*"))
        if not matches:
            raise FileNotFoundError(f"No local file for {sid}")
        local = matches[0]
    return upload_file(youtube, row, local)


def append_result(rec: dict) -> None:
    results: list[dict] = []
    if RESULTS.is_file():
        try:
            results = json.loads(RESULTS.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            results = []
    results = [r for r in results if r.get("stockId") != rec.get("stockId")]
    results.append(rec)
    _atomic_write_json(RESULTS, results)


def is_retryable(exc: BaseException) -> bool:
    text = repr(exc)
    return any(m in text for m in RETRYABLE_MARKERS)


def cmd_auth() -> int:
    _load_dotenv()
    get_credentials(force_auth=True)
    print("OK: YouTube OAuth token saved to", TOKEN)
    return 0


def cmd_upload_all(*, limit: int = 0) -> int:
    _load_dotenv()
    from googleapiclient.discovery import build

    creds = get_credentials(force_auth=False)
    youtube = build("youtube", "v3", credentials=creds)
    rows = load_manifest()
    if limit > 0:
        rows = rows[:limit]
    results = []
    if RESULTS.is_file():
        try:
            results = json.loads(RESULTS.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            results = []
    done = {r.get("stockId") for r in results if r.get("youtubeId")}
    for row in rows:
        sid = row["stockId"]
        if sid in done:
            print("skip", sid)
            continue
        print("upload", sid, youtube_title(row), flush=True)
        try:
            rec = upload_one(youtube, row)
            results.append(rec)
            RESULTS.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
            print("  ->", rec["youtubeUrl"], flush=True)
        except Exception as exc:
            print("  FAIL", sid, exc, flush=True)
            results.append({"stockId": sid, "error": repr(exc)})
            RESULTS.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    ok = sum(1 for r in results if r.get("youtubeId"))
    print(f"Done: {ok} uploaded (results: {RESULTS})")
    return 0


def cmd_patch_json(path: Path, *, dry_run: bool = False) -> int:
    if not RESULTS.is_file():
        raise SystemExit(f"Missing {RESULTS}")
    results = [r for r in json.loads(RESULTS.read_text(encoding="utf-8")) if r.get("youtubeId")]
    by_id = {r["stockId"]: r for r in results}
    items = json.loads(path.read_text(encoding="utf-8"))
    changed = 0
    for it in items:
        sid = it.get("stockId")
        rec = by_id.get(sid)
        if not rec:
            continue
        apply_youtube_to_item(it, rec["youtubeId"], source_local=item_video_url(it))
        changed += 1
    print(f"Patched {changed} items in {path}")
    if dry_run:
        return 0
    save_approved(items, path)
    print("Backup:", path.with_suffix(path.suffix + ".pre-youtube.bak"))
    return 0


def cmd_set_youtube(pairs: list[str], *, dry_run: bool = False) -> int:
    """Apply existing YouTube ids without re-upload. Format: STOCK=youtubeId"""
    _load_dotenv()
    approved_path = Path(os.getenv("HALF_CUT_APPROVED_JSON") or APPROVED_FILE)
    items = load_approved(approved_path)
    changed = 0
    for pair in pairs:
        if "=" not in pair:
            raise SystemExit(f"Bad --set-youtube value (want STOCK=id): {pair}")
        stock_id, yt_id = pair.split("=", 1)
        stock_id, yt_id = stock_id.strip().upper(), yt_id.strip()
        if not stock_id or not yt_id:
            raise SystemExit(f"Bad --set-youtube value: {pair}")
        item = find_item(items, stock_id)
        if not item:
            print(f"MISS {stock_id}", flush=True)
            continue
        apply_youtube_to_item(item, yt_id, source_local=item_video_url(item))
        append_result(
            {
                "stockId": stock_id,
                "youtubeId": yt_id,
                "youtubeUrl": f"https://www.youtube.com/watch?v={yt_id}",
                "title": youtube_title(item),
                "localFile": "set-youtube",
            }
        )
        print(f"SET {stock_id} -> https://www.youtube.com/watch?v={yt_id}", flush=True)
        changed += 1
    if not dry_run and changed:
        save_approved(items, approved_path)
    print(f"Done: set {changed}")
    return 0 if changed else 1


def _upload_stock_item(youtube, stock_id: str, *, local_video_url: str = "") -> dict:
    approved_path = Path(os.getenv("HALF_CUT_APPROVED_JSON") or APPROVED_FILE)
    items = load_approved(approved_path)
    item = find_item(items, stock_id)
    if not item:
        raise SystemExit(f"Stock not found in approved JSON: {stock_id}")
    existing = str(item.get("youtubeVideoId") or (item.get("video") or {}).get("youtubeId") or "").strip()
    if existing:
        url = f"https://www.youtube.com/watch?v={existing}"
        print(f"skip {stock_id} already {url}", flush=True)
        return {
            "stockId": stock_id,
            "youtubeId": existing,
            "youtubeUrl": url,
            "skipped": True,
        }

    local = resolve_local_video(stock_id, local_video_url, item)
    print("upload", stock_id, youtube_title(item), flush=True)
    rec = upload_file(youtube, item, local)
    apply_youtube_to_item(item, rec["youtubeId"], source_local=str(local_video_url or item_video_url(item)))
    save_approved(items, approved_path)
    append_result(rec)
    print("  ->", rec["youtubeUrl"], flush=True)
    return rec


def cmd_upload_stock(stock_id: str) -> int:
    _load_dotenv()
    from googleapiclient.discovery import build

    creds = get_credentials(force_auth=False)
    youtube = build("youtube", "v3", credentials=creds)
    _upload_stock_item(youtube, stock_id.strip().upper())
    return 0


def cmd_process_queue(*, batch: int = 1) -> int:
    _load_dotenv()
    from googleapiclient.discovery import build

    queue = load_queue()
    now = datetime.now(timezone.utc)
    due: list[dict] = []
    for item in queue.get("items") or []:
        if item.get("status") != "pending":
            continue
        nxt = item.get("nextRetryAt")
        if nxt:
            try:
                ts = datetime.fromisoformat(str(nxt).replace("Z", "+00:00"))
                if ts > now:
                    continue
            except ValueError:
                pass
        due.append(item)
        if len(due) >= max(1, batch):
            break

    if not due:
        print("queue empty / nothing due", flush=True)
        return 0

    creds = get_credentials(force_auth=False)
    youtube = build("youtube", "v3", credentials=creds)
    processed = 0

    for qitem in due:
        sid = str(qitem.get("stockId") or "").strip().upper()
        if not sid:
            qitem["status"] = "failed"
            qitem["lastError"] = "missing stockId"
            continue
        qitem["status"] = "processing"
        qitem["attempts"] = int(qitem.get("attempts") or 0) + 1
        qitem["startedAt"] = _iso_now()
        save_queue(queue)
        try:
            rec = _upload_stock_item(youtube, sid, local_video_url=str(qitem.get("localVideoUrl") or ""))
            qitem["status"] = "done"
            qitem["youtubeId"] = rec.get("youtubeId")
            qitem["youtubeUrl"] = rec.get("youtubeUrl")
            qitem["finishedAt"] = _iso_now()
            qitem["lastError"] = ""
            qitem["nextRetryAt"] = None
            processed += 1
        except Exception as exc:  # noqa: BLE001 — queue must absorb API failures
            err = repr(exc)
            print(f"  FAIL {sid} {err}", flush=True)
            qitem["lastError"] = err[:800]
            qitem["finishedAt"] = _iso_now()
            if is_retryable(exc) and int(qitem.get("attempts") or 0) < 12:
                delay_h = min(12, 2 ** max(0, int(qitem["attempts"]) - 1))
                qitem["status"] = "pending"
                qitem["nextRetryAt"] = (now + timedelta(hours=delay_h)).replace(microsecond=0).isoformat().replace(
                    "+00:00", "Z"
                )
            else:
                qitem["status"] = "failed"
        save_queue(queue)
        # Be gentle with YouTube quota between items
        if processed and processed < len(due):
            time.sleep(2)

    print(f"Processed {processed} queue item(s)", flush=True)
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Upload inventory videos to YouTube")
    p.add_argument("--auth", action="store_true", help="Run OAuth browser consent once")
    p.add_argument("--upload-all", action="store_true", help="Upload all manifest videos")
    p.add_argument("--upload-stock", metavar="STOCK_ID", help="Upload one approved stock video")
    p.add_argument("--process-queue", action="store_true", help="Drain reports/youtube-upload-queue.json")
    p.add_argument("--batch", type=int, default=1, help="Max queue items per --process-queue run")
    p.add_argument("--limit", type=int, default=0, help="Upload at most N (debug)")
    p.add_argument("--patch-json", type=Path, help="Write youtube URLs into half-cut-approved.json")
    p.add_argument(
        "--set-youtube",
        action="append",
        default=[],
        metavar="STOCK=ID",
        help="Patch existing YouTube id without upload (repeatable)",
    )
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args(argv)
    WORK.mkdir(parents=True, exist_ok=True)
    if args.auth:
        return cmd_auth()
    if args.upload_all:
        return cmd_upload_all(limit=args.limit)
    if args.upload_stock:
        return cmd_upload_stock(args.upload_stock)
    if args.process_queue:
        return cmd_process_queue(batch=args.batch)
    if args.set_youtube:
        return cmd_set_youtube(args.set_youtube, dry_run=args.dry_run)
    if args.patch_json:
        return cmd_patch_json(args.patch_json, dry_run=args.dry_run)
    p.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Upload AsiaPower inventory startup videos to YouTube and patch half-cut JSON.

Prereq (one-time):
  1. Google Cloud: enable YouTube Data API v3 + add youtube.upload scope
  2. Prefer Desktop OAuth JSON at work/youtube-inventory-migrate/client_secret.json
     OR reuse site Web client with Authorized redirect URIs:
       http://127.0.0.1:8765/  and  http://localhost:8765/
  3. Run:  .venv/bin/python scripts/youtube_inventory_upload.py --auth
  4. Run:  .venv/bin/python scripts/youtube_inventory_upload.py --upload-all

Then apply mapping to production inventory:
  .venv/bin/python scripts/youtube_inventory_upload.py --patch-json /path/to/half-cut-approved.json
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "work" / "youtube-inventory-migrate"
MANIFEST = WORK / "manifest.json"
TOKEN = WORK / "youtube-oauth-token.json"
CLIENT_SECRET = WORK / "client_secret.json"
RESULTS = WORK / "upload-results.json"

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]
# Fixed port so a Web OAuth client can whitelist an exact redirect URI.
OAUTH_LOCAL_PORT = 8765
CJK_RE = re.compile(r"[\u4e00-\u9fff]+")


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
    detail = row.get("detailPage") or "https://asia-power.com/half-cuts/"
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


def upload_one(youtube, row: dict) -> dict:
    from googleapiclient.http import MediaFileUpload

    sid = row["stockId"]
    local = WORK / row.get("localFile", f"videos/{sid}.mp4")
    if not local.is_file():
        # try any extension
        matches = list((WORK / "videos").glob(f"{sid}.*"))
        if not matches:
            raise FileNotFoundError(f"No local file for {sid}")
        local = matches[0]
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
        "localFile": str(local.relative_to(WORK)),
    }


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
        url = rec["youtubeUrl"]
        it["videoUrl"] = url
        it["video"] = {
            "url": url,
            "fileName": "youtube",
            "mimeType": "video/youtube",
            "external": True,
            "youtubeId": rec["youtubeId"],
            "sourceLocalPath": it.get("video", {}).get("url") if isinstance(it.get("video"), dict) else None,
        }
        changed += 1
    print(f"Patched {changed} items in {path}")
    if dry_run:
        return 0
    bak = path.with_suffix(path.suffix + ".pre-youtube.bak")
    if not bak.is_file():
        bak.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
        print("Backup:", bak)
    path.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Upload inventory videos to YouTube")
    p.add_argument("--auth", action="store_true", help="Run OAuth browser consent once")
    p.add_argument("--upload-all", action="store_true", help="Upload all manifest videos")
    p.add_argument("--limit", type=int, default=0, help="Upload at most N (debug)")
    p.add_argument("--patch-json", type=Path, help="Write youtube URLs into half-cut-approved.json")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args(argv)
    WORK.mkdir(parents=True, exist_ok=True)
    if args.auth:
        return cmd_auth()
    if args.upload_all:
        return cmd_upload_all(limit=args.limit)
    if args.patch_json:
        return cmd_patch_json(args.patch_json, dry_run=args.dry_run)
    p.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

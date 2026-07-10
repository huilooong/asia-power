"""Official API posting for Meta (FB/IG) and X — preferred over browser automation."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


class SocialApiError(Exception):
    pass


def _http_json(method: str, url: str, *, headers: dict | None = None, body: dict | None = None) -> dict:
    data = None
    req_headers = {"Accept": "application/json", **(headers or {})}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        req_headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise SocialApiError(f"HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise SocialApiError(str(exc)) from exc


def meta_graph_post(path: str, params: dict[str, str]) -> dict:
    token = os.getenv("META_PAGE_ACCESS_TOKEN", "").strip()
    if not token:
        raise SocialApiError("META_PAGE_ACCESS_TOKEN not set")
    base = os.getenv("META_GRAPH_API_BASE", "https://graph.facebook.com/v21.0").rstrip("/")
    query = urllib.parse.urlencode({**params, "access_token": token})
    url = f"{base}/{path.lstrip('/')}?{query}"
    return _http_json("POST", url)


def post_facebook(*, message: str, link: str = "", image_url: str = "", image_urls: list[str] | None = None) -> dict[str, Any]:
    page_id = os.getenv("META_PAGE_ID", "").strip()
    if not page_id:
        raise SocialApiError("META_PAGE_ID not set")
    params: dict[str, str] = {"message": message}
    all_images = [u for u in (image_urls or ([image_url] if image_url else [])) if u]
    if all_images:
        params["url"] = all_images[0]
        result = meta_graph_post(f"{page_id}/photos", params)
    elif link:
        params["link"] = link
        result = meta_graph_post(f"{page_id}/feed", params)
    else:
        result = meta_graph_post(f"{page_id}/feed", params)
    post_id = result.get("id") or result.get("post_id") or ""
    post_url = f"https://www.facebook.com/{post_id}" if post_id else ""
    return {"ok": True, "platform": "facebook", "post_id": post_id, "post_url": post_url, "raw": result}


def post_instagram(*, caption: str, image_url: str) -> dict[str, Any]:
    ig_user = os.getenv("META_IG_USER_ID", "").strip()
    if not ig_user:
        raise SocialApiError("META_IG_USER_ID not set")
    if not image_url:
        raise SocialApiError("Instagram requires image_url")
    create = meta_graph_post(
        f"{ig_user}/media",
        {"image_url": image_url, "caption": caption},
    )
    creation_id = create.get("id")
    if not creation_id:
        raise SocialApiError(f"IG media create failed: {create}")
    publish = meta_graph_post(f"{ig_user}/media_publish", {"creation_id": creation_id})
    media_id = publish.get("id") or creation_id
    post_url = f"https://www.instagram.com/p/{media_id}/" if media_id else ""
    return {
        "ok": True,
        "platform": "instagram",
        "post_id": media_id,
        "post_url": post_url,
        "raw": publish,
    }


def post_x(*, text: str) -> dict[str, Any]:
    token = os.getenv("X_API_BEARER_TOKEN", "").strip()
    if not token:
        raise SocialApiError("X_API_BEARER_TOKEN not set")
    base = os.getenv("X_API_BASE", "https://api.twitter.com/2").rstrip("/")
    url = f"{base}/tweets"
    result = _http_json(
        "POST",
        url,
        headers={"Authorization": f"Bearer {token}"},
        body={"text": text[:280]},
    )
    tweet_id = (result.get("data") or {}).get("id") or ""
    post_url = f"https://x.com/i/web/status/{tweet_id}" if tweet_id else ""
    return {"ok": True, "platform": "x", "post_id": tweet_id, "post_url": post_url, "raw": result}


def post_via_api(platform: str, *, message: str, link: str = "", image_urls: list[str] | None = None) -> dict[str, Any]:
    key = (platform or "").strip().lower()
    images = image_urls or []
    if key == "facebook":
        return post_facebook(message=message, link=link, image_urls=images)
    if key == "instagram":
        return post_instagram(caption=message, image_url=images[0] if images else "")
    if key in ("x", "twitter"):
        body = message
        if link and link not in body:
            body = f"{body}\n{link}".strip()
        return post_x(text=body[:280])
    raise SocialApiError(f"Unsupported platform: {platform}")

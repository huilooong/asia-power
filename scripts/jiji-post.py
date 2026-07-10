#!/usr/bin/env python3
"""Post free classified ads to Jiji Ghana (jiji.com.gh) and Nigeria (jiji.ng).

Uses Jiji's internal web API (api_web/v1) discovered from their Nuxt frontend.
Requires a registered Jiji account — set JIJI_EMAIL and JIJI_PASSWORD below or in .env.

Registration (one account works per country — register separately on each site):
  Ghana:  https://jiji.com.gh/registration.html
  Nigeria: https://jiji.ng/registration.html
  Steps: click Registration → enter email + password + name → verify email/phone if prompted.

Usage:
  .venv/bin/python3 scripts/jiji-post.py              # post to both sites (needs credentials)
  .venv/bin/python3 scripts/jiji-post.py --probe      # API connectivity test only
  .venv/bin/python3 scripts/jiji-post.py --site gh    # Ghana only
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent

# --- Credentials (override via environment or .env) ---
JIJI_EMAIL = os.environ.get("JIJI_EMAIL", "")
JIJI_PASSWORD = os.environ.get("JIJI_PASSWORD", "")

# --- Ad content ---
AD_TITLE = "Used Engines & Auto Parts from China — AsiaPower"
AD_DESCRIPTION = (
    "AsiaPower exports used Japanese & Korean engines, half-cuts, gearboxes and auto parts "
    "from China to Ghana/Nigeria. Verified stock, export docs, same-day WhatsApp quotes. "
    "Visit: www.asia-power.com or WhatsApp: +86 186 0377 3077"
)
# Jiji category: Vehicles > Vehicle Parts & Accessories (slug: car-parts-and-accessories)
AD_CATEGORY_ID = 54
AD_CATEGORY_LABEL = "Auto Parts & Accessories (Vehicle Parts & Accessories)"
AD_PRICE_LABEL = "Contact for price"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

SITES: dict[str, dict[str, Any]] = {
    "gh": {
        "label": "Jiji Ghana",
        "base": "https://jiji.com.gh",
        "region_id": 1537,  # Greater Accra
        "region_label": "Greater Accra",
    },
    "ng": {
        "label": "Jiji Nigeria",
        "base": "https://jiji.ng",
        "region_id": 119,  # Lagos State
        "region_label": "Lagos State",
    },
}

RESULT_PATH = ROOT / "docs/agent-reports/jiji-post-result.md"

# Price type key used by Jiji frontend for "Contact for price"
PRICE_TYPE_CONTACT = "contact_for_price"


@dataclass
class SiteResult:
    site_key: str
    label: str
    base: str
    ok: bool = False
    stage: str = "init"
    message: str = ""
    advert_id: int | None = None
    listing_url: str = ""
    details: dict[str, Any] = field(default_factory=dict)


class JijiClient:
    """Minimal Jiji web API client (requests + session cookies + CSRF)."""

    def __init__(self, base_url: str) -> None:
        self.base = base_url.rstrip("/")
        self.session = requests.Session()
        self.csrf_token: str | None = None
        self.user_id: int | None = None

    def _headers(self, referer_path: str = "/") -> dict[str, str]:
        h = {
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
            "Referer": f"{self.base}{referer_path}",
            "Origin": self.base,
        }
        if self.csrf_token:
            h["X-CSRF-Token"] = self.csrf_token
        return h

    def _get_json(self, path: str, *, params: dict | None = None, referer: str = "/") -> Any:
        r = self.session.get(
            f"{self.base}{path}",
            headers=self._headers(referer),
            params=params,
            timeout=45,
        )
        r.raise_for_status()
        if "application/json" in r.headers.get("Content-Type", ""):
            return r.json()
        return {"_raw": r.text[:500], "_status": r.status_code}

    def _post_json(self, path: str, body: dict, *, referer: str = "/") -> Any:
        r = self.session.post(
            f"{self.base}{path}",
            headers={**self._headers(referer), "Content-Type": "application/json"},
            json=body,
            timeout=45,
        )
        if r.headers.get("Content-Type", "").startswith("application/json"):
            return r.json(), r.status_code
        return {"_raw": r.text[:500]}, r.status_code

    def _post_form(self, path: str, form: dict, files: dict | None = None, *, referer: str = "/") -> Any:
        r = self.session.post(
            f"{self.base}{path}",
            headers=self._headers(referer),
            data=form,
            files=files,
            timeout=120,
        )
        r.raise_for_status()
        if r.headers.get("Content-Type", "").startswith("application/json"):
            return r.json()
        return {"_raw": r.text[:500]}

    def bootstrap(self) -> str:
        """Warm cookies + fetch CSRF token."""
        self.session.get(self.base, headers={"User-Agent": USER_AGENT}, timeout=30)
        data = self._get_json("/api_web/v0/start_spa_data", referer="/")
        token = (data.get("data") or {}).get("token")
        if not token:
            raise RuntimeError("Could not obtain CSRF token from start_spa_data")
        self.csrf_token = token
        return token

    def probe_sign_in(self) -> dict[str, Any]:
        """Test sign-in endpoint with dummy credentials (expects auth error, not CSRF error)."""
        body, status = self._post_json(
            "/api_web/v1/sign-in",
            {"email": "probe-invalid@example.com", "password": "invalid"},
            referer="/login.html",
        )
        return {"http_status": status, "body": body}

    def login(self, email: str, password: str) -> None:
        body, status = self._post_json(
            "/api_web/v1/sign-in",
            {"email": email, "password": password},
            referer="/login.html",
        )
        if status != 200:
            raise RuntimeError(f"Login HTTP {status}: {body}")
        if body.get("status") == "ok":
            user = body.get("user") or body.get("data", {}).get("user") or {}
            self.user_id = user.get("id")
            return
        err = body.get("error") or body.get("message") or str(body)
        raise RuntimeError(f"Login failed: {err}")

    def fetch_create_data(self) -> dict[str, Any]:
        data = self._get_json("/api_web/v1/item-create/add.json", referer="/add-free-ad.html")
        if data.get("result") == "err":
            raise RuntimeError(data.get("message") or "item-create/add.json error")
        if data.get("status") != "ok":
            raise RuntimeError(f"Unexpected add.json response: {data}")
        return data

    def fetch_form_fields(self, advert_id: int, category_id: int, title: str) -> dict[str, Any]:
        data = self._get_json(
            "/api_web/v1/item-create/form_fields.json",
            params={"advert_id": advert_id, "category_id": category_id, "title": title},
            referer="/add-free-ad.html",
        )
        if not data or data.get("result") == "err":
            raise RuntimeError(data.get("message") or "form_fields.json error")
        return data

    def upload_image(self, advert_id: int, category_id: int, image_path: Path) -> dict[str, Any]:
        mime, _ = mimetypes.guess_type(str(image_path))
        with image_path.open("rb") as fh:
            files = {"advert_image": (image_path.name, fh, mime or "image/jpeg")}
            form = {"category_id": str(category_id)}
            return self._post_form(
                f"/image-upload/{advert_id}",
                form,
                files=files,
                referer="/add-free-ad.html",
            )

    def create_advert(self, post_url: str, payload: dict[str, Any]) -> dict[str, Any]:
        if post_url.startswith("http"):
            url = post_url
        else:
            url = f"{self.base}{post_url if post_url.startswith('/') else '/' + post_url}"
        r = self.session.post(
            url,
            headers={**self._headers("/add-free-ad.html"), "Content-Type": "application/json"},
            json=payload,
            timeout=60,
        )
        if r.headers.get("Content-Type", "").startswith("application/json"):
            return r.json()
        return {"_raw": r.text[:800], "_status": r.status_code}


def _pick_contact_price_type(price_field: dict[str, Any]) -> int | str | None:
    price_types = price_field.get("price_type") or {}
    if isinstance(price_types, dict):
        if PRICE_TYPE_CONTACT in price_types:
            return PRICE_TYPE_CONTACT
        for key, meta in price_types.items():
            label = (meta or {}).get("label") or (meta or {}).get("title") or ""
            if "contact" in str(label).lower():
                return key
        # fallback: first key
        if price_types:
            return next(iter(price_types.keys()))
    return PRICE_TYPE_CONTACT


def build_field_payload(fields: list[dict[str, Any]], *, description: str) -> dict[str, Any]:
    """Mirror Jiji frontend field serializer (Ll) — flat name→value for POST body."""
    out: dict[str, Any] = {}

    select_types = {"single_select", "multi_select", "radio"}

    def walk(field_list: list[dict[str, Any]]) -> None:
        for f in field_list:
            name = f.get("name")
            input_type = f.get("input_type") or ""
            value = f.get("value")

            if input_type in select_types:
                if isinstance(value, list):
                    out[name] = [v.get("id_name") if isinstance(v, dict) else v for v in value]
                elif isinstance(value, dict):
                    out[name] = value.get("id_name")
                elif f.get("possible_values"):
                    pv = f["possible_values"][0]
                    out[name] = pv.get("id_name") if isinstance(pv, dict) else pv
                continue

            if input_type == "group" and isinstance(value, list):
                walk(value)
                continue

            if input_type == "price":
                contact_key = _pick_contact_price_type(f)
                out["price_type"] = contact_key
                if contact_key != PRICE_TYPE_CONTACT and value not in (None, ""):
                    out["price"] = value
                if f.get("price_period"):
                    pp = f["price_period"]
                    pv = pp.get("value") or {}
                    out[pp.get("name", "price_period")] = pv.get("id") if isinstance(pv, dict) else pv
                continue

            if input_type == "textarea" and name in ("description", "body", "desc"):
                out[name] = description
                continue

            if input_type in ("input", "textarea") and name and value not in (None, ""):
                out[name] = value
                continue

            if name and value not in (None, "", []):
                out[name] = value

    walk(fields)
    return out


def apply_ad_content(fields: list[dict[str, Any]], *, title: str, description: str) -> list[dict[str, Any]]:
    """Set title/description/price on schema fields returned by form_fields.json."""
    updated = []
    for f in fields:
        f = dict(f)
        name = f.get("name")
        input_type = f.get("input_type") or ""

        if name == "title" or (input_type == "input" and "title" in (f.get("label") or "").lower()):
            f["value"] = title
        elif name in ("description", "body", "desc") or input_type == "textarea":
            if name in ("description", "body", "desc", None) or "desc" in (name or ""):
                f["value"] = description
        elif input_type == "price":
            pt = dict(f.get("price_type") or {})
            for key in pt:
                pt[key] = dict(pt[key]) if isinstance(pt[key], dict) else pt[key]
                if isinstance(pt[key], dict):
                    pt[key]["checked"] = key == PRICE_TYPE_CONTACT or "contact" in key
            if PRICE_TYPE_CONTACT in pt and isinstance(pt[PRICE_TYPE_CONTACT], dict):
                pt[PRICE_TYPE_CONTACT]["checked"] = True
            elif pt:
                first = next(iter(pt))
                if isinstance(pt[first], dict):
                    pt[first]["checked"] = "contact" in first
            f["price_type"] = pt
            f["value"] = ""
        updated.append(f)
    return updated


def find_default_image() -> Path | None:
    candidates = [
        ROOT / "assets/logo.png",
        ROOT / "assets/logo.svg",
    ]
    for p in candidates:
        if p.exists() and p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}:
            return p
    return None


def post_to_site(site_key: str, *, email: str, password: str, image_path: Path | None, probe_only: bool) -> SiteResult:
    cfg = SITES[site_key]
    res = SiteResult(site_key=site_key, label=cfg["label"], base=cfg["base"])

    client = JijiClient(cfg["base"])
    try:
        token = client.bootstrap()
        res.details["csrf_ok"] = bool(token)
        res.stage = "bootstrap"

        probe = client.probe_sign_in()
        res.details["sign_in_probe"] = probe
        if probe_only:
            ok = probe.get("http_status") == 200 and "CSRF" not in str(probe.get("body", ""))
            res.ok = ok
            res.stage = "probe"
            res.message = "API reachable; sign-in endpoint accepts CSRF (credentials not tested)" if ok else str(probe)
            return res

        if not email or not password:
            res.stage = "credentials"
            res.message = "JIJI_EMAIL / JIJI_PASSWORD not set — cannot login"
            return res

        client.login(email, password)
        res.stage = "login"
        res.details["user_id"] = client.user_id

        create_data = client.fetch_create_data()
        params = create_data.get("params") or {}
        advert_id = params.get("advert_id")
        post_url = params.get("modify_advert_url") or create_data.get("modify_advert_url")
        if not advert_id or not post_url:
            raise RuntimeError(f"Missing advert_id/post_url in add.json: {create_data}")

        res.advert_id = advert_id
        res.details["post_url"] = post_url

        form_data = client.fetch_form_fields(advert_id, AD_CATEGORY_ID, AD_TITLE)
        fields = form_data.get("fields") or []
        required_photos = form_data.get("required_count_photos_by_category") or 2
        res.details["required_photos"] = required_photos
        res.details["field_names"] = [f.get("name") for f in fields]

        fields = apply_ad_content(fields, title=AD_TITLE, description=AD_DESCRIPTION)
        attr_payload = build_field_payload(fields, description=AD_DESCRIPTION)

        payload: dict[str, Any] = {
            "category_id": AD_CATEGORY_ID,
            "region_id": cfg["region_id"],
            "title": AD_TITLE,
            **attr_payload,
            "save_delivery": False,
        }

        pkg = form_data.get("package_fields") or {}
        packages = pkg.get("packages") or []
        free_pkg = next((p for p in packages if p.get("package_id") == "free_post"), None)
        if free_pkg:
            payload["paid_package"] = "free_post"

        images_uploaded = 0
        if image_path and image_path.exists():
            try:
                up = client.upload_image(advert_id, AD_CATEGORY_ID, image_path)
                res.details["image_upload"] = up
                if up.get("image_id") or up.get("src"):
                    images_uploaded = 1
            except Exception as exc:
                res.details["image_upload_error"] = str(exc)

        if images_uploaded < required_photos:
            res.stage = "photos"
            res.message = (
                f"Login OK, form ready, but Jiji requires ≥{required_photos} photo(s). "
                f"Uploaded {images_uploaded}. Provide --image with a JPG/PNG (run twice or add more images)."
            )
            res.details["payload_preview"] = payload
            return res

        create_resp = client.create_advert(post_url, payload)
        res.details["create_response"] = create_resp

        status = create_resp.get("status")
        content = create_resp.get("content") or create_resp
        if status == "ok" or content.get("url"):
            res.ok = True
            res.stage = "posted"
            res.listing_url = content.get("url") or create_resp.get("url") or ""
            res.message = "Ad posted successfully"
        elif create_resp.get("errors") or content.get("errors"):
            res.stage = "validation"
            res.message = f"Server validation errors: {content.get('errors') or create_resp.get('errors')}"
        else:
            res.stage = "create"
            res.message = f"Unexpected create response: {json.dumps(create_resp)[:400]}"

    except Exception as exc:
        res.message = str(exc)
        res.details["error_type"] = type(exc).__name__

    return res


def verify_public_listing(url: str) -> dict[str, Any]:
    if not url:
        return {"checked": False}
    try:
        r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
        soup = BeautifulSoup(r.text, "html.parser")
        title = soup.find("h1")
        return {
            "checked": True,
            "http_status": r.status_code,
            "title": title.get_text(strip=True) if title else None,
            "ok": r.status_code == 200 and AD_TITLE[:20] in (title.get_text() if title else ""),
        }
    except Exception as exc:
        return {"checked": True, "error": str(exc)}


def write_report(results: list[SiteResult], *, probe_only: bool) -> None:
    RESULT_PATH.parent.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "# Jiji Post Result",
        "",
        f"**Run time:** {now}",
        f"**Mode:** {'probe (API only)' if probe_only else 'full post attempt'}",
        f"**Script:** `scripts/jiji-post.py`",
        "",
        "## Ad content",
        "",
        f"| Field | Value |",
        f"|-------|-------|",
        f"| Title | {AD_TITLE} |",
        f"| Description | {AD_DESCRIPTION[:80]}… |",
        f"| Category | {AD_CATEGORY_LABEL} (id={AD_CATEGORY_ID}) |",
        f"| Price | {AD_PRICE_LABEL} |",
        "",
        "## Registration (if you don't have an account)",
        "",
        "1. Open **Ghana:** https://jiji.com.gh/registration.html or **Nigeria:** https://jiji.ng/registration.html",
        "2. Click **Registration**, enter email, password, first/last name.",
        "3. Verify email or phone if Jiji prompts you.",
        "4. Export credentials:",
        "   ```bash",
        "   export JIJI_EMAIL='your@email.com'",
        "   export JIJI_PASSWORD='your-password'",
        "   ```",
        "5. Re-run: `.venv/bin/python3 scripts/jiji-post.py`",
        "",
        "> Note: Ghana and Nigeria are separate Jiji markets — you may need one account per site.",
        "",
        "## Results",
        "",
    ]

    for r in results:
        lines.append(f"### {r.label} ({r.base})")
        lines.append("")
        lines.append(f"| Item | Value |")
        lines.append(f"|------|-------|")
        lines.append(f"| Status | {'✅ Success' if r.ok else '❌ Failed'} |")
        lines.append(f"| Stage | {r.stage} |")
        lines.append(f"| Message | {r.message} |")
        if r.advert_id:
            lines.append(f"| Draft advert ID | {r.advert_id} |")
        if r.listing_url:
            lines.append(f"| Listing URL | {r.listing_url} |")
            verify = verify_public_listing(r.listing_url)
            lines.append(f"| Public page check | {verify} |")
        lines.append("")
        if r.details:
            lines.append("<details><summary>Technical details</summary>")
            lines.append("")
            lines.append("```json")
            lines.append(json.dumps(r.details, indent=2, ensure_ascii=False)[:6000])
            lines.append("```")
            lines.append("")
            lines.append("</details>")
            lines.append("")

    lines.extend([
        "## API notes (for engineers)",
        "",
        "- Bootstrap: `GET /api_web/v0/start_spa_data` → CSRF token in `data.token`",
        "- Login: `POST /api_web/v1/sign-in` with header `X-CSRF-Token` + `Referer`",
        "- Create flow: `GET /api_web/v1/item-create/add.json` → `advert_id`, `modify_advert_url`",
        "- Form: `GET /api_web/v1/item-create/form_fields.json?category_id=54&title=...`",
        "- Photos: `POST /image-upload/{advert_id}` (multipart, field `advert_image`)",
        "- Submit: `POST {modify_advert_url}` with JSON payload",
        "",
        "## Next steps",
        "",
        "1. Set `JIJI_EMAIL` / `JIJI_PASSWORD` and re-run without `--probe`.",
        "2. Pass `--image /path/to/product.jpg` (Jiji typically requires ≥2 photos).",
        "3. Confirm listing appears under *My Adverts* on each Jiji site.",
        "",
    ])

    RESULT_PATH.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    try:
        from dotenv import load_dotenv
        load_dotenv(ROOT / ".env")
    except ImportError:
        pass

    global JIJI_EMAIL, JIJI_PASSWORD
    JIJI_EMAIL = os.environ.get("JIJI_EMAIL", JIJI_EMAIL)
    JIJI_PASSWORD = os.environ.get("JIJI_PASSWORD", JIJI_PASSWORD)

    parser = argparse.ArgumentParser(description="Post AsiaPower ad to Jiji Ghana & Nigeria")
    parser.add_argument("--site", choices=["gh", "ng", "both"], default="both")
    parser.add_argument("--probe", action="store_true", help="API connectivity test only (no login/post)")
    parser.add_argument("--image", type=Path, help="Product image for listing (Jiji requires multiple photos)")
    args = parser.parse_args()

    sites = ["gh", "ng"] if args.site == "both" else [args.site]
    image = args.image or find_default_image()

    results = [
        post_to_site(sk, email=JIJI_EMAIL, password=JIJI_PASSWORD, image_path=image, probe_only=args.probe)
        for sk in sites
    ]
    write_report(results, probe_only=args.probe)

    print(f"Report written to {RESULT_PATH}")
    for r in results:
        icon = "OK" if r.ok else "FAIL"
        print(f"  [{icon}] {r.label}: {r.stage} — {r.message[:120]}")

    return 0 if all(r.ok for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())

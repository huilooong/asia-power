"""Google Maps prospecting — fallback when FB/social is blocked or idle."""

from __future__ import annotations

import hashlib
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
CONFIG_FILE = ROOT / "config" / "apsales_maps_prospect.yaml"
LEADS_FILE = ROOT / "memory" / "customer_gateway" / "maps_leads.jsonl"
STATE_FILE = ROOT / "memory" / "customer_gateway" / "maps_prospect_state.json"

_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _load_yaml(path: Path) -> dict[str, Any]:
    try:
        import yaml  # type: ignore

        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def load_maps_config() -> dict[str, Any]:
    if CONFIG_FILE.is_file():
        cfg = _load_yaml(CONFIG_FILE)
        if cfg:
            return cfg
    return {
        "daily_caps": {"leads": 10, "email_drafts": 5},
        "markets": [],
        "ceo_voice": {},
        "search": {"max_results_per_query": 5},
        "email": {"only_with_email": True},
    }


def _load_state() -> dict[str, Any]:
    if not STATE_FILE.is_file():
        return {"date": _today(), "leads_today": 0, "drafts_today": 0, "seen_keys": []}
    try:
        data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return {"date": _today(), "leads_today": 0, "drafts_today": 0, "seen_keys": []}
        if data.get("date") != _today():
            data["date"] = _today()
            data["leads_today"] = 0
            data["drafts_today"] = 0
        seen = data.get("seen_keys")
        if not isinstance(seen, list):
            data["seen_keys"] = []
        return data
    except (json.JSONDecodeError, OSError):
        return {"date": _today(), "leads_today": 0, "drafts_today": 0, "seen_keys": []}


def _save_state(state: dict[str, Any]) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    seen = state.get("seen_keys") or []
    if isinstance(seen, list) and len(seen) > 5000:
        state["seen_keys"] = seen[-3000:]
    state["updated_at"] = _now()
    STATE_FILE.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def _lead_key(lead: dict[str, Any]) -> str:
    pid = (lead.get("place_id") or "").strip()
    if pid:
        return f"place:{pid}"
    blob = f"{lead.get('name','')}|{lead.get('address','')}|{lead.get('phone','')}"
    return "hash:" + hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]


def append_lead(lead: dict[str, Any]) -> bool:
    """Append lead to JSONL if new. Returns True if newly saved."""
    state = _load_state()
    key = _lead_key(lead)
    seen = set(state.get("seen_keys") or [])
    if key in seen:
        return False
    lead = {**lead, "saved_at": _now(), "lead_key": key}
    LEADS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with LEADS_FILE.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(lead, ensure_ascii=False) + "\n")
    seen.add(key)
    state["seen_keys"] = list(seen)
    state["leads_today"] = int(state.get("leads_today") or 0) + 1
    _save_state(state)
    return True


def should_run_maps_fallback(*, force: bool = False, social_idle: bool = False) -> tuple[bool, str]:
    cfg = load_maps_config()
    fb_cfg = cfg.get("fallback") or {}
    if not fb_cfg.get("enabled", True) and not force:
        return False, "disabled_in_config"
    if force or os.getenv("APSALES_MAPS_FALLBACK", "").strip() == "1":
        return True, "forced"
    try:
        from customer_gateway.fb_platform_limits import get_limits_summary

        pauses = (get_limits_summary().get("active_pauses") or {})
        if pauses:
            return True, f"fb_blocks:{','.join(sorted(pauses.keys()))}"
    except Exception:
        pass
    if social_idle and not fb_cfg.get("skip_if_no_fb_block", False):
        return True, "social_idle"
    return False, "no_trigger"


def _places_api_key() -> str:
    return (
        os.getenv("GOOGLE_PLACES_API_KEY", "").strip()
        or os.getenv("GOOGLE_MAPS_API_KEY", "").strip()
    )


_PLACES_NEW_BASE = "https://places.googleapis.com/v1"
_SEARCH_FIELD_MASK = (
    "places.id,places.displayName,places.formattedAddress,"
    "places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri,"
    "places.rating,places.types,nextPageToken"
)
_DETAIL_FIELD_MASK = (
    "id,displayName,formattedAddress,nationalPhoneNumber,websiteUri,googleMapsUri,rating,types"
)


def _places_new_headers(field_mask: str) -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": _places_api_key(),
        "X-Goog-FieldMask": field_mask,
        "User-Agent": "AsiaPower-MapsProspect/1.0",
    }


def _http_json_get(url: str, *, headers: dict[str, str], timeout: int = 30) -> dict[str, Any]:
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data if isinstance(data, dict) else {}


def _http_json_post(url: str, body: dict[str, Any], *, headers: dict[str, str], timeout: int = 30) -> dict[str, Any]:
    payload = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data if isinstance(data, dict) else {}


def _display_name(row: dict[str, Any]) -> str:
    dn = row.get("displayName")
    if isinstance(dn, dict):
        return str(dn.get("text") or "").strip()
    return str(dn or row.get("name") or "").strip()


def _place_id_from_row(row: dict[str, Any]) -> str:
    pid = str(row.get("id") or row.get("place_id") or "").strip()
    if pid.startswith("places/"):
        pid = pid.split("/", 1)[1]
    return pid


def _places_api_error_message(exc: Exception) -> str:
    if isinstance(exc, urllib.error.HTTPError):
        try:
            body = exc.read().decode("utf-8", errors="replace")
            payload = json.loads(body) if body else {}
            err = payload.get("error") if isinstance(payload, dict) else {}
            if isinstance(err, dict):
                return str(err.get("message") or err.get("status") or exc.reason or "HTTPError")
        except (json.JSONDecodeError, OSError, AttributeError):
            pass
        return str(exc.reason or "HTTPError")
    return str(exc)


def check_places_api_quota() -> dict[str, Any]:
    """Return quota status; surfaces 429 when daily SearchText limit is hit."""
    key = _places_api_key()
    if not key:
        return {"ok": False, "error": "missing_api_key", "quota_exhausted": False}
    body = json.dumps({"textQuery": "auto spare parts Lagos", "maxResultCount": 1}).encode("utf-8")
    req = urllib.request.Request(
        f"{_PLACES_NEW_BASE}/places:searchText",
        data=body,
        headers=_places_new_headers(_SEARCH_FIELD_MASK),
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            json.loads(resp.read().decode("utf-8"))
        return {"ok": True, "quota_exhausted": False}
    except urllib.error.HTTPError as exc:
        msg = _places_api_error_message(exc)
        exhausted = exc.code == 429 or "Quota exceeded" in msg
        return {"ok": False, "error": msg, "quota_exhausted": exhausted, "http_code": exc.code}
    except Exception as exc:
        return {"ok": False, "error": _places_api_error_message(exc), "quota_exhausted": False}


def verify_places_api(*, test_query: str = "auto spare parts Lagos") -> dict[str, Any]:
    """Smoke-test Places API (New). Never logs the API key."""
    key = _places_api_key()
    if not key:
        return {"ok": False, "error": "missing_api_key", "count": 0}
    try:
        leads = search_places_api(test_query, max_results=3)
    except Exception as exc:
        err = _places_api_error_message(exc)
        return {
            "ok": False,
            "error": err,
            "count": 0,
            "quota_exhausted": "429" in err or "Quota exceeded" in err,
        }
    if not leads:
        quota = check_places_api_quota()
        if quota.get("quota_exhausted"):
            return {
                "ok": False,
                "error": quota.get("error") or "quota_exhausted_daily",
                "count": 0,
                "quota_exhausted": True,
            }
    names = [str(l.get("name") or "") for l in leads[:3] if l.get("name")]
    return {
        "ok": bool(leads),
        "count": len(leads),
        "sample": names,
        "query": test_query,
        "api": "places_new",
    }


def search_places_api(
    query: str, *, country: str = "", city: str = "", max_results: int = 20
) -> list[dict[str, Any]]:
    key = _places_api_key()
    if not key:
        return []
    leads: list[dict[str, Any]] = []
    page_token = ""
    headers = _places_new_headers(_SEARCH_FIELD_MASK)
    while len(leads) < max_results:
        body: dict[str, Any] = {
            "textQuery": query,
            "maxResultCount": min(max(1, max_results - len(leads)), 20),
        }
        if page_token:
            body["pageToken"] = page_token
            time.sleep(2.0)
        try:
            payload = _http_json_post(f"{_PLACES_NEW_BASE}/places:searchText", body, headers=headers)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError):
            break
        for row in payload.get("places") or []:
            if not isinstance(row, dict):
                continue
            if len(leads) >= max_results:
                break
            place_id = _place_id_from_row(row)
            detail: dict[str, Any] = {}
            if place_id and not (row.get("nationalPhoneNumber") and row.get("websiteUri")):
                detail = _place_details_api(place_id, key)
            merged = {**row, **detail} if detail else row
            leads.append(
                _normalize_place_row(merged, {}, query=query, country=country, city=city, source="places_api_new")
            )
        page_token = payload.get("nextPageToken") or ""
        if not page_token or not (payload.get("places") or []):
            break
    return leads


def _place_details_api(place_id: str, key: str) -> dict[str, Any]:
    pid = place_id.split("/", 1)[1] if place_id.startswith("places/") else place_id
    if not pid:
        return {}
    url = f"{_PLACES_NEW_BASE}/places/{urllib.parse.quote(pid, safe='')}"
    headers = {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": _DETAIL_FIELD_MASK,
        "User-Agent": "AsiaPower-MapsProspect/1.0",
    }
    try:
        return _http_json_get(url, headers=headers)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError):
        return {}


def _normalize_place_row(
    row: dict[str, Any],
    detail: dict[str, Any],
    *,
    query: str,
    country: str,
    city: str,
    source: str,
) -> dict[str, Any]:
    merged = {**row, **detail} if detail else row
    name = (_display_name(merged) or "").strip()
    address = (merged.get("formattedAddress") or merged.get("formatted_address") or "").strip()
    phone = (
        merged.get("nationalPhoneNumber")
        or merged.get("formatted_phone_number")
        or merged.get("international_phone_number")
        or ""
    ).strip()
    website = (merged.get("websiteUri") or merged.get("website") or "").strip()
    maps_url = (merged.get("googleMapsUri") or merged.get("url") or "").strip()
    place_id = _place_id_from_row(merged)
    if not maps_url and place_id:
        maps_url = f"https://www.google.com/maps/place/?q=place_id:{place_id}"
    return {
        "name": name,
        "address": address,
        "phone": phone,
        "website": website,
        "email": "",
        "maps_url": maps_url,
        "place_id": place_id,
        "query": query,
        "country": country,
        "city": city,
        "source": source,
        "rating": merged.get("rating"),
        "types": merged.get("types") or [],
    }


def search_maps_browser(query: str, *, country: str = "", city: str = "", max_results: int = 5) -> list[dict[str, Any]]:
    """Ethical browser search — headless only; visible UI requires explicit CEO override."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return []

    cfg = load_maps_config()
    search_cfg = cfg.get("search") or {}
    # Safety default: headless — never pop open Google Maps on the CEO Mac
    headless = True
    if os.getenv("ASIAPOWER_ALLOW_VISIBLE_BROWSER", "").strip() == "1":
        headless = bool(search_cfg.get("browser_headless", True))
        if os.getenv("APSALES_MAPS_BROWSER_HEADLESS", "").strip() == "1":
            headless = True
        elif os.getenv("APSALES_MAPS_BROWSER_HEADLESS", "").strip() == "0":
            headless = False
    if not headless:
        return []

    leads: list[dict[str, Any]] = []
    url = f"https://www.google.com/maps/search/{urllib.parse.quote(query)}"

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=headless)
            page = browser.new_page()
            page.set_default_timeout(45000)
            page.goto(url, wait_until="domcontentloaded")
            page.wait_for_timeout(4000)
            cards = page.locator('div[role="article"]')
            count = min(cards.count(), max_results)
            for i in range(count):
                card = cards.nth(i)
                label = ""
                try:
                    label = card.locator("a[aria-label]").first.get_attribute("aria-label") or ""
                except Exception:
                    pass
                if not label:
                    try:
                        label = card.inner_text(timeout=2000).strip().split("\n")[0]
                    except Exception:
                        continue
                name = label.split("·")[0].strip() or label[:80]
                href = ""
                try:
                    href = card.locator('a[href*="/maps/place"]').first.get_attribute("href") or ""
                except Exception:
                    pass
                lead = {
                    "name": name,
                    "address": "",
                    "phone": "",
                    "website": "",
                    "email": "",
                    "maps_url": href,
                    "place_id": "",
                    "query": query,
                    "country": country,
                    "city": city,
                    "source": "maps_browser",
                    "rating": None,
                    "types": [],
                }
                if href:
                    lead = _enrich_lead_from_maps_page(page, lead)
                leads.append(lead)
            browser.close()
    except Exception:
        return []
    return leads


def _enrich_lead_from_maps_page(page: Any, lead: dict[str, Any]) -> dict[str, Any]:
    """Open place detail panel and scrape phone / website / address."""
    href = (lead.get("maps_url") or "").strip()
    if not href:
        return lead
    try:
        page.goto(href, wait_until="domcontentloaded")
        page.wait_for_timeout(2500)
        for sel in ('button[data-item-id^="phone"]', 'button[aria-label*="Phone"]', 'button[aria-label*="电话"]'):
            try:
                el = page.locator(sel).first
                aria = el.get_attribute("aria-label") or el.inner_text(timeout=1500)
                if aria:
                    phone = re.sub(r"^(Phone:|电话:)\s*", "", aria, flags=re.I).strip()
                    if phone:
                        lead = {**lead, "phone": phone}
                        break
            except Exception:
                continue
        for sel in ('a[data-item-id="authority"]', 'a[aria-label*="Website"]', 'a[aria-label*="网站"]'):
            try:
                site = page.locator(sel).first.get_attribute("href") or ""
                if site and "google.com" not in site:
                    lead = {**lead, "website": site}
                    break
            except Exception:
                continue
        try:
            addr = page.locator('button[data-item-id="address"]').first.get_attribute("aria-label") or ""
            if addr:
                lead = {**lead, "address": re.sub(r"^Address:\s*", "", addr, flags=re.I).strip()}
        except Exception:
            pass
    except Exception:
        return lead
    return lead


def search_places(query: str, *, country: str = "", city: str = "") -> list[dict[str, Any]]:
    cfg = load_maps_config()
    search_cfg = cfg.get("search") or {}
    max_results = int(search_cfg.get("max_results_per_query") or 5)
    prefer_api = search_cfg.get("prefer_places_api", True)

    leads: list[dict[str, Any]] = []
    if prefer_api and _places_api_key():
        leads = search_places_api(query, country=country, city=city)
    if not leads:
        leads = search_maps_browser(query, country=country, city=city, max_results=max_results)
    return leads[:max_results]


def _scrape_email_from_website(url: str) -> str:
    if not url:
        return ""
    low_url = url.lower()
    if any(x in low_url for x in ("facebook.com", "instagram.com", "tiktok.com", "twitter.com", "linkedin.com")):
        return ""
    if not url.startswith("http"):
        url = "https://" + url.lstrip("/")

    skip_domains = {"example.com", "wixpress.com", "sentry.io", "facebook.com", "instagram.com", "tiktok.com"}

    def _pick_email(html: str) -> str:
        mailtos = re.findall(r"mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})", html, flags=re.I)
        for match in mailtos:
            low = match.lower()
            if any(s in low for s in skip_domains):
                continue
            return match
        for match in _EMAIL_RE.findall(html):
            low = match.lower()
            if any(s in low for s in skip_domains):
                continue
            if low.endswith((".png", ".jpg", ".gif", ".webp", ".svg")):
                continue
            if low.startswith(("noreply@", "no-reply@", "donotreply@")):
                continue
            return match
        return ""

    def _fetch(target: str) -> str:
        try:
            req = urllib.request.Request(target, headers={"User-Agent": "AsiaPower-MapsProspect/1.0"})
            with urllib.request.urlopen(req, timeout=12) as resp:
                return resp.read(700_000).decode("utf-8", errors="replace")
        except (urllib.error.URLError, TimeoutError, ValueError):
            return ""

    for target in [url]:
        parsed = urllib.parse.urlparse(url)
        base = f"{parsed.scheme}://{parsed.netloc}"
        paths = ["", "/contact", "/contact-us", "/contactus", "/about", "/about-us"]
        seen: set[str] = set()
        for path in paths:
            candidate = base if not path else base.rstrip("/") + path
            if candidate in seen:
                continue
            seen.add(candidate)
            html = _fetch(candidate)
            if not html:
                continue
            email = _pick_email(html)
            if email:
                return email
    return ""


def enrich_lead_email(lead: dict[str, Any]) -> dict[str, Any]:
    cfg = load_maps_config()
    email_cfg = cfg.get("email") or {}
    if (lead.get("email") or "").strip():
        return lead
    if not email_cfg.get("scrape_website_for_email", True):
        return lead
    site = (lead.get("website") or "").strip()
    if site:
        email = _scrape_email_from_website(site)
        if email:
            lead = {**lead, "email": email, "email_source": "website_scrape"}
    return lead


def build_maps_outreach_email(lead: dict[str, Any]) -> tuple[str, str]:
    cfg = load_maps_config()
    voice = cfg.get("ceo_voice") or {}
    email_cfg = cfg.get("email") or {}
    city = (lead.get("city") or lead.get("country") or "your market").strip()
    name = (lead.get("name") or "there").split(" - ")[0].split(",")[0].strip()
    if len(name) > 40:
        name = "there"
    first = name.split()[0] if name and name != "there" else "there"

    subject_tpl = email_cfg.get("subject_template") or "Custom dismantling from China — half-cuts for {city} dealers"
    subject = subject_tpl.format(city=city, country=lead.get("country") or city, name=first)

    catalog = voice.get("catalog_url") or "https://asia-power.com/half-cuts/"
    whatsapp = voice.get("whatsapp") or "+86 166 3880 1930"
    ceo_name = voice.get("name") or "Zijing Lu"
    from_email = voice.get("from_email") or "sales@asia-power.com"

    body = (
        f"Hi {first},\n\n"
        f"I'm {ceo_name} from AsiaPower. We run a dismantling yard in China and do custom dismantling on demand — "
        f"tell us the engine code or parts you need, we pull them from verified units with photos.\n\n"
        f"Browse live half-cuts with EXW pricing:\n{catalog}\n\n"
        "Recent examples we have live:\n"
        "- Toyota Vios 2NZ-FE (HC250509)\n"
        "- Nissan Tiida HR16DE (HC250513)\n\n"
        "Reply with your model or engine code — I'll confirm stock and send photos.\n\n"
        f"WhatsApp: {whatsapp}\n"
        "Best regards,\n"
        f"{ceo_name}\n"
        f"AsiaPower · {from_email}"
    )
    return subject, body


def create_maps_outreach_draft(lead: dict[str, Any]) -> dict[str, Any] | None:
    email = (lead.get("email") or "").strip()
    if not email:
        return None
    from customer_gateway.outreach_engine import save_outreach, save_outreach_draft

    subject, body = build_maps_outreach_email(lead)
    candidate = {
        "candidate_id": f"maps-{lead.get('lead_key', _lead_key(lead))}",
        "source": "google_maps",
        "name": lead.get("name") or "unknown",
        "email": email,
        "country": lead.get("country") or "",
        "product": "half-cuts / custom dismantling",
        "channel": "email",
        "reason": f"Maps 开发 · {lead.get('query') or ''} · {lead.get('city') or ''}",
        "priority": "medium",
        "ref_id": lead.get("maps_url") or lead.get("place_id") or "",
        "phone": lead.get("phone") or "",
        "website": lead.get("website") or "",
    }
    record = save_outreach_draft(
        candidate,
        internal_analysis=(
            f"Google Maps 开发信 · {lead.get('name')} · {lead.get('country')}/{lead.get('city')} · "
            f"来源:{lead.get('source')} · 仅 CEO 批准后可发"
        ),
        customer_draft=body,
    )
    record["email_subject"] = subject
    record["channel"] = "email"
    save_outreach(record)

    state = _load_state()
    state["drafts_today"] = int(state.get("drafts_today") or 0) + 1
    _save_state(state)
    return record


def run_maps_prospect_batch(
    *,
    force: bool = False,
    social_idle: bool = False,
    max_leads: int | None = None,
    max_drafts: int | None = None,
) -> dict[str, Any]:
    """Search Maps, save leads, queue email drafts (no auto-send)."""
    should, reason = should_run_maps_fallback(force=force, social_idle=social_idle)
    if not should:
        return {"ok": True, "skipped": True, "reason": reason}

    cfg = load_maps_config()
    caps = cfg.get("daily_caps") or {}
    lead_cap = max_leads if max_leads is not None else int(caps.get("leads") or 10)
    draft_cap = max_drafts if max_drafts is not None else int(caps.get("email_drafts") or 5)
    state = _load_state()
    leads_left = max(0, lead_cap - int(state.get("leads_today") or 0))
    drafts_left = max(0, draft_cap - int(state.get("drafts_today") or 0))
    if leads_left <= 0:
        return {"ok": True, "skipped": True, "reason": "daily_lead_cap_reached", "trigger": reason}

    from customer_gateway.zijing_activity_stream import log_progress, log_step_end, log_step_start

    log_step_start("maps_prospect", f"Google Maps 获客 · 触发:{reason}", platform="maps")

    markets = cfg.get("markets") or []
    new_leads = 0
    new_drafts = 0
    queries_run: list[str] = []
    draft_ids: list[str] = []
    errors: list[str] = []
    method = "places_api_new" if _places_api_key() else "maps_browser"

    for market in markets:
        if new_leads >= leads_left:
            break
        if not isinstance(market, dict):
            continue
        country = str(market.get("country") or "")
        city = str(market.get("city") or "")
        for query in market.get("queries") or []:
            if new_leads >= leads_left:
                break
            q = str(query).strip()
            if not q:
                continue
            queries_run.append(q)
            log_progress(
                "maps_prospect",
                f"{country}/{city} | query=\"{q}\"",
                platform="maps",
                mode="limited",
            )
            try:
                rows = search_places(q, country=country, city=city)
            except Exception as exc:
                errors.append(f"{q}: {exc}")
                continue
            for row in rows:
                if new_leads >= leads_left:
                    break
                row = enrich_lead_email(row)
                if append_lead(row):
                    new_leads += 1
                if new_drafts < drafts_left and (row.get("email") or "").strip():
                    draft = create_maps_outreach_draft(row)
                    if draft:
                        new_drafts += 1
                        draft_ids.append(draft.get("outreach_id", ""))

    status = "completed" if new_leads or queries_run else "idle"
    log_step_end(
        "maps_prospect",
        f"新增线索 {new_leads} · 草稿 {new_drafts} · 方法 {method}",
        platform="maps",
        status=status,
    )

    try:
        from customer_gateway.distribution_progress import record_event

        record_event(
            "maps_prospect_run",
            notify=new_drafts > 0,
            trigger=reason,
            leads=new_leads,
            drafts=new_drafts,
            method=method,
            queries=len(queries_run),
        )
    except Exception:
        pass

    return {
        "ok": True,
        "skipped": False,
        "trigger": reason,
        "method": method,
        "queries_run": queries_run,
        "new_leads": new_leads,
        "new_drafts": new_drafts,
        "draft_ids": [d for d in draft_ids if d],
        "errors": errors,
        "leads_today": int(_load_state().get("leads_today") or 0),
        "drafts_today": int(_load_state().get("drafts_today") or 0),
    }

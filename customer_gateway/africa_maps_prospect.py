"""Africa-wide Google Maps prospecting — country-by-country, 54 nations."""

from __future__ import annotations

import fcntl
import hashlib
import json
import os
import random
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
CONFIG_FILE = ROOT / "config" / "apsales_africa_maps.yaml"
LEADS_FILE = ROOT / "memory" / "customer_gateway" / "africa_maps_leads.jsonl"
PROGRESS_FILE = ROOT / "memory" / "customer_gateway" / "africa_maps_progress.json"
LOCK_FILE = ROOT / "memory" / "customer_gateway" / "africa_maps_scrape.lock"
SEARCH_TIMEOUT_SEC = 180
HEARTBEAT_INTERVAL_SEC = 300
STALL_ZERO_SAVES = 8

_PHONE_RE = re.compile(r"(?:\+?\d[\d\s\-().]{7,}\d)")
_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")


def _valid_phone(phone: str) -> bool:
    raw = (phone or "").strip()
    if not raw or "." in raw:
        return False
    digits = re.sub(r"\D", "", raw)
    if len(digits) < 7 or len(digits) > 15:
        return False
    # Reject coordinate / ID blobs (e.g. 12705697049928602)
    if len(digits) > 12 and not raw.startswith("+"):
        return False
    return True


def _clean_phone(phone: str) -> str:
    phone = (phone or "").strip()
    if phone.lower().startswith("tel:"):
        phone = phone[4:].strip()
    return phone if _valid_phone(phone) else ""


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


class _AfricaMapsScrapeLock:
    """Single-instance lock — prevents LaunchAgent + manual scrape racing."""

    def __init__(self) -> None:
        self._fh = None

    def acquire(self) -> bool:
        LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
        self._fh = LOCK_FILE.open("w", encoding="utf-8")
        try:
            fcntl.flock(self._fh.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            self._fh.write(f"{os.getpid()}\n{_now()}\n")
            self._fh.flush()
            return True
        except BlockingIOError:
            self._fh.close()
            self._fh = None
            return False

    def release(self) -> None:
        if not self._fh:
            return
        try:
            fcntl.flock(self._fh.fileno(), fcntl.LOCK_UN)
            self._fh.close()
        except OSError:
            pass
        self._fh = None
        LOCK_FILE.unlink(missing_ok=True)


def _read_lock_holder() -> str:
    if not LOCK_FILE.is_file():
        return ""
    try:
        lines = LOCK_FILE.read_text(encoding="utf-8").splitlines()
        return f"pid={lines[0]}" if lines else ""
    except OSError:
        return ""


def _africa_search_worker(q: Any, kwargs: dict[str, Any]) -> None:
    """Module-level worker for multiprocessing (must be picklable)."""
    try:
        qtext = kwargs["qtext"]
        qcountry = kwargs["qcountry"]
        qcity = kwargs["qcity"]
        qmax = kwargs["qmax"]
        qprefer = kwargs["qprefer"]
        qheadless = kwargs["qheadless"]
        qscroll = kwargs["qscroll"]
        qskip_browser = kwargs["qskip_browser"]
        if qskip_browser:
            from customer_gateway.maps_prospect import _places_api_key, search_places_api

            rows: list[dict[str, Any]] = []
            if qprefer and _places_api_key():
                rows = search_places_api(qtext, country=qcountry, city=qcity, max_results=qmax)
            q.put(("ok", rows))
            return
        rows = _search_for_africa(
            qtext,
            country=qcountry,
            city=qcity,
            max_results=qmax,
            prefer_api=qprefer,
            headless=qheadless,
            scroll_rounds=qscroll,
        )
        q.put(("ok", rows))
    except Exception as exc:
        q.put(("err", str(exc)[:200]))


def _search_for_africa_timed(
    query: str,
    *,
    country: str,
    city: str,
    max_results: int,
    prefer_api: bool,
    headless: bool = True,
    scroll_rounds: int = 2,
    timeout: int = SEARCH_TIMEOUT_SEC,
    skip_browser: bool = False,
) -> list[dict[str, Any]]:
    """Run search in a child process so Playwright hangs can be killed."""
    import multiprocessing as mp

    from customer_gateway.maps_prospect import _places_api_key

    if skip_browser and not (prefer_api and _places_api_key()):
        return []

    ctx = mp.get_context("spawn")
    result_queue: mp.Queue = ctx.Queue()
    worker_kwargs = {
        "qtext": query,
        "qcountry": country,
        "qcity": city,
        "qmax": max_results,
        "qprefer": prefer_api,
        "qheadless": headless,
        "qscroll": scroll_rounds,
        "qskip_browser": skip_browser,
    }
    proc = ctx.Process(target=_africa_search_worker, args=(result_queue, worker_kwargs))
    proc.start()
    proc.join(timeout)
    if proc.is_alive():
        proc.terminate()
        proc.join(5)
        return []
    if result_queue.empty():
        return []
    status, payload = result_queue.get()
    return payload if status == "ok" and isinstance(payload, list) else []


def _maybe_scrape_heartbeat(
    last_hb: float,
    detail: str,
    *,
    mode: str,
    counts: dict[str, Any] | None = None,
) -> float:
    now = time.monotonic()
    if now - last_hb < HEARTBEAT_INTERVAL_SEC:
        return last_hb
    try:
        from customer_gateway.zijing_activity_stream import log_progress

        log_progress(
            "africa_maps_scrape",
            f"💓 仍在跑 · {detail}",
            platform="maps",
            mode=mode,
            counts=counts,
        )
    except Exception:
        pass
    return now


def _load_yaml(path: Path) -> dict[str, Any]:
    try:
        import yaml  # type: ignore

        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def load_africa_config() -> dict[str, Any]:
    if CONFIG_FILE.is_file():
        cfg = _load_yaml(CONFIG_FILE)
        if cfg:
            return cfg
    return {"countries": [], "daily_caps": {"leads": 999999, "email_drafts": 50}}


def _bootstrap_progress_from_leads(progress: dict[str, Any]) -> dict[str, Any]:
    """Rebuild seen_keys / totals from existing JSONL when progress is fresh."""
    if progress.get("seen_keys") or not LEADS_FILE.is_file():
        return progress
    seen: list[str] = []
    totals = {"dealer": 0, "repair": 0, "importer": 0, "with_email": 0, "with_phone": 0, "total": 0}
    countries_done: set[str] = set()
    try:
        for line in LEADS_FILE.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            key = row.get("lead_key") or _lead_key(row)
            seen.append(key)
            cat = row.get("category") or "dealer"
            totals["total"] += 1
            if cat in totals:
                totals[cat] += 1
            if (row.get("email") or "").strip():
                totals["with_email"] += 1
            if _clean_phone(row.get("phone") or ""):
                totals["with_phone"] += 1
            if row.get("country"):
                countries_done.add(str(row["country"]))
    except (json.JSONDecodeError, OSError):
        return progress
    progress["seen_keys"] = seen
    progress["totals"] = totals
    progress["countries_done"] = sorted(countries_done)
    if countries_done:
        cfg = load_africa_config()
        countries = cfg.get("countries") or []
        done_set = set(countries_done)
        idx = 0
        for i, m in enumerate(countries):
            if isinstance(m, dict) and str(m.get("country") or "") in done_set:
                idx = i + 1
        progress["country_index"] = idx
    return progress


def _load_progress() -> dict[str, Any]:
    default: dict[str, Any] = {
        "started_at": _now(),
        "updated_at": _now(),
        "country_index": 0,
        "countries_done": [],
        "seen_keys": [],
        "drafts_created": 0,
        "country_stats": {},
        "totals": {
            "dealer": 0,
            "repair": 0,
            "importer": 0,
            "with_email": 0,
            "with_phone": 0,
            "total": 0,
        },
    }
    if not PROGRESS_FILE.is_file():
        return _bootstrap_progress_from_leads(default)
    try:
        data = json.loads(PROGRESS_FILE.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return _bootstrap_progress_from_leads(default)
        for key in default:
            if key not in data:
                data[key] = default[key]
        return _bootstrap_progress_from_leads(data)
    except (json.JSONDecodeError, OSError):
        return _bootstrap_progress_from_leads(default)


def _save_progress(progress: dict[str, Any]) -> None:
    PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
    seen = progress.get("seen_keys") or []
    if isinstance(seen, list) and len(seen) > 8000:
        progress["seen_keys"] = seen[-5000:]
    progress["updated_at"] = _now()
    PROGRESS_FILE.write_text(json.dumps(progress, indent=2, ensure_ascii=False), encoding="utf-8")


def _lead_key(lead: dict[str, Any]) -> str:
    phone = re.sub(r"\D", "", _clean_phone(lead.get("phone") or ""))
    email = (lead.get("email") or "").strip().lower()
    if phone:
        return f"phone:{phone[-12:]}"
    if email:
        return f"email:{email}"
    pid = (lead.get("place_id") or "").strip()
    if pid:
        return f"place:{pid}"
    blob = f"{lead.get('business_name','')}|{lead.get('city','')}|{lead.get('category','')}"
    return "hash:" + hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]


def _has_contact(lead: dict[str, Any]) -> bool:
    return bool(_clean_phone(lead.get("phone") or "") or (lead.get("email") or "").strip())


def _contact_kind(lead: dict[str, Any]) -> str:
    has_phone = bool(_clean_phone(lead.get("phone") or ""))
    has_email = bool((lead.get("email") or "").strip())
    if has_phone and has_email:
        return "both"
    if has_phone:
        return "phone_only"
    if has_email:
        return "email_only"
    return "none"


def _per_country_target(cfg: dict[str, Any]) -> int:
    return int(cfg.get("per_country_target") or 500)


def _default_country_stat(target: int) -> dict[str, int]:
    return {
        "target": target,
        "valid": 0,
        "invalid_skipped": 0,
        "phone_only": 0,
        "email_only": 0,
        "both": 0,
        "dealer": 0,
        "repair": 0,
        "importer": 0,
        "with_email": 0,
        "with_phone": 0,
        "total": 0,
    }


def _bump_country_stat(st: dict[str, int], lead: dict[str, Any]) -> None:
    st["valid"] = int(st.get("valid") or 0) + 1
    st["total"] = int(st.get("total") or 0) + 1
    cat = lead.get("category") or "dealer"
    if cat in ("dealer", "repair", "importer"):
        st[cat] = int(st.get(cat) or 0) + 1
    kind = _contact_kind(lead)
    if kind in ("phone_only", "email_only", "both"):
        st[kind] = int(st.get(kind) or 0) + 1
    if (lead.get("email") or "").strip():
        st["with_email"] = int(st.get("with_email") or 0) + 1
    if _clean_phone(lead.get("phone") or ""):
        st["with_phone"] = int(st.get("with_phone") or 0) + 1


def _record_invalid_skip(progress: dict[str, Any], country: str, *, target: int) -> None:
    cs = progress.setdefault("country_stats", {})
    st = cs.setdefault(country, _default_country_stat(target))
    st["invalid_skipped"] = int(st.get("invalid_skipped") or 0) + 1
    progress["invalid_skipped_total"] = int(progress.get("invalid_skipped_total") or 0) + 1


def append_africa_lead(lead: dict[str, Any], progress: dict[str, Any], *, target: int = 500) -> bool:
    """Append lead if new and has phone or email. Returns True if saved."""
    lead = {**lead, "phone": _clean_phone(lead.get("phone") or "")}
    if not _has_contact(lead):
        return False
    key = _lead_key(lead)
    seen = set(progress.get("seen_keys") or [])
    if key in seen:
        return False
    lead = {**lead, "saved_at": _now(), "lead_key": key}
    LEADS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with LEADS_FILE.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(lead, ensure_ascii=False) + "\n")
    seen.add(key)
    progress["seen_keys"] = list(seen)

    cat = lead.get("category") or "dealer"
    totals = progress.setdefault("totals", {})
    totals["total"] = int(totals.get("total") or 0) + 1
    if cat in ("dealer", "repair", "importer"):
        totals[cat] = int(totals.get(cat) or 0) + 1
    if (lead.get("email") or "").strip():
        totals["with_email"] = int(totals.get("with_email") or 0) + 1
    if _clean_phone(lead.get("phone") or ""):
        totals["with_phone"] = int(totals.get("with_phone") or 0) + 1

    country = str(lead.get("country") or "?")
    cs = progress.setdefault("country_stats", {})
    st = cs.setdefault(country, _default_country_stat(target))
    st["target"] = target
    _bump_country_stat(st, lead)
    return True


def rebuild_progress_from_leads(progress: dict[str, Any] | None = None, *, target: int = 500) -> dict[str, Any]:
    """Sync seen_keys / country_stats / totals from existing JSONL (resume-safe)."""
    progress = progress or _load_progress()
    seen: set[str] = set(progress.get("seen_keys") or [])
    counted: set[str] = set()
    totals = {"dealer": 0, "repair": 0, "importer": 0, "with_email": 0, "with_phone": 0, "total": 0}
    country_stats: dict[str, dict[str, int]] = {}
    countries_done: list[str] = []

    if LEADS_FILE.is_file():
        for line in LEADS_FILE.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            row = {**row, "phone": _clean_phone(row.get("phone") or "")}
            if not _has_contact(row):
                continue
            key = row.get("lead_key") or _lead_key(row)
            seen.add(key)
            if key in counted:
                continue
            counted.add(key)
            country = row.get("country") or "?"
            st = country_stats.setdefault(country, _default_country_stat(target))
            st["target"] = target
            _bump_country_stat(st, row)
            cat = row.get("category") or "dealer"
            if cat in totals:
                totals[cat] = int(totals.get(cat) or 0) + 1
            if (row.get("email") or "").strip():
                totals["with_email"] += 1
            if _clean_phone(row.get("phone") or ""):
                totals["with_phone"] += 1
            totals["total"] += 1

    for cname, st in country_stats.items():
        if int(st.get("valid") or 0) >= target:
            countries_done.append(cname)

    progress["seen_keys"] = list(seen)
    progress["country_stats"] = country_stats
    progress["totals"] = totals
    progress["countries_done"] = sorted(set(countries_done))
    return progress


def purge_invalid_africa_leads(*, normalize_phones: bool = True) -> dict[str, int]:
    """Remove JSONL rows with neither phone nor email; optionally normalize phone fields."""
    if not LEADS_FILE.is_file():
        return {"kept": 0, "purged": 0, "normalized": 0}
    kept: list[str] = []
    purged = 0
    normalized = 0
    for line in LEADS_FILE.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            purged += 1
            continue
        clean_phone = _clean_phone(row.get("phone") or "")
        email = (row.get("email") or "").strip()
        if normalize_phones and clean_phone != (row.get("phone") or ""):
            row["phone"] = clean_phone
            normalized += 1
        elif clean_phone:
            row["phone"] = clean_phone
        if not clean_phone and not email:
            purged += 1
            continue
        kept.append(json.dumps(row, ensure_ascii=False))
    LEADS_FILE.write_text("\n".join(kept) + ("\n" if kept else ""), encoding="utf-8")
    return {"kept": len(kept), "purged": purged, "normalized": normalized}


def mark_substantial_countries_done(progress: dict[str, Any], *, min_leads: int = 15) -> dict[str, Any]:
    """Legacy helper — only mark done when valid >= per-country target."""
    target = min_leads
    done = set(progress.get("countries_done") or [])
    for cname, st in (progress.get("country_stats") or {}).items():
        if int(st.get("valid") or st.get("total") or 0) >= target:
            done.add(cname)
    progress["countries_done"] = sorted(done)
    return progress


def _sync_country_index_from_done(progress: dict[str, Any], countries: list[dict[str, Any]], *, target: int) -> int:
    """First country index that still needs work (valid < target)."""
    done = set(progress.get("countries_done") or [])
    for idx, market in enumerate(countries):
        if not isinstance(market, dict):
            continue
        cname = str(market.get("country") or "")
        st = (progress.get("country_stats") or {}).get(cname) or {}
        valid = int(st.get("valid") or st.get("total") or 0)
        if cname and (cname in done or valid >= target):
            continue
        return idx
    return len(countries)


def _build_queries(
    cfg: dict[str, Any],
    *,
    country_id: str,
    country: str,
    city: str,
    category: str,
) -> list[str]:
    templates = cfg.get("category_templates") or {}
    west = set(cfg.get("west_africa_ids") or [])
    queries: list[str] = []
    for tpl in templates.get(category) or []:
        queries.append(str(tpl).format(city=city, country=country))
    if category == "dealer" and country_id in west:
        for tpl in templates.get("dealer_tokunbo") or []:
            queries.append(str(tpl).format(city=city, country=country))
    return queries


def _normalize_lead(
    row: dict[str, Any],
    *,
    country: str,
    city: str,
    category: str,
    query: str,
) -> dict[str, Any]:
    return {
        "business_name": (row.get("name") or row.get("business_name") or "").strip(),
        "country": country,
        "city": city,
        "category": category,
        "phone": (row.get("phone") or "").strip(),
        "email": (row.get("email") or "").strip(),
        "website": (row.get("website") or "").strip(),
        "maps_url": (row.get("maps_url") or "").strip(),
        "address": (row.get("address") or "").strip(),
        "place_id": (row.get("place_id") or "").strip(),
        "source_query": query,
        "source": row.get("source") or "places_api",
        "rating": row.get("rating"),
    }


def _scrape_maps_page_contact(maps_url: str) -> tuple[str, str]:
    """Light fetch of Google Maps place page for phone/email (browser fallback)."""
    if not maps_url:
        return "", ""
    try:
        req = urllib.request.Request(maps_url, headers={"User-Agent": "AsiaPower-AfricaMaps/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read(300_000).decode("utf-8", errors="replace")
    except (urllib.error.URLError, TimeoutError, ValueError):
        return "", ""
    phone = ""
    for match in _PHONE_RE.findall(html):
        cleaned = _clean_phone(match.strip())
        if cleaned:
            phone = cleaned
            break
    email = ""
    skip = {"google.com", "gstatic.com", "example.com"}
    for match in _EMAIL_RE.findall(html):
        low = match.lower()
        if any(s in low for s in skip):
            continue
        email = match
        break
    return phone, email


def search_maps_browser_detailed(
    query: str,
    *,
    country: str = "",
    city: str = "",
    max_results: int = 10,
    headless: bool = True,
    scroll_rounds: int = 2,
) -> list[dict[str, Any]]:
    """Browser Maps search with scroll + place-panel click for phone/website."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return []

    from customer_gateway.maps_prospect import _enrich_lead_from_maps_page

    leads: list[dict[str, Any]] = []
    url = f"https://www.google.com/maps/search/{urllib.parse.quote(query)}"

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=headless)
            page = browser.new_page()
            page.set_default_timeout(45000)
            page.goto(url, wait_until="domcontentloaded")
            page.wait_for_timeout(2500)
            feed = page.locator('div[role="feed"]')
            for _ in range(max(0, scroll_rounds)):
                try:
                    if feed.count():
                        feed.first.evaluate("el => el.scrollTop = el.scrollHeight")
                    else:
                        page.keyboard.press("End")
                except Exception:
                    page.keyboard.press("End")
                page.wait_for_timeout(1200)

            cards = page.locator('div[role="article"]')
            count = min(cards.count(), max_results)
            for i in range(count):
                card = cards.nth(i)
                name = ""
                href = ""
                try:
                    label = card.locator("a[aria-label]").first.get_attribute("aria-label") or ""
                    name = label.split("·")[0].strip() or label[:80]
                    href = card.locator('a[href*="/maps/place"]').first.get_attribute("href") or ""
                except Exception:
                    try:
                        name = card.inner_text(timeout=2000).strip().split("\n")[0]
                    except Exception:
                        continue
                if not name:
                    continue
                phone = ""
                website = ""
                maps_url = href
                lead = {
                    "name": name,
                    "address": "",
                    "phone": "",
                    "website": "",
                    "email": "",
                    "maps_url": maps_url,
                    "place_id": "",
                    "query": query,
                    "country": country,
                    "city": city,
                    "source": "maps_browser_detailed",
                    "rating": None,
                    "types": [],
                }
                try:
                    card.click(timeout=5000)
                    page.wait_for_timeout(1800)
                except Exception:
                    pass
                try:
                    tel = page.locator('a[href^="tel:"]').first
                    if tel.count():
                        phone = _clean_phone(tel.get_attribute("href") or "")
                except Exception:
                    pass
                if not phone:
                    try:
                        btn = page.locator('button[data-item-id*="phone"]').first
                        if btn.count():
                            aria = btn.get_attribute("aria-label") or btn.inner_text(timeout=1500)
                            phone = _clean_phone(re.sub(r"^Phone:\s*", "", aria, flags=re.I))
                    except Exception:
                        pass
                try:
                    web = page.locator('a[data-item-id="authority"]').first
                    if web.count():
                        website = (web.get_attribute("href") or "").strip()
                except Exception:
                    pass
                try:
                    maps_url = page.url or maps_url
                except Exception:
                    pass
                lead = {**lead, "phone": phone, "website": website, "maps_url": maps_url}
                if not phone and maps_url:
                    lead = _enrich_lead_from_maps_page(page, lead)
                leads.append(lead)
            browser.close()
    except Exception:
        return []
    return leads


def _search_for_africa(
    query: str,
    *,
    country: str,
    city: str,
    max_results: int,
    prefer_api: bool,
    headless: bool = True,
    scroll_rounds: int = 2,
) -> list[dict[str, Any]]:
    from customer_gateway.maps_prospect import (
        _places_api_key,
        _scrape_email_from_website,
        enrich_lead_email,
        search_places_api,
    )

    leads: list[dict[str, Any]] = []
    if prefer_api and _places_api_key():
        leads = search_places_api(query, country=country, city=city, max_results=max_results)
    if not leads:
        leads = search_maps_browser_detailed(
            query,
            country=country,
            city=city,
            max_results=max_results,
            headless=headless,
            scroll_rounds=scroll_rounds,
        )
    out: list[dict[str, Any]] = []
    for row in leads[:max_results]:
        row = enrich_lead_email(row)
        if not (row.get("email") or "").strip() and (row.get("website") or "").strip():
            site = row["website"]
            email = _scrape_email_from_website(site)
            if email:
                row = {**row, "email": email, "email_source": "website_scrape"}
        row = {**row, "phone": _clean_phone(row.get("phone") or "")}
        if not row.get("phone") and (row.get("maps_url") or "").strip():
            phone, _ = _scrape_maps_page_contact(row["maps_url"])
            if phone:
                row = {**row, "phone": phone}
        out.append(row)
    return out


def create_africa_outreach_draft(lead: dict[str, Any]) -> dict[str, Any] | None:
    email = (lead.get("email") or "").strip()
    if not email:
        return None
    from customer_gateway.maps_prospect import build_maps_outreach_email
    from customer_gateway.outreach_engine import save_outreach, save_outreach_draft

    cfg = load_africa_config()
    voice = cfg.get("ceo_voice") or {}
    email_cfg = cfg.get("email") or {}

    draft_lead = {
        **lead,
        "name": lead.get("business_name") or lead.get("name") or "unknown",
        "query": lead.get("source_query") or "",
    }
    subject_tpl = email_cfg.get("subject_template") or "Custom dismantling from China — half-cuts for {city} dealers"
    city = (lead.get("city") or lead.get("country") or "your market").strip()
    subject = subject_tpl.format(city=city, country=lead.get("country") or city, name="there")

    _, body = build_maps_outreach_email(draft_lead)
    candidate = {
        "candidate_id": f"africa-maps-{lead.get('lead_key', _lead_key(lead))}",
        "source": "africa_google_maps",
        "name": draft_lead["name"],
        "email": email,
        "country": lead.get("country") or "",
        "product": "half-cuts / custom dismantling",
        "channel": "email",
        "reason": f"非洲 Maps · {lead.get('category')} · {lead.get('city') or ''} · {lead.get('source_query') or ''}",
        "priority": "medium",
        "ref_id": lead.get("maps_url") or lead.get("place_id") or "",
        "phone": lead.get("phone") or "",
        "website": lead.get("website") or "",
    }
    record = save_outreach_draft(
        candidate,
        internal_analysis=(
            f"非洲 Maps 开发信 · {draft_lead['name']} · {lead.get('country')}/{lead.get('city')} · "
            f"{lead.get('category')} · 仅 CEO 批准后可发"
        ),
        customer_draft=body,
    )
    record["email_subject"] = subject
    record["channel"] = "email"
    save_outreach(record)
    return record


def should_run_africa_maps(*, force: bool = False) -> tuple[bool, str]:
    if force or os.getenv("APSALES_AFRICA_MAPS", "").strip() == "1":
        return True, "forced"
    try:
        from customer_gateway.fb_platform_limits import get_limits_summary

        pauses = (get_limits_summary().get("active_pauses") or {})
        if pauses:
            return True, f"fb_blocks:{','.join(sorted(pauses.keys()))}"
    except Exception:
        pass
    if os.getenv("APSALES_MAPS_FALLBACK", "").strip() == "1":
        return True, "maps_fallback_env"
    return False, "no_trigger"


def compute_country_stats(progress: dict[str, Any], country: str, *, target: int = 500) -> dict[str, int]:
    st = (progress.get("country_stats") or {}).get(country)
    if isinstance(st, dict) and st.get("valid") is not None:
        out = _default_country_stat(target)
        out.update({k: int(v or 0) for k, v in st.items() if k in out or k == "target"})
        out["target"] = target
        return out
    stats = _default_country_stat(target)
    if not LEADS_FILE.is_file():
        return stats
    try:
        for line in LEADS_FILE.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            if row.get("country") != country:
                continue
            row = {**row, "phone": _clean_phone(row.get("phone") or "")}
            if not _has_contact(row):
                continue
            _bump_country_stat(stats, row)
    except (json.JSONDecodeError, OSError):
        pass
    stats["target"] = target
    return stats


def compute_leads_live_stats(*, hours: float = 1.0) -> dict[str, Any]:
    """Read JSONL for last entry time, hourly rate, and total line count."""
    stats: dict[str, Any] = {
        "total_lines": 0,
        "last_saved_at": "",
        "last_business": "",
        "last_country": "",
        "last_hour_count": 0,
        "rate_per_hour": 0.0,
    }
    if not LEADS_FILE.is_file():
        return stats
    from datetime import timedelta

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=hours)
    last_ts: datetime | None = None
    try:
        for line in LEADS_FILE.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            stats["total_lines"] += 1
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            sa = str(row.get("saved_at") or "")
            if not sa:
                continue
            try:
                ts = datetime.strptime(sa, "%Y-%m-%d %H:%M UTC").replace(tzinfo=timezone.utc)
            except ValueError:
                continue
            if last_ts is None or ts > last_ts:
                last_ts = ts
                stats["last_saved_at"] = sa
                stats["last_business"] = str(row.get("business_name") or "")
                stats["last_country"] = str(row.get("country") or "")
            if ts >= cutoff:
                stats["last_hour_count"] += 1
    except OSError:
        pass
    if hours > 0:
        stats["rate_per_hour"] = round(stats["last_hour_count"] / hours, 1)
    return stats


def write_africa_maps_report(progress: dict[str, Any], *, target: int = 500, live: bool = False) -> None:
    """Refresh memory/customer_gateway/africa_maps_report.md from live progress."""
    try:
        report_path = ROOT / "memory" / "customer_gateway" / "africa_maps_report.md"
        body = format_progress_report(progress, target=target, live=live)
        report_path.write_text(f"# 非洲 Maps 获客进度 · {_now()}\n\n{body}\n", encoding="utf-8")
    except OSError:
        pass


def format_progress_report(progress: dict[str, Any], *, target: int = 500, live: bool = False) -> str:
    live_stats = compute_leads_live_stats()
    updated_at = str(progress.get("updated_at") or "—")
    header = [
        f"**数据更新时间:** {updated_at} · **JSONL 最后写入:** {live_stats.get('last_saved_at') or '—'}",
        f"**过去 1 小时新增:** {live_stats.get('last_hour_count', 0)} 条 · "
        f"**速率:** {live_stats.get('rate_per_hour', 0)}/小时 · "
        f"**JSONL 总行数:** {live_stats.get('total_lines', 0)}",
    ]
    if live and live_stats.get("last_business"):
        header.append(
            f"**最新线索:** {live_stats.get('last_country', '')} · {live_stats.get('last_business', '')}"
        )
    cfg = load_africa_config()
    order = [str(m.get("country") or "") for m in (cfg.get("countries") or []) if isinstance(m, dict)]
    if not order and (progress.get("country_stats") or {}):
        header.append("⚠️ **提示:** 请用 `.venv/bin/python3` 运行（系统 python 缺 PyYAML 时国家列表不完整）")
    lines = header + ["", "| 国家 | 有效线索 | 目标 | 有电话 | 有邮箱 | 无效跳过 |", "|---|---:|---:|---:|---:|---:|"]
    country_stats = progress.get("country_stats") or {}
    target = _per_country_target(cfg) if target <= 0 else target
    seen: set[str] = set()
    for country in order + sorted(country_stats.keys()):
        if not country or country in seen:
            continue
        seen.add(country)
        st = country_stats.get(country) or {}
        valid = int(st.get("valid") or st.get("total") or 0)
        lines.append(
            f"| {country} | {valid} | {int(st.get('target') or target)} | "
            f"{int(st.get('with_phone') or 0)} | {int(st.get('with_email') or 0)} | "
            f"{int(st.get('invalid_skipped') or 0)} |"
        )
    totals = progress.get("totals") or {}
    invalid_total = int(progress.get("invalid_skipped_total") or 0)
    if not invalid_total:
        invalid_total = sum(int((country_stats.get(c) or {}).get("invalid_skipped") or 0) for c in country_stats)
    lines.append(
        f"| **合计** | **{int(totals.get('total') or 0)}** | **{target}×{len(order)}** | "
        f"**{int(totals.get('with_phone') or 0)}** | **{int(totals.get('with_email') or 0)}** | "
        f"**{invalid_total}** |"
    )
    done = sum(
        1
        for c in order
        if int(((country_stats.get(c) or {}).get("valid") or (country_stats.get(c) or {}).get("total") or 0)) >= target
    )
    lines.append(f"\n进度: {done}/{len(order)} 国达 {target}+ · 无效跳过 {invalid_total} · 草稿 {progress.get('drafts_created', 0)}")
    return "\n".join(lines)


def _query_delay_sec(run_cfg: dict[str, Any]) -> float:
    lo = float(run_cfg.get("delay_between_queries_sec_min") or run_cfg.get("pause_between_queries_sec") or 3)
    hi = float(run_cfg.get("delay_between_queries_sec_max") or lo)
    if hi < lo:
        hi = lo
    return random.uniform(lo, hi)


def _country_valid_count(progress: dict[str, Any], country: str) -> int:
    st = (progress.get("country_stats") or {}).get(country) or {}
    return int(st.get("valid") or st.get("total") or 0)


def run_africa_maps_batch(
    *,
    force: bool = False,
    max_countries: int | None = None,
    max_drafts: int | None = None,
    start_index: int | None = None,
    aggressive: bool = False,
    no_cap: bool = False,
) -> dict[str, Any]:
    """Loop countries → cities → categories → queries. Resume from progress file."""
    should, reason = should_run_africa_maps(force=force)
    if not should:
        return {"ok": True, "skipped": True, "reason": reason}

    scrape_lock = _AfricaMapsScrapeLock()
    if not scrape_lock.acquire():
        holder = _read_lock_holder()
        skip_reason = f"another_scrape_running ({holder})"
        try:
            from customer_gateway.zijing_activity_stream import log_result

            log_result(
                "africa_maps_scrape",
                f"跳过 · 已有抓取在跑 · {holder}",
                platform="maps",
                mode="aggressive" if aggressive else "limited",
                status="completed",
                result=skip_reason,
            )
        except Exception:
            pass
        return {"ok": True, "skipped": True, "reason": skip_reason}

    try:
        return _run_africa_maps_batch_locked(
            force=force,
            max_countries=max_countries,
            max_drafts=max_drafts,
            start_index=start_index,
            aggressive=aggressive,
            no_cap=no_cap,
            reason=reason,
        )
    finally:
        scrape_lock.release()


def _run_africa_maps_batch_locked(
    *,
    force: bool,
    max_countries: int | None,
    max_drafts: int | None,
    start_index: int | None,
    aggressive: bool,
    no_cap: bool,
    reason: str,
) -> dict[str, Any]:
    """Inner batch loop — caller holds _AfricaMapsScrapeLock."""

    cfg = load_africa_config()
    run_cfg = cfg.get("run") or {}
    ag_cfg = cfg.get("aggressive") or {}
    if aggressive:
        run_cfg = {**run_cfg, **ag_cfg}
    per_target = _per_country_target(cfg)
    caps = cfg.get("daily_caps") or {}
    max_results = int(run_cfg.get("max_results_per_query") or 20)
    report_every = int(run_cfg.get("report_every_countries") or 1)
    scroll_rounds = int(run_cfg.get("browser_scroll_rounds") or (6 if aggressive else 2))
    country_delay = float(run_cfg.get("delay_between_countries_sec") or 10)
    log_invalid = bool(run_cfg.get("log_invalid_skips", True))
    prefer_api = run_cfg.get("prefer_places_api", True)
    headless = run_cfg.get("browser_headless", True)
    if os.getenv("APSALES_MAPS_BROWSER_HEADLESS", "").strip() == "1":
        headless = True
    elif os.getenv("APSALES_MAPS_BROWSER_HEADLESS", "").strip() == "0":
        headless = False
    if no_cap:
        max_countries = None
        draft_cap = 999999
    else:
        draft_cap = max_drafts if max_drafts is not None else int(caps.get("email_drafts") or 50)

    countries = cfg.get("countries") or []
    if not countries:
        return {"ok": False, "error": "no_countries_in_config"}

    progress = rebuild_progress_from_leads(_load_progress(), target=per_target)
    progress = mark_substantial_countries_done(progress, min_leads=per_target)
    idx = start_index if start_index is not None else _sync_country_index_from_done(progress, countries, target=per_target)
    if max_countries is not None:
        end_idx = min(idx + max_countries, len(countries))
    else:
        end_idx = len(countries)

    from customer_gateway.maps_prospect import _places_api_key, verify_places_api
    from customer_gateway.zijing_activity_stream import log_progress, log_result, log_step_end, log_step_start

    api_verify = verify_places_api() if _places_api_key() else {"ok": False, "error": "missing_api_key", "count": 0}
    api_quota_exhausted = bool(api_verify.get("quota_exhausted"))
    if api_quota_exhausted:
        prefer_api = False
        scroll_rounds = min(scroll_rounds, 2)
        max_results = min(max_results, 20)
        search_timeout = 120
    else:
        search_timeout = SEARCH_TIMEOUT_SEC
    method = "places_api_new" if api_verify.get("ok") else ("places_api_new+fallback" if _places_api_key() else "maps_browser_detailed")
    if _places_api_key():
        quota_note = " · ⚠️ API 日配额用尽→浏览器" if api_quota_exhausted else ""
        sample = ", ".join(api_verify.get("sample") or [])[:120]
        log_result(
            "africa_maps_scrape",
            (
                f"Places API (New) {'✅' if api_verify.get('ok') else '❌'} · "
                f"{api_verify.get('count', 0)} 条 · {api_verify.get('error') or sample or 'ok'}"
                f"{quota_note}"
            ),
            platform="maps",
            mode="aggressive" if aggressive else "limited",
            result="api_ok" if api_verify.get("ok") else str(api_verify.get("error") or "no_results"),
            counts={"api_results": api_verify.get("count", 0), "quota_exhausted": int(api_quota_exhausted)},
            status="completed" if api_verify.get("ok") else "failed",
        )
    log_step_start(
        "africa_maps_scrape",
        f"非洲全量 Maps · {idx + 1}-{end_idx}/{len(countries)} 国 · 每国目标 {per_target}"
        f" · 触发:{reason}"
        + (" · 🚀 aggressive" if aggressive else "")
        + (" · no-cap" if no_cap else ""),
        platform="maps",
    )

    new_leads = 0
    new_drafts = 0
    draft_ids: list[str] = []
    errors: list[str] = []
    queries_run = 0
    invalid_skipped_session = 0
    categories = ("dealer", "repair", "importer")
    drafts_created = int(progress.get("drafts_created") or 0)
    last_heartbeat = time.monotonic()
    mode_label = "aggressive" if aggressive else "limited"

    for ci in range(idx, end_idx):
        market = countries[ci]
        if not isinstance(market, dict):
            continue
        country_id = str(market.get("id") or "")
        country = str(market.get("country") or "")
        cities = market.get("cities") or [country]
        country_new = 0
        country_invalid = 0
        consecutive_zero_saves = 0

        query_jobs: list[tuple[str, str, list[str]]] = []
        for city in cities:
            city = str(city).strip()
            if not city:
                continue
            for category in categories:
                queries = _build_queries(cfg, country_id=country_id, country=country, city=city, category=category)
                if queries:
                    query_jobs.append((city, category, queries))

        round_num = 0
        while _country_valid_count(progress, country) < per_target and query_jobs:
            round_num += 1
            exhausted = True
            for city, category, queries in query_jobs:
                if _country_valid_count(progress, country) >= per_target:
                    break
                for query in queries:
                    if _country_valid_count(progress, country) >= per_target:
                        break
                    queries_run += 1
                    valid_now = _country_valid_count(progress, country)
                    hb_detail = f"{country}/{city} | {valid_now}/{per_target} | {category} | \"{query}\""
                    last_heartbeat = _maybe_scrape_heartbeat(
                        last_heartbeat,
                        hb_detail,
                        mode=mode_label,
                        counts={
                            "queries": queries_run,
                            "leads_session": new_leads,
                            "country_valid": valid_now,
                            "country_target": per_target,
                        },
                    )
                    log_progress(
                        "africa_maps_scrape",
                        hb_detail,
                        platform="maps",
                        mode=mode_label,
                        counts={
                            "queries": queries_run,
                            "leads_session": new_leads,
                            "country_valid": valid_now,
                            "country_target": per_target,
                            "invalid_skipped": int(progress.get("invalid_skipped_total") or 0),
                        },
                    )
                    try:
                        rows = _search_for_africa_timed(
                            query,
                            country=country,
                            city=city,
                            max_results=max_results,
                            prefer_api=prefer_api,
                            headless=headless,
                            scroll_rounds=scroll_rounds,
                            timeout=search_timeout,
                            skip_browser=False,
                        )
                        if not rows:
                            errors.append(f"{country}/{city}/{query}: timeout_or_empty")
                        exhausted = False
                    except Exception as exc:
                        errors.append(f"{country}/{city}/{query}: {exc}")
                        if "OVER_QUERY_LIMIT" in str(exc) or "quota" in str(exc).lower():
                            prefer_api = False
                        continue

                    batch_saved = 0
                    batch_invalid = 0
                    for row in rows:
                        lead = _normalize_lead(row, country=country, city=city, category=category, query=query)
                        lead = {**lead, "phone": _clean_phone(lead.get("phone") or "")}
                        if not lead.get("business_name"):
                            continue
                        if not _has_contact(lead):
                            if log_invalid:
                                _record_invalid_skip(progress, country, target=per_target)
                                batch_invalid += 1
                                country_invalid += 1
                                invalid_skipped_session += 1
                            continue
                        if append_africa_lead(lead, progress, target=per_target):
                            new_leads += 1
                            country_new += 1
                            batch_saved += 1
                        if drafts_created < draft_cap and (lead.get("email") or "").strip():
                            lead["lead_key"] = _lead_key(lead)
                            draft = create_africa_outreach_draft(lead)
                            if draft:
                                drafts_created += 1
                                new_drafts += 1
                                draft_ids.append(draft.get("outreach_id", ""))

                    if rows:
                        from customer_gateway.zijing_activity_stream import log_result

                        log_result(
                            "africa_maps_scrape",
                            f"{country}/{city} | {category} | +{batch_saved} 有效 · 跳过 {batch_invalid} 无联系方式",
                            platform="maps",
                            mode="aggressive" if aggressive else "limited",
                            result=(
                                f"{_country_valid_count(progress, country)}/{per_target} · "
                                f"session +{new_leads} · invalid {invalid_skipped_session}"
                            ),
                            counts={
                                "leads_saved": batch_saved,
                                "invalid_skipped": batch_invalid,
                                "new_leads": new_leads,
                                "country_valid": _country_valid_count(progress, country),
                                "country_target": per_target,
                                "new_drafts": new_drafts,
                            },
                        )

                    progress["country_stats"][country] = compute_country_stats(progress, country, target=per_target)
                    progress["drafts_created"] = drafts_created
                    _save_progress(progress)
                    if batch_saved > 0:
                        consecutive_zero_saves = 0
                        write_africa_maps_report(progress, target=per_target, live=True)
                    else:
                        consecutive_zero_saves += 1
                        if consecutive_zero_saves >= STALL_ZERO_SAVES:
                            try:
                                from customer_gateway.zijing_activity_stream import log_result

                                log_result(
                                    "africa_maps_scrape",
                                    f"{country} · 连续 {consecutive_zero_saves} 次零新增 · 换下一国",
                                    platform="maps",
                                    mode=mode_label,
                                    result=f"{valid_now}/{per_target} · 市场饱和/重复",
                                    counts={
                                        "country_valid": valid_now,
                                        "country_target": per_target,
                                        "stall_queries": consecutive_zero_saves,
                                    },
                                )
                            except Exception:
                                pass
                            break

                    delay = _query_delay_sec(run_cfg)
                    if delay > 0:
                        time.sleep(delay)

                if consecutive_zero_saves >= STALL_ZERO_SAVES:
                    break

            if consecutive_zero_saves >= STALL_ZERO_SAVES:
                break
            if exhausted or round_num >= 3:
                break

        progress["country_stats"] = progress.get("country_stats") or {}
        progress["country_stats"][country] = compute_country_stats(progress, country, target=per_target)
        valid_final = _country_valid_count(progress, country)
        stalled_out = consecutive_zero_saves >= STALL_ZERO_SAVES
        done_list = list(progress.get("countries_done") or [])
        if valid_final >= per_target and country not in done_list:
            done_list.append(country)
        elif valid_final < per_target and country in done_list:
            done_list = [c for c in done_list if c != country]
        progress["countries_done"] = sorted(set(done_list))
        progress["country_index"] = ci + 1 if (valid_final >= per_target or stalled_out) else ci
        progress["drafts_created"] = drafts_created
        _save_progress(progress)

        countries_finished_this_run = ci + 1 - idx
        if countries_finished_this_run % report_every == 0 or ci + 1 == end_idx:
            report = format_progress_report(progress, target=per_target)
            st = progress["country_stats"].get(country) or {}
            try:
                from customer_gateway.zijing_activity_stream import log_result

                log_result(
                    "africa_maps_scrape",
                    f"✅ {country} · {valid_final}/{per_target} 有效 · 本轮 +{country_new} · 无效跳过 {country_invalid}",
                    platform="maps",
                    mode="aggressive" if aggressive else "limited",
                    result=report.split("\n")[-2] if report else "",
                    counts={
                        "country_valid": valid_final,
                        "country_target": per_target,
                        "with_phone": st.get("with_phone", 0),
                        "with_email": st.get("with_email", 0),
                        "invalid_skipped": country_invalid,
                        "session_leads": new_leads,
                        "countries_done": len(done_list),
                    },
                )
            except Exception:
                pass
            write_africa_maps_report(progress, target=per_target, live=True)

        if country_delay > 0 and ci + 1 < end_idx:
            time.sleep(country_delay)

    log_step_end(
        "africa_maps_scrape",
        f"本轮 +{new_leads} 有效 · 无效跳过 {invalid_skipped_session} · +{new_drafts} 草稿 · {queries_run} 查询 · 方法 {method}",
        platform="maps",
        status="completed" if new_leads or queries_run else "idle",
    )

    try:
        from customer_gateway.distribution_progress import record_event

        record_event(
            "africa_maps_scrape",
            notify=new_drafts > 0,
            trigger=reason,
            leads=new_leads,
            drafts=new_drafts,
            method=method,
            queries=queries_run,
            countries_done=len(progress.get("countries_done") or []),
        )
    except Exception:
        pass

    return {
        "ok": True,
        "skipped": False,
        "trigger": reason,
        "method": method,
        "aggressive": aggressive,
        "no_cap": no_cap,
        "queries_run": queries_run,
        "new_leads": new_leads,
        "invalid_skipped": invalid_skipped_session,
        "new_drafts": new_drafts,
        "draft_ids": [d for d in draft_ids if d],
        "errors": errors[:20],
        "countries_processed": end_idx - idx,
        "country_index": progress.get("country_index"),
        "countries_total": len(countries),
        "countries_done": len(progress.get("countries_done") or []),
        "totals": progress.get("totals"),
        "report": format_progress_report(progress, target=per_target),
        "drafts_created": drafts_created,
    }

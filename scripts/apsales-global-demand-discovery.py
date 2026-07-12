#!/usr/bin/env python3
"""Discover public global buyer-demand signals for APSales.

Safe boundary:
- reads the approved source registry;
- uses public search result pages only;
- writes local intel JSONL + markdown report;
- does not log in, comment, DM, email, WhatsApp or publish.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sys
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote_plus, unquote, urljoin, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
SOURCE_FILE = ROOT / "config" / "apsales_global_demand_sources.json"
INTEL_FILE = ROOT / "memory" / "customer_gateway" / "global_social_demand_intel.jsonl"
STATE_FILE = ROOT / "memory" / "customer_gateway" / "global_demand_discovery_state.json"
REPORT_FILE = ROOT / "docs" / "agent-reports" / "apsales-global-demand-discovery.md"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/121.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


class LinkExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[dict[str, str]] = []
        self._current_href = ""
        self._current_text: list[str] = []
        self._capture = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        href = dict(attrs).get("href") or ""
        self._current_href = href
        self._current_text = []
        self._capture = bool(href)

    def handle_data(self, data: str) -> None:
        if self._capture:
            self._current_text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() != "a" or not self._capture:
            return
        self.links.append({
            "href": self._current_href,
            "text": clean_text(" ".join(self._current_text)),
        })
        self._current_href = ""
        self._current_text = []
        self._capture = False


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() in {"script", "style", "noscript", "svg"}:
            self._skip_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in {"script", "style", "noscript", "svg"} and self._skip_depth:
            self._skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if not self._skip_depth:
            self.parts.append(data)

    def text(self) -> str:
        return clean_text(" ".join(self.parts))

BUYER_PATTERNS = [
    r"\bwhere can i (buy|get|find)\b",
    r"\bwhere to (buy|get|find)\b",
    r"\blooking for\b",
    r"\bi need\b",
    r"\bneed(ed)?\b",
    r"\bwant to buy\b",
    r"\bwho has\b",
    r"\bcan someone recommend\b",
    r"\brecommend (a )?(supplier|seller|shop)\b",
    r"\bhow much\b",
    r"\bquote\b",
    r"\bprice\b",
]

PRODUCT_PATTERNS = [
    r"\bengine\b",
    r"\bgearbox\b",
    r"\btransmission\b",
    r"\bhalf[- ]?cut\b",
    r"\bspare parts?\b",
    r"\btokunbo\b",
    r"\bused parts?\b",
]

BUYER_PROXIMITY_RE = re.compile(
    r"(where can i|where to|looking for|i need|need|want to buy|who has|recommend|quote|price)"
    r".{0,160}"
    r"(engine|gearbox|transmission|half[- ]?cut|spare parts?|tokunbo|used parts?)"
    r"|"
    r"(engine|gearbox|transmission|half[- ]?cut|spare parts?|tokunbo|used parts?)"
    r".{0,160}"
    r"(where can i|where to|looking for|i need|need|want to buy|who has|recommend|quote|price)",
    re.I,
)

SELLER_PATTERNS = [
    r"\bfor sale\b",
    r"\bavailable\b",
    r"\bstore for\b",
    r"\bgenuine .*spare parts\b",
    r"\bhot deal\b",
    r"\bforeign used\b",
    r"\bwe sell\b",
    r"\bsupplier\b",
    r"\bwholesale\b",
    r"\bcall now\b",
    r"\bcontact us\b",
]

FALSE_BUYER_PATTERNS = [
    r"\breview\b",
    r"\bis it still worth buying\b",
    r"\bthings to know before you buy\b",
    r"\bpalm kernel\b",
    r"\bagriculture\b",
    r"\bhouse clearance\b",
]

NAVIGATION_NOISE = [
    "nairaland forum",
    "posts by",
    "share copy post",
    "whatsapp telegram twitter facebook",
    "login / register",
    "advertise here",
]


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def load_json(path: Path, default: Any) -> Any:
    if not path.is_file():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return default


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def load_registry() -> dict[str, Any]:
    return json.loads(SOURCE_FILE.read_text(encoding="utf-8"))


def stable_key(*parts: str) -> str:
    blob = "\n".join(parts)
    return hashlib.sha1(blob.encode("utf-8")).hexdigest()[:20]


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(text or "")).strip()


def engine_codes() -> list[str]:
    codes: set[str] = set()
    for folder in (ROOT / "knowledge" / "engines", ROOT / "engines"):
        if not folder.is_dir():
            continue
        for path in folder.iterdir():
            if path.suffix.lower() not in {".json", ".html"}:
                continue
            stem = path.stem.lower()
            if stem in {"index", "detail"} or "-v2" in stem:
                continue
            codes.add(stem.upper())
            codes.add(stem.replace("-", "").upper())
    return sorted(codes, key=len, reverse=True)


def detect_engine_codes(text: str, known_codes: list[str]) -> list[str]:
    normalized = re.sub(r"[^a-z0-9]", "", text.lower())
    found: list[str] = []
    for code in known_codes:
        compact = re.sub(r"[^a-z0-9]", "", code.lower())
        if len(compact) < 3:
            continue
        if compact in normalized and code not in found:
            found.append(code)
        if len(found) >= 8:
            break
    return found


def detect_country(text: str, countries: list[str]) -> str:
    lowered = text.lower()
    for country in countries:
        if country.lower() in lowered:
            return country
    aliases = {
        "UAE": ["dubai", "abu dhabi", "sharjah", "emirates"],
        "Ivory Coast": ["cote d'ivoire", "côte d'ivoire", "abidjan"],
        "South Africa": ["south africa", "johannesburg", "durban"],
        "Nigeria": ["lagos", "abuja", "ladipo", "nnewi"],
        "Ghana": ["accra", "kumasi", "tema"],
        "Kenya": ["nairobi", "mombasa"],
        "Tanzania": ["dar es salaam", "arusha"],
    }
    for country in countries:
        for alias in aliases.get(country, []):
            if alias in lowered:
                return country
    return countries[0] if countries else ""


def score_intent(text: str, countries: list[str], known_codes: list[str]) -> tuple[int, str, list[str], list[str]]:
    lowered = text.lower()
    score = 0
    reasons: list[str] = []

    if any(re.search(pattern, lowered) for pattern in BUYER_PATTERNS):
        score += 45
        reasons.append("buyer_language")
    if any(re.search(pattern, lowered) for pattern in PRODUCT_PATTERNS):
        score += 25
        reasons.append("powertrain_product")
    if BUYER_PROXIMITY_RE.search(text):
        score += 20
        reasons.append("buyer_product_proximity")
    detected_codes = detect_engine_codes(text, known_codes)
    if detected_codes:
        score += 20
        reasons.append("engine_code")
    if any(country.lower() in lowered for country in countries):
        score += 10
        reasons.append("target_country")
    if any(re.search(pattern, lowered) for pattern in SELLER_PATTERNS):
        score -= 20
        reasons.append("seller_language")
    if any(re.search(pattern, lowered) for pattern in FALSE_BUYER_PATTERNS):
        score -= 25
        reasons.append("false_buyer_context")

    score = max(0, min(100, score))
    if (
        score >= 70
        and "buyer_language" in reasons
        and "buyer_product_proximity" in reasons
        and "false_buyer_context" not in reasons
        and "seller_language" not in reasons
    ):
        intent = "buyer_demand"
    elif score >= 35:
        intent = "market_signal"
    else:
        intent = "noise"
    return score, intent, reasons, detected_codes


def brave_url(query: str) -> str:
    return f"https://search.brave.com/search?q={quote_plus(query)}&source=web"


def google_url(query: str) -> str:
    return f"https://www.google.com/search?q={quote_plus(query)}&num=20&hl=en"


def direct_search_urls(source: dict[str, Any], query: str) -> list[tuple[str, str]]:
    platform = str(source.get("platform") or "").lower()
    cleaned = re.sub(r"\bsite:[^\s]+\s*", "", query, flags=re.I).strip()
    urls: list[tuple[str, str]] = []
    if "nairaland" in platform:
        urls.append(("Nairaland", f"https://www.nairaland.com/search?q={quote_plus(cleaned)}&board=0"))
    elif platform == "jiji":
        urls.append(("Jiji", f"https://jiji.ng/search?query={quote_plus(cleaned)}"))
    elif platform == "tonaton":
        urls.append(("Tonaton", f"https://tonaton.com/en/ads/ghana?query={quote_plus(cleaned)}"))
    elif platform == "youtube":
        urls.append(("YouTube", f"https://www.youtube.com/results?search_query={quote_plus(cleaned)}"))
    return urls


def allowed_result(source: dict[str, Any], url: str) -> bool:
    platform = str(source.get("platform") or "").lower()
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    path = parsed.path.lower()
    if "nairaland" in platform:
        return host.endswith("nairaland.com") and re.match(r"^/\d+/", path) is not None
    if platform == "jiji":
        return host.endswith("jiji.ng") and any(
            marker in path
            for marker in ("/car-parts-and-accessories", "/12-engines", "/12-gearbox")
        )
    if platform == "tonaton":
        return host.endswith("tonaton.com") and any(
            marker in path
            for marker in ("/auto-parts", "/s_12-engines", "gearbox", "engine")
        )
    if platform == "youtube":
        return host.endswith("youtube.com") and path.startswith("/watch")
    if "facebook" in platform:
        return host.endswith("facebook.com") and "/groups/" in path
    if "pakwheels" in platform:
        return host.endswith("pakwheels.com")
    if "opensooq" in platform:
        return host.endswith("opensooq.com")
    if "dubizzle" in platform:
        return host.endswith("dubizzle.com")
    return True


def can_deep_read(source: dict[str, Any], url: str) -> bool:
    platform = str(source.get("platform") or "").lower()
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    return "nairaland" in platform and host.endswith("nairaland.com")


def fetch(url: str, timeout: int = 35) -> tuple[str, int, str]:
    try:
        req = Request(url, headers=HEADERS)
        with urlopen(req, timeout=timeout) as resp:
            body = resp.read(2_000_000)
            charset = resp.headers.get_content_charset() or "utf-8"
            return body.decode(charset, errors="replace"), int(resp.status), resp.url
    except HTTPError as exc:
        try:
            body = exc.read(500_000).decode("utf-8", errors="replace")
        except Exception:
            body = ""
        return body, int(exc.code), url
    except URLError as exc:
        return "", 0, str(exc)


def extract_target(href: str) -> str:
    if href.startswith("/url?"):
        parsed = parse_qs(urlparse(href).query)
        return unquote(parsed.get("q", [""])[0])
    return href


def parse_search_results(html_text: str, *, engine: str, base_url: str, max_results: int) -> list[dict[str, str]]:
    if "youtube.com" in urlparse(base_url).netloc.lower():
        yt_rows = parse_youtube_results(html_text, max_results=max_results)
        if yt_rows:
            return yt_rows

    parser = LinkExtractor()
    parser.feed(html_text)
    rows: list[dict[str, str]] = []
    seen: set[str] = set()

    candidates = [
        {
            "href": link.get("href") or "",
            "text": link.get("text") or "",
        }
        for link in parser.links
    ]

    for match in re.finditer(r"""(?:"|')(?P<href>(?:https?://www\.nairaland\.com)?/\d+/[^"']+)["']""", html_text):
        href = match.group("href")
        title = clean_text(unquote(href.rsplit("/", 1)[-1].replace("-", " ")))
        candidates.append({"href": href, "text": title})

    for match in re.finditer(r"https?://(?:www\.)?nairaland\.com/\d+/[^\s\"'<>)]+", html_text):
        href = match.group(0)
        title = clean_text(unquote(urlparse(href).path.rsplit("/", 1)[-1].replace("-", " ")))
        candidates.append({"href": href, "text": title})

    for link in candidates:
        href = urljoin(base_url, extract_target(link.get("href") or ""))
        title = clean_text(link.get("text") or "")
        if not href.startswith("http") or not title or len(title) < 8:
            continue
        host = urlparse(href).netloc.lower()
        if any(skip in host for skip in ("google.", "brave.com", "youtube.com/redirect", "webcache.")):
            continue
        if href in seen:
            continue
        seen.add(href)
        snippet = ""
        escaped = re.escape(title[:80])
        m = re.search(escaped + r".{0,500}", clean_text(re.sub(r"<[^>]+>", " ", html_text)), re.I)
        if m:
            snippet = clean_text(m.group(0))[:500]
        rows.append({"title": title, "url": href, "snippet": snippet, "search_engine": engine})
        if len(rows) >= max_results:
            return rows
    return rows[:max_results]


def _decode_js_string(text: str) -> str:
    try:
        return bytes(text, "utf-8").decode("unicode_escape")
    except UnicodeDecodeError:
        return text


def parse_youtube_results(html_text: str, *, max_results: int) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    seen: set[str] = set()
    for match in re.finditer(
        r'"videoId":"(?P<id>[A-Za-z0-9_-]{11})".{0,3500}?"title":\{"runs":\[\{"text":"(?P<title>[^"]+)"',
        html_text,
        re.S,
    ):
        video_id = match.group("id")
        if video_id in seen:
            continue
        seen.add(video_id)
        title = clean_text(_decode_js_string(match.group("title")))
        if not title:
            continue
        url = f"https://www.youtube.com/watch?v={video_id}"
        rows.append({
            "title": title,
            "url": url,
            "snippet": title,
            "search_engine": "YouTube",
        })
        if len(rows) >= max_results:
            break
    return rows


def extract_page_text(html_text: str) -> str:
    parser = TextExtractor()
    parser.feed(html_text)
    text = parser.text()
    for noise in NAVIGATION_NOISE:
        text = re.sub(re.escape(noise), " ", text, flags=re.I)
    return clean_text(text)


def read_public_page_text(url: str, *, max_chars: int = 4000) -> tuple[str, str]:
    html_text, status, final_url = fetch(url)
    if status != 200:
        return "", f"Deep HTTP {status} {final_url}"
    text = extract_page_text(html_text)
    return text[:max_chars], f"Deep HTTP {status} {final_url}"


def search_query(source: dict[str, Any], query: str, *, max_results: int) -> tuple[list[dict[str, str]], list[str]]:
    notes: list[str] = []
    for engine, url in direct_search_urls(source, query):
        html_text, status, final_url = fetch(url)
        notes.append(f"{engine} HTTP {status} {final_url}")
        if status != 200:
            continue
        rows = parse_search_results(html_text, engine=engine, base_url=final_url, max_results=max_results)
        if rows:
            return rows, notes

    for engine, url in (("Brave", brave_url(query)), ("Google", google_url(query))):
        html_text, status, final_url = fetch(url)
        notes.append(f"{engine} HTTP {status} {final_url}")
        if status != 200:
            continue
        rows = parse_search_results(html_text, engine=engine, base_url=final_url, max_results=max_results)
        if rows:
            return rows, notes
    return [], notes


def select_sources(registry: dict[str, Any], priorities: set[str], source_ids: set[str]) -> list[dict[str, Any]]:
    out = []
    for row in registry.get("sources") or []:
        if source_ids and row.get("id") not in source_ids:
            continue
        if not source_ids and str(row.get("priority") or "") not in priorities:
            continue
        out.append(row)
    return out


def append_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")


def discover(args: argparse.Namespace) -> dict[str, Any]:
    registry = load_registry()
    priorities = set(args.priority or ["S"])
    source_ids = set(args.source_id or [])
    sources = select_sources(registry, priorities, source_ids)
    known_codes = engine_codes()
    state = {} if args.ignore_state else load_json(STATE_FILE, {})
    if not isinstance(state, dict):
        state = {}
    seen_keys = set(state.get("seen_keys") or [])

    created: list[dict[str, Any]] = []
    reviewed = 0
    notes: list[str] = []

    for source in sources[: args.max_sources]:
        countries = list(source.get("countries") or [])
        queries = list(source.get("buyer_intent_queries") or []) + list(source.get("target_queries") or [])
        for query in queries[: args.max_queries_per_source]:
            rows, query_notes = search_query(source, query, max_results=args.max_results_per_query)
            notes.extend(f"{source.get('id')} | {query} | {note}" for note in query_notes)
            for item in rows:
                reviewed += 1
                if not allowed_result(source, item.get("url") or ""):
                    continue
                text = clean_text(f"{item.get('title')} {item.get('snippet')}")
                key = stable_key(str(source.get("id") or ""), item.get("url") or "", text)
                if key in seen_keys:
                    continue
                score, intent, reasons, detected_codes = score_intent(text, countries, known_codes)
                deep_text = ""
                if args.deep_read and can_deep_read(source, item.get("url") or ""):
                    deep_text, deep_note = read_public_page_text(item.get("url") or "")
                    notes.append(f"{source.get('id')} | {query} | {deep_note}")
                    if deep_text:
                        deep_score, deep_intent, deep_reasons, deep_codes = score_intent(deep_text, countries, known_codes)
                        if deep_score >= score:
                            score = deep_score
                            intent = deep_intent
                            reasons = sorted(set(reasons + deep_reasons + ["deep_read"]))
                            detected_codes = sorted(set(detected_codes + deep_codes))
                            text = deep_text
                if source.get("type") == "classifieds" and intent == "buyer_demand":
                    intent = "market_signal"
                    reasons.append("classifieds_market_signal_only")
                if source.get("type") == "classifieds" and intent == "market_signal":
                    score = min(score, 60)
                if source.get("type") == "video_comments" and score >= args.min_score:
                    intent = "comment_review_candidate"
                    reasons.append("video_comment_review_candidate")
                if score < args.min_score:
                    continue
                country = detect_country(f"{query} {text}", countries)
                if source.get("type") == "video_comments" and not any(c.lower() in f"{query} {text}".lower() for c in countries):
                    country = "Global"
                record = {
                    "created_at": now_utc(),
                    "source": source.get("id"),
                    "source_platform": source.get("platform"),
                    "source_type": source.get("type"),
                    "region": source.get("region"),
                    "detected_country": country,
                    "countries": countries,
                    "author": item.get("search_engine"),
                    "text": text[:1200],
                    "deep_read": bool(deep_text),
                    "post_url": item.get("url"),
                    "search_query": query,
                    "buyer_intent_score": score,
                    "intent_type": intent,
                    "intent_reasons": reasons,
                    "detected_engine_codes": detected_codes,
                    "potential_lead": intent == "buyer_demand",
                    "recommended_action": (
                        "create_apsales_reply_draft"
                        if intent == "buyer_demand"
                        else "review_public_video_comments"
                        if intent == "comment_review_candidate"
                        else "use_for_market_intelligence_or_content"
                    ),
                    "demand_key": key,
                }
                created.append(record)
                seen_keys.add(key)
            if args.pause_seconds:
                time.sleep(args.pause_seconds)

    if not args.dry_run:
        append_jsonl(INTEL_FILE, created)
        state["updated_at"] = now_utc()
        state["seen_keys"] = sorted(seen_keys)[-5000:]
        save_json(STATE_FILE, state)

    write_report(sources=sources, reviewed=reviewed, created=created, notes=notes, dry_run=args.dry_run)
    return {
        "ok": True,
        "sources": len(sources),
        "reviewed": reviewed,
        "saved": 0 if args.dry_run else len(created),
        "buyer_demand": sum(1 for r in created if r.get("intent_type") == "buyer_demand"),
        "market_signal": sum(1 for r in created if r.get("intent_type") == "market_signal"),
        "comment_review_candidate": sum(1 for r in created if r.get("intent_type") == "comment_review_candidate"),
        "report": str(REPORT_FILE),
        "intel_file": str(INTEL_FILE),
        "dry_run": args.dry_run,
    }


def write_report(*, sources: list[dict[str, Any]], reviewed: int, created: list[dict[str, Any]], notes: list[str], dry_run: bool) -> None:
    REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
    buyer_rows = [r for r in created if r.get("intent_type") == "buyer_demand"]
    comment_rows = [r for r in created if r.get("intent_type") == "comment_review_candidate"]
    market_rows = [r for r in created if r.get("intent_type") == "market_signal"]
    lines = [
        "# APSales Global Demand Discovery",
        "",
        f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        "",
        "## Safety",
        "",
        "- Public search result pages only.",
        "- No login.",
        "- No posting, comments, DMs, email or WhatsApp.",
        "- Writes local intel for APSales approval workflow.",
        "",
        "## Run Summary",
        "",
        f"- Dry run: {str(dry_run).lower()}",
        f"- Sources selected: {len(sources)}",
        f"- Search results reviewed: {reviewed}",
        f"- Records selected: {len(created)}",
        f"- Buyer demand records: {len(buyer_rows)}",
        f"- Comment review candidates: {len(comment_rows)}",
        f"- Market signal records: {len(market_rows)}",
        f"- Intel file: `{INTEL_FILE.relative_to(ROOT)}`",
        "",
        "## Buyer Demand",
        "",
    ]
    if not buyer_rows:
        lines.append("No high-confidence buyer-demand records found in this run.")
    else:
        lines.append("| Score | Deep | Platform | Country | Query | Signal | URL |")
        lines.append("| ---: | --- | --- | --- | --- | --- | --- |")
        for row in buyer_rows[:30]:
            signal = str(row.get("text") or "").replace("|", "/")[:160]
            lines.append(
                f"| {row.get('buyer_intent_score')} | {str(bool(row.get('deep_read'))).lower()} | "
                f"{row.get('source_platform')} | {row.get('detected_country')} | "
                f"{str(row.get('search_query') or '').replace('|', '/')} | {signal} | {row.get('post_url')} |"
            )

    lines.extend(["", "## Comment Review Candidates", ""])
    if not comment_rows:
        lines.append("No video/comment review candidates found in this run.")
    else:
        lines.append("| Score | Platform | Country | Query | Why review comments | URL |")
        lines.append("| ---: | --- | --- | --- | --- | --- |")
        for row in comment_rows[:30]:
            signal = str(row.get("text") or "").replace("|", "/")[:160]
            lines.append(
                f"| {row.get('buyer_intent_score')} | {row.get('source_platform')} | {row.get('detected_country')} | "
                f"{str(row.get('search_query') or '').replace('|', '/')} | {signal} | {row.get('post_url')} |"
            )

    lines.extend(["", "## Market Signals", ""])
    if not market_rows:
        lines.append("No market-signal records found in this run.")
    else:
        lines.append("| Score | Deep | Platform | Country | Query | Signal | URL |")
        lines.append("| ---: | --- | --- | --- | --- | --- | --- |")
        for row in market_rows[:30]:
            signal = str(row.get("text") or "").replace("|", "/")[:160]
            lines.append(
                f"| {row.get('buyer_intent_score')} | {str(bool(row.get('deep_read'))).lower()} | "
                f"{row.get('source_platform')} | {row.get('detected_country')} | "
                f"{str(row.get('search_query') or '').replace('|', '/')} | {signal} | {row.get('post_url')} |"
            )

    lines.extend(["", "## Fetch Notes", ""])
    if not notes:
        lines.append("- No search requests were made.")
    else:
        for note in notes[:80]:
            lines.append(f"- {note}")

    REPORT_FILE.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Discover public global demand signals")
    parser.add_argument("--priority", action="append", help="Priority to include, default S. Repeatable.")
    parser.add_argument("--source-id", action="append", help="Specific source id to include. Repeatable.")
    parser.add_argument("--max-sources", type=int, default=5)
    parser.add_argument("--max-queries-per-source", type=int, default=2)
    parser.add_argument("--max-results-per-query", type=int, default=8)
    parser.add_argument("--min-score", type=int, default=35)
    parser.add_argument("--pause-seconds", type=float, default=1.5)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--ignore-state", action="store_true", help="Ignore local de-dupe state for validation runs")
    parser.add_argument("--deep-read", action="store_true", help="Fetch supported public thread pages and score body text")
    parser.add_argument("--json", action="store_true")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    result = discover(args)
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"Reviewed: {result['reviewed']}")
        print(f"Saved: {result['saved']}")
        print(f"Buyer demand: {result['buyer_demand']}")
        print(f"Report: {result['report']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

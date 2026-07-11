"""Browse Facebook friends/home feed for dismantling & half-cut market signals."""

from __future__ import annotations

import json
import os
import random
import re
import time
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from integrations.social_browser.platform_adapter import (
    SocialBrowserError,
    _dismiss_facebook_overlays,
    verify_login,
)

ROOT = Path(__file__).resolve().parent.parent.parent
NOTES_FILE = ROOT / "memory" / "customer_gateway" / "social_research_notes.jsonl"
INTEL_FILE = ROOT / "memory" / "customer_gateway" / "fb_friends_market_intel.jsonl"
STATE_FILE = ROOT / "memory" / "customer_gateway" / "social_browse_state.json"
MODEL_DICT_FILE = ROOT / "data" / "knowledge-base" / "model-dictionary.json"
ENGINE_DIR_FILE = ROOT / "js" / "engine-directory.js"
UPLOAD_LEARNINGS_FILE = ROOT / "data" / "knowledge-base" / "upload-learnings.json"

FEED_URLS = (
    "https://www.facebook.com/",
    "https://www.facebook.com/?sk=h_chr",
)
FRIENDS_LIST_URLS = (
    "https://www.facebook.com/friends/list",
    "https://www.facebook.com/friends",
)

SIGNAL_KEYWORDS = (
    "half cut",
    "halfcut",
    "half-cut",
    "tokunbo",
    "dismantl",
    "spare part",
    "auto part",
    "engine",
    "gearbox",
    "transmission",
    "jdm",
    "yard",
    "container",
    "nose cut",
    "nosecut",
    "corolla",
    "camry",
    "hilux",
    "vios",
    "accra",
    "lagos",
    "tema",
    "mombasa",
    "nairobi",
    "ghana",
    "nigeria",
    "kenya",
    "dubai",
    "gcc",
    "import",
    "exporter",
    "cif",
    "fob",
    "2nz",
    "1nz",
    "hr16",
    "qr25",
    "g4kd",
)

LEAD_KEYWORDS = (
    "looking for",
    "need",
    "want to buy",
    "who has",
    "anyone selling",
    "supplier",
    "wholesale",
    "import",
    "cif",
    "quote",
    "price",
    "inquiry",
    "enquiry",
    "contact",
    "whatsapp",
    "dm me",
    "for sale",
    "available",
)

BUYER_INTENT_PATTERNS = (
    r"\blooking for\b",
    r"\bneed(?:ed|s)?\b",
    r"\bwant to buy\b",
    r"\bwho has\b",
    r"\banyone (?:selling|has|have)\b",
    r"\bwhere can i (?:buy|find|get)\b",
    r"\bquote\b",
    r"\bprice for\b",
    r"\bhow much\b",
    r"\bsupplier needed\b",
    r"\bplease.*(?:engine|gearbox|half[- ]?cut|spare parts)\b",
)

SELLER_INTENT_PATTERNS = (
    r"\bfor sale\b",
    r"\bavailable\b",
    r"\bin stock\b",
    r"\bnow instock\b",
    r"\bcall or whatsapp\b",
    r"\bclean sharp\b",
    r"\bdistress sale\b",
    r"\bprice[: ]",
    r"\bkes\s*[\d,]+",
    r"\bngn\s*[\d,]+",
    r"\bzwl\s*[\d,]+",
)

SELF_PROMOTION_PATTERNS = (
    "asia-power.com",
    "asiapower",
    "we supply verified",
    "i'm a supplier from china",
    "we list verified real inventory",
    "our live inventory",
    "sales@asia-power.com",
)

COUNTRY_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("Ghana", re.compile(r"\bghana\b|accra|tema|kumasi|\+233", re.I)),
    ("Nigeria", re.compile(r"\bnigeria\b|lagos|abuja|port harcourt|\+234", re.I)),
    ("Kenya", re.compile(r"\bkenya\b|nairobi|mombasa|\+254", re.I)),
    ("Tanzania", re.compile(r"\btanzania\b|dar es salaam|\+255", re.I)),
    ("Uganda", re.compile(r"\buganda\b|kampala|\+256", re.I)),
    ("South Africa", re.compile(r"\bsouth africa\b|johannesburg|cape town|\+27", re.I)),
    ("UAE", re.compile(r"\buae\b|dubai|sharjah|abu dhabi|\+971", re.I)),
    ("Saudi Arabia", re.compile(r"\bsaudi\b|riyadh|jeddah|\+966", re.I)),
    ("Togo", re.compile(r"\btogo\b|lomé|\+228", re.I)),
    ("Benin", re.compile(r"\bbenin\b|cotonou|\+229", re.I)),
    ("Cameroon", re.compile(r"\bcameroon\b|douala|yaoundé|\+237", re.I)),
    ("Senegal", re.compile(r"\bsenegal\b|dakar|\+221", re.I)),
    ("Ivory Coast", re.compile(r"\bivory coast\b|côte d'ivoire|abidjan|\+225", re.I)),
    ("Zambia", re.compile(r"\bzambia\b|lusaka|\+260", re.I)),
    ("Zimbabwe", re.compile(r"\bzimbabwe\b|harare|\+263", re.I)),
    ("Ethiopia", re.compile(r"\bethiopia\b|addis ababa|\+251", re.I)),
    ("Mozambique", re.compile(r"\bmozambique\b|maputo|\+258", re.I)),
    ("DR Congo", re.compile(r"\bcongo\b|kinshasa|\+243", re.I)),
    ("Liberia", re.compile(r"\bliberia\b|monrovia|\+231", re.I)),
    ("China", re.compile(r"\bchina\b|guangzhou|zhengzhou|shanghai|\+86", re.I)),
    ("Japan", re.compile(r"\bjapan\b|jdm|tokyo|osaka|\+81", re.I)),
]

PRICE_PATTERNS = [
    ("USD", re.compile(r"(?:USD|US\$|\$)\s*([\d,]+(?:\.\d{1,2})?)", re.I)),
    ("USD", re.compile(r"([\d,]+(?:\.\d{1,2})?)\s*(?:USD|US\$)", re.I)),
    ("CNY", re.compile(r"(?:CNY|RMB|¥|￥)\s*([\d,]+(?:\.\d{1,2})?)", re.I)),
    ("CNY", re.compile(r"([\d,]+(?:\.\d{1,2})?)\s*(?:CNY|RMB|元)", re.I)),
    ("GHS", re.compile(r"(?:GHS|GH₵|cedi)\s*([\d,]+(?:\.\d{1,2})?)", re.I)),
    ("NGN", re.compile(r"(?:NGN|₦|naira)\s*([\d,]+(?:\.\d{1,2})?)", re.I)),
    ("FOB", re.compile(r"FOB\s*(?:price\s*)?([\d,]+)", re.I)),
    ("CIF", re.compile(r"CIF\s*(?:price\s*)?([\d,]+)", re.I)),
    ("ZWL", re.compile(r"(?:ZWL|Z\$)\s*([\d,]+(?:\.\d{1,2})?)", re.I)),
]

SPONSORED_MARKERS = ("赞助内容", "sponsored", "广告", "promoted")

ENGINE_RE = re.compile(
    r"\b("
    r"G4K[ABCDEJFGNPS]|G4F[ACG]|G4G[CD]|G4N[AD]|G6[BCD]|D4[FHB]|"
    r"HR\d{2}(?:DE)?|MR\d{2}|QR\d{2}(?:DE)?|VQ\d{2,3}|YD\d{2}|CD\d{2}|TD\d{2}|"
    r"1NZ(?:-FE)?|2NZ(?:-FE)?|1ZZ(?:-FE)?|2ZZ(?:-FE)?|3ZZ(?:-FE)?|"
    r"1ZR(?:-FE)?|2ZR(?:-FE)?|3ZR(?:-FE)?|1AZ(?:-FE)?|2AZ(?:-FE)?|"
    r"1KD(?:-FTV)?|2KD(?:-FTV)?|1GR(?:-FE)?|2GR(?:-FE)?|2TR(?:-FE)?|"
    r"1JZ(?:-GE|-GTE)?|2JZ(?:-GE|-GTE)?|1HZ|1HD(?:-FTE)?|"
    r"R18A1?|K20[A-Z]?|K24[A-Z]?|L15[A-Z]?|J35[A-Z]?|"
    r"4B1[12]|4G6[34]|4D56|4N15|6B31|EJ2[05]|"
    r"BYD\d+[A-Z]+|SQRE\d+[A-Z]+|F4J16|EA888|"
    r"W\d{2}B\d{2}[A-Z]\d*|N\d{2}[A-Z]\d*|B\d{2}[A-Z]\d*"
    r")\b",
    re.I,
)

_ENGINE_CODES_CACHE: set[str] | None = None


def _now_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _session_minutes() -> tuple[int, int]:
    lo = int(os.getenv("APSALES_FB_BROWSE_MIN_MINUTES", "5"))
    hi = int(os.getenv("APSALES_FB_BROWSE_MAX_MINUTES", "10"))
    lo = max(3, min(lo, 15))
    hi = max(lo, min(hi, 20))
    return lo, hi


def _max_scrolls() -> int:
    try:
        return max(3, min(30, int(os.getenv("APSALES_FB_BROWSE_MAX_SCROLLS", "12"))))
    except ValueError:
        return 12


def _human_delay(min_s: float = 1.0, max_s: float = 2.5) -> None:
    time.sleep(random.uniform(min_s, max_s))


def _load_state() -> dict[str, Any]:
    if not STATE_FILE.is_file():
        return {}
    try:
        data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError):
        return {}


def _save_state(data: dict[str, Any]) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def _append_note(note: dict[str, Any]) -> None:
    NOTES_FILE.parent.mkdir(parents=True, exist_ok=True)
    with NOTES_FILE.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(note, ensure_ascii=False) + "\n")


def _append_intel(record: dict[str, Any]) -> None:
    INTEL_FILE.parent.mkdir(parents=True, exist_ok=True)
    with INTEL_FILE.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")


def _match_keywords(text: str, keywords: tuple[str, ...]) -> list[str]:
    lower = text.lower()
    return [k for k in keywords if k in lower]


def _load_engine_codes() -> set[str]:
    global _ENGINE_CODES_CACHE
    if _ENGINE_CODES_CACHE is not None:
        return _ENGINE_CODES_CACHE

    codes: set[str] = set()

    if ENGINE_DIR_FILE.is_file():
        for m in re.finditer(r"m\('([^']+)'", ENGINE_DIR_FILE.read_text(encoding="utf-8")):
            code = m.group(1).strip().upper()
            if len(code) >= 3:
                codes.add(code)

    if UPLOAD_LEARNINGS_FILE.is_file():
        try:
            data = json.loads(UPLOAD_LEARNINGS_FILE.read_text(encoding="utf-8"))
            items = data if isinstance(data, list) else data.get("records", [])
            for item in items:
                if isinstance(item, dict):
                    ec = (item.get("engineCode") or item.get("engine_code") or "").strip().upper()
                    if ec:
                        codes.add(ec)
        except (json.JSONDecodeError, OSError):
            pass

    if MODEL_DICT_FILE.is_file():
        try:
            blob = MODEL_DICT_FILE.read_text(encoding="utf-8")
            for m in ENGINE_RE.finditer(blob):
                codes.add(m.group(1).upper())
        except OSError:
            pass

    for m in ENGINE_RE.finditer(
        " ".join(
            [
                "2NZ-FE 1NZ-FE 1KD-FTV 2KD-FTV HR16DE HR15DE QR25DE G4KD G4KJ G4KE G4NA",
                "G4FC G4FG G4FJ 1AZ-FE 2AZ-FE 2ZR-FE 1ZZ-FE 2TR-FE",
            ]
        )
    ):
        codes.add(m.group(1).upper())

    _ENGINE_CODES_CACHE = codes
    return codes


def _normalize_engine_code(raw: str) -> str:
    return raw.strip().upper().replace("  ", " ")


def detect_engine_codes(text: str) -> list[str]:
    """Detect engine codes via regex + knowledge-base catalog."""
    if not text:
        return []
    catalog = _load_engine_codes()
    found: set[str] = set()
    upper = text.upper()

    for m in ENGINE_RE.finditer(text):
        found.add(_normalize_engine_code(m.group(1)))

    for code in catalog:
        pattern = re.compile(r"\b" + re.escape(code).replace(r"\-", r"[-\s]?") + r"\b", re.I)
        if pattern.search(upper):
            found.add(_normalize_engine_code(code))

    return sorted(found)


def detect_prices(text: str) -> list[dict[str, str]]:
    prices: list[dict[str, str]] = []
    seen: set[str] = set()
    for currency, pat in PRICE_PATTERNS:
        for m in pat.finditer(text):
            amount = m.group(1).replace(",", "").strip()
            if not amount or float(amount.replace(".", "", 1).isdigit() is False):
                try:
                    float(amount)
                except ValueError:
                    continue
            key = f"{currency}:{amount}"
            if key in seen:
                continue
            seen.add(key)
            prices.append({"currency": currency, "amount": amount, "raw": m.group(0).strip()})
    return prices


def detect_country(text: str) -> str:
    for name, pat in COUNTRY_PATTERNS:
        if pat.search(text):
            return name
    return ""


def infer_specialty(text: str) -> str:
    lower = text.lower()
    tags: list[str] = []
    if any(k in lower for k in ("half cut", "halfcut", "half-cut", "nose cut", "nosecut")):
        tags.append("半切/half-cut")
    if any(k in lower for k in ("engine only", "engine for sale", "complete engine", "裸发动机")):
        tags.append("发动机")
    elif "engine" in lower or "机" in text:
        tags.append("发动机")
    if any(k in lower for k in ("gearbox", "transmission", "变速箱")):
        tags.append("变速箱")
    if "tokunbo" in lower:
        tags.append("Tokunbo 二手车")
    if any(k in lower for k in ("container", "warehouse", "yard", "dismantl")):
        tags.append("拆车场/批量")
    if any(k in lower for k in ("need 10", "need 5", "bulk", "wholesale", "10 units", "20 units")):
        tags.append("批量需求")
    return " · ".join(tags) if tags else "汽配/拆车"


def _infer_market_signal(text: str, keywords: list[str]) -> str:
    country = detect_country(text)
    if country:
        region = country
    elif any(k in keywords for k in ("ghana", "accra", "tema", "lagos", "nigeria", "mombasa", "kenya", "nairobi")):
        region = "Africa"
    elif any(k in keywords for k in ("dubai", "gcc", "saudi", "uae")):
        region = "Middle East"
    else:
        region = "Global/auto parts"
    return f"{region} · {infer_specialty(text)}"


def _is_sponsored(text: str) -> bool:
    lower = text.lower()
    return any(m.lower() in lower for m in SPONSORED_MARKERS)


def _is_self_promotion(text: str, author: str = "") -> bool:
    lower = f"{author}\n{text}".lower()
    return any(marker in lower for marker in SELF_PROMOTION_PATTERNS)


def _intent_matches(text: str, patterns: tuple[str, ...]) -> int:
    return sum(1 for pat in patterns if re.search(pat, text, re.I))


def score_buyer_intent(text: str, *, author: str = "") -> dict[str, Any]:
    """Classify social feed text for practical sales action.

    This intentionally separates buyer demand from seller listings and our own
    promotion so APSales does not waste follow-up time on the wrong records.
    """
    if not text:
        return {
            "score": 0,
            "intent_type": "empty",
            "recommended_action": "ignore",
            "reasons": [],
        }

    lower = text.lower()
    reasons: list[str] = []
    buyer_hits = _intent_matches(text, BUYER_INTENT_PATTERNS)
    seller_hits = _intent_matches(text, SELLER_INTENT_PATTERNS)
    signals = _match_keywords(text, SIGNAL_KEYWORDS)
    engines = detect_engine_codes(text)
    country = detect_country(text)
    prices = detect_prices(text)

    if _is_self_promotion(text, author):
        return {
            "score": 0,
            "intent_type": "self_promotion",
            "recommended_action": "ignore",
            "reasons": ["AsiaPower/self promotion content"],
        }

    score = 0
    if buyer_hits:
        score += min(45, buyer_hits * 18)
        reasons.append(f"buyer_intent_terms={buyer_hits}")
    if any(k in lower for k in ("engine", "gearbox", "transmission", "half cut", "half-cut", "spare part", "auto part")):
        score += 20
        reasons.append("product_category")
    if engines:
        score += 20
        reasons.append("engine_code")
    if country:
        score += 10
        reasons.append(f"country={country}")
    if any(k in lower for k in ("cif", "fob", "port", "tema", "lagos", "mombasa", "nairobi", "dubai")):
        score += 10
        reasons.append("logistics_signal")
    if prices and buyer_hits:
        score += 5
        reasons.append("price_context")
    if seller_hits and buyer_hits == 0:
        score -= min(35, seller_hits * 12)
        reasons.append(f"seller_listing_terms={seller_hits}")

    score = max(0, min(100, score))
    if score >= 70:
        intent_type = "buyer_demand"
        action = "create_reply_draft"
    elif seller_hits and score < 55:
        intent_type = "seller_listing"
        action = "monitor_market_price"
    elif len(signals) >= 2:
        intent_type = "market_signal"
        action = "save_for_learning"
    else:
        intent_type = "noise"
        action = "ignore"

    return {
        "score": score,
        "intent_type": intent_type,
        "recommended_action": action,
        "reasons": reasons,
    }


def _is_relevant_post(text: str) -> bool:
    if _is_sponsored(text):
        return False
    if _is_self_promotion(text):
        return False
    keywords = _match_keywords(text, SIGNAL_KEYWORDS)
    if len(keywords) >= 2:
        return True
    if detect_engine_codes(text):
        return True
    if detect_prices(text) and any(k in text.lower() for k in ("engine", "half", "cut", "tokunbo", "gearbox")):
        return True
    lower = text.lower()
    if "engine" in lower and detect_country(text):
        return True
    return False


def _build_intel_record(
    *,
    session_id: str,
    author: str,
    text: str,
    post_url: str,
    source: str,
) -> dict[str, Any]:
    snippet = re.sub(r"\s+", " ", text).strip()[:500]
    engines = detect_engine_codes(text)
    prices = detect_prices(text)
    country = detect_country(text)
    keywords = _match_keywords(text, SIGNAL_KEYWORDS)
    intent = score_buyer_intent(text, author=author)
    return {
        "scraped_at": _now_str(),
        "session_id": session_id,
        "author": author[:120],
        "text": snippet,
        "detected_engine_codes": engines,
        "detected_prices": prices,
        "detected_country": country,
        "specialty": infer_specialty(text),
        "market_signal": _infer_market_signal(text, keywords),
        "potential_lead": intent["intent_type"] == "buyer_demand",
        "buyer_intent_score": intent["score"],
        "intent_type": intent["intent_type"],
        "recommended_action": intent["recommended_action"],
        "intent_reasons": intent["reasons"],
        "keywords_matched": keywords[:10],
        "post_url": post_url or "",
        "source": source,
    }


def _extract_posts_from_page(page, *, limit: int = 8) -> list[dict[str, Any]]:
    script = f"""
    () => {{
      const posts = [];
      const seen = new Set();
      const articles = document.querySelectorAll('[role="article"], div[data-pagelet*="FeedUnit"]');
      for (const art of articles) {{
        const text = (art.innerText || '').trim();
        if (!text || text.length < 30 || text.length > 6000) continue;
        const key = text.slice(0, 80);
        if (seen.has(key)) continue;
        seen.add(key);
        let author = '';
        const strong = art.querySelector('strong a, h2 a, h3 a, span a[role="link"]');
        if (strong) author = (strong.innerText || '').trim();
        if (!author) {{
          const lines = text.split('\\n').filter(Boolean);
          author = lines[0] || '';
        }}
        let link = '';
        const timeLink = art.querySelector('a[href*="/posts/"], a[href*="story_fbid"], a[href*="/permalink/"]');
        if (timeLink) link = timeLink.href || '';
        posts.push({{ author, text, link }});
        if (posts.length >= {limit}) break;
      }}
      return posts;
    }}
    """
    try:
        raw = page.evaluate(script)
        return [p for p in (raw or []) if isinstance(p, dict)]
    except Exception:
        return []


def _extract_friend_profile_urls(page, *, limit: int = 30) -> list[dict[str, str]]:
    script = f"""
    () => {{
      const friends = [];
      const seen = new Set();
      const anchors = document.querySelectorAll('a[href*="facebook.com/"]');
      for (const a of anchors) {{
        const href = a.href || '';
        const name = (a.innerText || '').trim();
        if (!href || !name || name.length < 2 || name.length > 80) continue;
        if (href.includes('/friends') || href.includes('/groups/') || href.includes('/watch')) continue;
        if (href.includes('/photo') || href.includes('/videos/') || href.includes('/reel')) continue;
        const m = href.match(/facebook\\.com\\/([^/?]+)/);
        if (!m) continue;
        const slug = m[1];
        if (['www', 'profile.php', 'people', 'pages', 'marketplace', 'gaming'].includes(slug)) continue;
        const key = slug.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        friends.push({{ name, url: href.split('?')[0], slug: key }});
        if (friends.length >= {limit}) break;
      }}
      return friends;
    }}
    """
    try:
        raw = page.evaluate(script)
        return [f for f in (raw or []) if isinstance(f, dict) and f.get("url")]
    except Exception:
        return []


def _maybe_comment(page, post_text: str, post_url: str) -> dict[str, Any] | None:
    if os.getenv("APSALES_FB_BROWSE_COMMENT", "0").strip() != "1":
        return None
    leads = _match_keywords(post_text, LEAD_KEYWORDS)
    signals = _match_keywords(post_text, SIGNAL_KEYWORDS)
    if len(leads) < 2 or len(signals) < 2:
        return None
    templates = [
        "Good question — always match engine + gearbox codes from the donor before you commit on a half-cut.",
        "For rebuild shops, verified photos + compression test beat price-only quotes — ask for engine code and odometer.",
        "Tokunbo importers: check ECU harness and gearbox code match — photos on the listing save port headaches.",
    ]
    text = random.choice(templates)
    if not post_url:
        return {"skipped": True, "reason": "no_post_url"}
    try:
        page.goto(post_url, wait_until="domcontentloaded", timeout=60_000)
        _human_delay(1.5, 2.5)
        _dismiss_facebook_overlays(page)
        box = page.locator('[aria-label="Write a comment"], [aria-label="写评论"], div[role="textbox"]').first
        if not box.count() or not box.is_visible(timeout=3000):
            return {"skipped": True, "reason": "no_comment_box"}
        box.click(timeout=5000)
        _human_delay(0.5, 1.0)
        box.fill(text)
        _human_delay(0.8, 1.5)
        for sel in (
            '[aria-label="Comment"][role="button"]',
            '[aria-label="评论"][role="button"]',
            'div[role="button"]:has-text("Comment")',
            'div[role="button"]:has-text("评论")',
        ):
            btn = page.locator(sel).first
            if btn.count() and btn.is_visible(timeout=1000):
                btn.click(timeout=5000)
                return {"ok": True, "comment": text[:120]}
        return {"skipped": True, "reason": "comment_button_not_found"}
    except Exception as exc:
        return {"skipped": True, "reason": str(exc)[:120]}


def _process_post(
    *,
    session_id: str,
    post: dict[str, Any],
    seen_snippets: set[str],
    source: str,
) -> tuple[dict[str, Any] | None, bool]:
    text = (post.get("text") or "").strip()
    author = (post.get("author") or "unknown").strip()
    snippet = re.sub(r"\s+", " ", text)[:280]
    if not snippet or snippet[:60] in seen_snippets:
        return None, False
    if not _is_relevant_post(text):
        return None, False

    seen_snippets.add(snippet[:60])
    intel = _build_intel_record(
        session_id=session_id,
        author=author,
        text=text,
        post_url=post.get("link") or "",
        source=source,
    )
    _append_intel(intel)

    keywords = intel.get("keywords_matched") or []
    note = {
        "ts": _now_str(),
        "session_id": session_id,
        "friend_name": author[:80],
        "post_snippet": snippet,
        "market_signal": intel["market_signal"],
        "potential_lead": intel["potential_lead"],
        "keywords_matched": keywords[:8],
        "engine_codes": intel["detected_engine_codes"],
        "prices": intel["detected_prices"],
        "country": intel["detected_country"],
        "post_url": intel["post_url"],
    }
    _append_note(note)
    return intel, True


def browse_friends_feed(
    *,
    session_minutes: int | None = None,
    max_scrolls: int | None = None,
    max_posts: int | None = None,
    max_friends: int | None = None,
    deep: bool = False,
    allow_comment: bool | None = None,
    page=None,
    context=None,
) -> dict[str, Any]:
    """
    Scroll Facebook home/friends feed; extract structured market intel.
    deep=True also visits top friend profiles from gooddlong network.
    """
    if page is None:
        from integrations.social_browser.session_manager import acquire_browser

        with acquire_browser("facebook") as sess:
            return browse_friends_feed(
                session_minutes=session_minutes,
                max_scrolls=max_scrolls,
                max_posts=max_posts,
                max_friends=max_friends,
                deep=deep,
                allow_comment=allow_comment,
                page=sess.page,
                context=sess.context,
            )

    lo, hi = _session_minutes()
    duration = session_minutes if session_minutes is not None else random.randint(lo, hi)
    duration = max(3, min(duration, 25))
    scroll_limit = max_scrolls if max_scrolls is not None else _max_scrolls()
    post_cap = max(10, min(200, max_posts or int(os.getenv("APSALES_FB_BROWSE_MAX_POSTS", "50"))))
    friend_cap = max(0, min(50, max_friends or int(os.getenv("APSALES_FB_BROWSE_MAX_FRIENDS", "0"))))
    if deep and friend_cap == 0:
        friend_cap = 20

    if allow_comment is True:
        os.environ["APSALES_FB_BROWSE_COMMENT"] = "1"
    elif allow_comment is False:
        os.environ["APSALES_FB_BROWSE_COMMENT"] = "0"

    session_id = f"browse-{uuid.uuid4().hex[:10]}"
    started = time.time()
    deadline = started + duration * 60
    intel_saved = 0
    posts_scanned = 0
    scrolls = 0
    friends_visited = 0
    commented = False
    errors: list[str] = []
    authors_seen: set[str] = set()

    try:
        page.goto(FEED_URLS[1], wait_until="domcontentloaded", timeout=120_000)
        _human_delay(2.0, 3.5)
        _dismiss_facebook_overlays(page)
        if "login" in page.url.lower():
            page.goto(FEED_URLS[0], wait_until="domcontentloaded", timeout=120_000)
            _human_delay(2.0, 3.0)
        if not verify_login("facebook", page=page, context=context, close=False):
            return {
                "ok": False,
                "error": "not_logged_in",
                "message": "Facebook 未登录 — Mac 上运行 apsales-social-login.py --platform facebook",
            }

        seen_snippets: set[str] = set()

        while time.time() < deadline and scrolls < scroll_limit and posts_scanned < post_cap:
            posts = _extract_posts_from_page(page, limit=12)
            for post in posts:
                if posts_scanned >= post_cap:
                    break
                posts_scanned += 1
                author = (post.get("author") or "").strip()
                if author:
                    authors_seen.add(author.lower())

                intel, saved = _process_post(
                    session_id=session_id,
                    post=post,
                    seen_snippets=seen_snippets,
                    source="home_feed",
                )
                if saved:
                    intel_saved += 1

                if (
                    saved
                    and intel
                    and intel.get("potential_lead")
                    and not commented
                    and os.getenv("APSALES_FB_BROWSE_COMMENT", "0").strip() == "1"
                ):
                    result = _maybe_comment(page, post.get("text", ""), intel.get("post_url", ""))
                    if result and result.get("ok"):
                        commented = True
                    page.goto(FEED_URLS[0], wait_until="domcontentloaded", timeout=120_000)
                    _human_delay(1.5, 2.5)

            scroll_px = random.randint(500, 1000)
            page.mouse.wheel(0, scroll_px)
            scrolls += 1
            _human_delay(2.0, 4.0)

        friend_urls: list[dict[str, str]] = []
        if deep and friend_cap > 0 and time.time() < deadline:
            for url in FRIENDS_LIST_URLS:
                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=90_000)
                    _human_delay(2.0, 3.0)
                    _dismiss_facebook_overlays(page)
                    for _ in range(3):
                        page.mouse.wheel(0, random.randint(400, 800))
                        _human_delay(1.5, 2.5)
                    friend_urls = _extract_friend_profile_urls(page, limit=friend_cap)
                    if friend_urls:
                        break
                except Exception as exc:
                    errors.append(f"friends_list:{str(exc)[:80]}")

            if not friend_urls:
                feed_authors = [{"name": a, "url": "", "slug": a} for a in sorted(authors_seen)[:friend_cap]]
                friend_urls = feed_authors

            for friend in friend_urls[:friend_cap]:
                if time.time() >= deadline or posts_scanned >= post_cap:
                    break
                profile_url = friend.get("url") or ""
                if not profile_url:
                    continue
                try:
                    page.goto(profile_url, wait_until="domcontentloaded", timeout=90_000)
                    _human_delay(2.0, 3.5)
                    _dismiss_facebook_overlays(page)
                    friends_visited += 1
                    for _ in range(4):
                        if posts_scanned >= post_cap:
                            break
                        profile_posts = _extract_posts_from_page(page, limit=6)
                        for post in profile_posts:
                            if posts_scanned >= post_cap:
                                break
                            posts_scanned += 1
                            if not post.get("author"):
                                post["author"] = friend.get("name") or "unknown"
                            _, saved = _process_post(
                                session_id=session_id,
                                post=post,
                                seen_snippets=seen_snippets,
                                source=f"profile:{friend.get('slug', '')}",
                            )
                            if saved:
                                intel_saved += 1
                        page.mouse.wheel(0, random.randint(400, 700))
                        _human_delay(1.5, 2.5)
                except Exception as exc:
                    errors.append(f"profile:{friend.get('slug', '?')}:{str(exc)[:60]}")

        elapsed_min = round((time.time() - started) / 60.0, 1)
        engine_leads = _count_session_engine_leads(session_id)
        state = {
            "last_session_at": _now_str(),
            "last_session_id": session_id,
            "duration_minutes": elapsed_min,
            "posts_scanned": posts_scanned,
            "notes_saved": intel_saved,
            "intel_saved": intel_saved,
            "engine_leads": engine_leads,
            "friends_visited": friends_visited,
            "friends_in_feed": len(authors_seen),
            "scrolls": scrolls,
            "commented": commented,
            "deep": deep,
            "page_url": page.url,
            "intel_file": str(INTEL_FILE),
        }
        _save_state(state)

        try:
            from customer_gateway.distribution_progress import _append_timeline, load_progress, save_progress

            progress = load_progress()
            _append_timeline(
                progress,
                action="engagement_browse_feed",
                summary=f"浏览好友动态 · {intel_saved} 条情报 · {engine_leads} 条发动机线索 · {elapsed_min} 分钟",
                details=state,
            )
            save_progress(progress)
        except Exception:
            pass

        return {
            "ok": True,
            "session_id": session_id,
            "duration_minutes": elapsed_min,
            "posts_scanned": posts_scanned,
            "notes_saved": intel_saved,
            "intel_saved": intel_saved,
            "engine_leads": engine_leads,
            "friends_visited": friends_visited,
            "friends_in_feed": len(authors_seen),
            "scrolls": scrolls,
            "commented": commented,
            "deep": deep,
            "notes_file": str(NOTES_FILE),
            "intel_file": str(INTEL_FILE),
            "state_file": str(STATE_FILE),
            "errors": errors[:5],
        }
    except SocialBrowserError as exc:
        return {"ok": False, "error": str(exc), "intel_saved": intel_saved}
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:200], "intel_saved": intel_saved}


def _count_session_engine_leads(session_id: str) -> int:
    if not INTEL_FILE.is_file():
        return 0
    count = 0
    try:
        for line in INTEL_FILE.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            if row.get("session_id") != session_id:
                continue
            if row.get("detected_engine_codes"):
                count += 1
    except (json.JSONDecodeError, OSError):
        pass
    return count


def load_intel_records(*, session_id: str | None = None) -> list[dict[str, Any]]:
    if not INTEL_FILE.is_file():
        return []
    rows: list[dict[str, Any]] = []
    try:
        for line in INTEL_FILE.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            if session_id and row.get("session_id") != session_id:
                continue
            rows.append(row)
    except (json.JSONDecodeError, OSError):
        pass
    return rows


def aggregate_intel(*, session_id: str | None = None) -> dict[str, Any]:
    rows = load_intel_records(session_id=session_id)
    engine_counts: Counter[str] = Counter()
    country_counts: Counter[str] = Counter()
    authors: set[str] = set()
    priced: list[dict[str, Any]] = []

    for row in rows:
        author = row.get("author") or ""
        if author:
            authors.add(author)
        for code in row.get("detected_engine_codes") or []:
            engine_counts[code] += 1
        country = row.get("detected_country") or ""
        if country:
            country_counts[country] += 1
        for p in row.get("detected_prices") or []:
            priced.append({**p, "author": author, "post_url": row.get("post_url", ""), "text": row.get("text", "")[:120]})

    top_engines = engine_counts.most_common(20)
    return {
        "post_count": len(rows),
        "friend_count": len(authors),
        "top_engines": top_engines,
        "countries": dict(country_counts),
        "priced_posts": priced,
        "records": rows,
    }


def generate_intel_report(
    out_path: Path | str,
    *,
    session_id: str | None = None,
    title_date: str | None = None,
) -> dict[str, Any]:
    agg = aggregate_intel(session_id=session_id)
    rows = agg["records"]
    date_str = title_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    post_n = agg["post_count"]
    friend_n = agg["friend_count"]

    lines = [
        f"# 中东 + 非洲半切市场情报（Facebook 好友动态）",
        "",
        f"> **日期**：{date_str}  ",
        f"> **数据来源**：gooddlong Facebook 好友动态（真实抓取，非推断）  ",
        f"> **样本**：基于今晚浏览 **{post_n}** 条好友帖，涉及 **{friend_n}** 个发帖人",
        "",
        "---",
        "",
        f"## 来自 Facebook 好友动态（{post_n} 条帖子，{friend_n} 个好友）",
        "",
    ]

    if not rows:
        lines.extend([
            "> ⚠️ 本次浏览未抓到含发动机码/半切关键词的帖子。请确认 Mac 已登录 Facebook 并重试。",
            "",
        ])
    else:
        lines.append("| 好友/主页 | 国家线索 | 提到的发动机 | 价格 | 专营 | 帖子链接 |")
        lines.append("|-----------|----------|--------------|------|------|----------|")
        for row in rows[:40]:
            author = (row.get("author") or "—").replace("|", "/")
            country = row.get("detected_country") or "—"
            engines = ", ".join(row.get("detected_engine_codes") or []) or "—"
            prices = row.get("detected_prices") or []
            price_str = " / ".join(f"{p.get('currency')} {p.get('amount')}" for p in prices[:2]) if prices else "—"
            specialty = row.get("specialty") or "—"
            url = row.get("post_url") or "—"
            if url != "—" and len(url) > 48:
                url = url[:45] + "…"
            lines.append(f"| {author} | {country} | {engines} | {price_str} | {specialty} | {url} |")

        lines.extend(["", "### Top 发动机码（按好友帖提及次数）", ""])
        if agg["top_engines"]:
            lines.append("| 发动机码 | 提及次数 | 示例发帖人 |")
            lines.append("|----------|----------|------------|")
            for code, cnt in agg["top_engines"][:15]:
                example_author = "—"
                example_snippet = ""
                for row in rows:
                    if code in (row.get("detected_engine_codes") or []):
                        example_author = row.get("author") or "—"
                        example_snippet = (row.get("text") or "")[:80]
                        break
                lines.append(f"| {code} | {cnt} | {example_author} |")
                if example_snippet:
                    lines.append(f"| | | _{example_snippet}_ |")
        else:
            lines.append("_本次帖子中未检测到发动机码_")

        lines.extend(["", "### 价格区间（仅含明确标价的帖子）", ""])
        priced = agg["priced_posts"]
        if priced:
            by_currency: dict[str, list[float]] = {}
            for p in priced:
                cur = p.get("currency") or "?"
                try:
                    val = float(str(p.get("amount", "")).replace(",", ""))
                    by_currency.setdefault(cur, []).append(val)
                except ValueError:
                    continue
            lines.append("| 币种 | 样本数 | 最低价 | 最高价 |")
            lines.append("|------|--------|--------|--------|")
            for cur, vals in sorted(by_currency.items()):
                lines.append(f"| {cur} | {len(vals)} | {min(vals):,.0f} | {max(vals):,.0f} |")
            lines.append("")
            lines.append("示例标价帖：")
            for p in priced[:5]:
                lines.append(f"- **{p.get('author')}** · {p.get('currency')} {p.get('amount')} · _{p.get('text', '')[:100]}_")
        else:
            lines.append("_本次帖子中无明确标价_")

    lines.extend([
        "",
        "---",
        "",
        "## 方法说明",
        "",
        "- 数据源：Facebook 好友/主页动态（gooddlong 账号，Mac 本地 Playwright）",
        "- 发动机码：regex + `engine-directory.js` + `upload-learnings.json` + `model-dictionary.json` 扫描",
        "- **不**使用 WhatsApp 会话推断排名；WhatsApp 仅作跟进渠道",
        f"- 原始 JSONL：`memory/customer_gateway/fb_friends_market_intel.jsonl`",
        "",
    ])

    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return {"ok": True, "path": str(out), **agg}


def get_browse_summary() -> dict[str, Any]:
    """Return last browse session + total intel counts."""
    state = _load_state()
    total_notes = 0
    total_intel = 0
    total_engine_leads = 0
    if NOTES_FILE.is_file():
        try:
            total_notes = sum(1 for line in NOTES_FILE.read_text(encoding="utf-8").splitlines() if line.strip())
        except OSError:
            pass
    if INTEL_FILE.is_file():
        try:
            for line in INTEL_FILE.read_text(encoding="utf-8").splitlines():
                if not line.strip():
                    continue
                total_intel += 1
                row = json.loads(line)
                if row.get("detected_engine_codes"):
                    total_engine_leads += 1
        except (json.JSONDecodeError, OSError):
            pass
    return {
        "last_session_at": state.get("last_session_at"),
        "last_duration_minutes": state.get("duration_minutes"),
        "last_notes_saved": state.get("intel_saved", state.get("notes_saved", 0)),
        "last_intel_saved": state.get("intel_saved", state.get("notes_saved", 0)),
        "last_engine_leads": state.get("engine_leads", 0),
        "last_posts_scanned": state.get("posts_scanned", 0),
        "last_friends_visited": state.get("friends_visited", 0),
        "total_notes": total_notes,
        "total_intel": total_intel,
        "total_engine_leads": total_engine_leads,
        "notes_file": str(NOTES_FILE),
        "intel_file": str(INTEL_FILE),
    }

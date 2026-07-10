"""Resolve WhatsApp contact display names from query + local chat records."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
INBOUND_DIR = ROOT / "memory" / "customer_gateway" / "inbound_messages"
DRAFT_DIR = ROOT / "memory" / "customer_gateway" / "draft_queue"
PROFILE_DIR = ROOT / "memory" / "customer_gateway" / "customer_profiles"
CONVERSATIONS_DIR = ROOT / "memory" / "sales_intelligence" / "conversations"
ALIASES_PATH = ROOT / "data" / "customer_gateway" / "whatsapp_contact_aliases.json"
CUSTOMERS_MD_CANDIDATES = (
    ROOT / "data" / "knowledge-base" / "customers-asiapower.md",
    Path.home() / ".openclaw" / "workspace" / "memory" / "customers-asiapower.md",
)

_PHONE_LIKE_RE = re.compile(r"^[\s+\-().\u202a-\u202e\u200e\u200f\d]{8,}$")
_DIGITS_RE = re.compile(r"\d")


def normalize_phone_digits(text: str) -> str:
    """Strip formatting; keep country code digits only."""
    raw = (text or "").strip()
    if not raw:
        return ""
    digits = "".join(_DIGITS_RE.findall(raw))
    if raw.strip().startswith("+"):
        return digits
    if digits.startswith("0") and len(digits) >= 9:
        return digits.lstrip("0")
    return digits


def is_phone_like(text: str) -> bool:
    digits = normalize_phone_digits(text)
    return len(digits) >= 8 and (
        _PHONE_LIKE_RE.match((text or "").strip()) is not None
        or sum(ch.isdigit() for ch in text) >= max(8, len(text) * 0.5)
    )


def phone_display_variants(digits: str) -> list[str]:
    """Common WhatsApp sidebar title formats for a digit string."""
    d = normalize_phone_digits(digits)
    if not d:
        return []
    variants: list[str] = [d, f"+{d}"]
    if d.startswith("233") and len(d) >= 11:
        local = d[3:]
        if len(local) == 9:
            variants.extend([
                f"+233 {local[:2]} {local[2:5]} {local[5:]}",
                f"+233 {local[:3]} {local[3:6]} {local[6:]}",
                f"+233{local}",
            ])
    out: list[str] = []
    seen: set[str] = set()
    for item in variants:
        key = normalize_phone_digits(item)
        if key and key not in seen:
            seen.add(key)
            out.append(item)
    return out


def phone_matches(a: str, b: str) -> bool:
    da, db = normalize_phone_digits(a), normalize_phone_digits(b)
    if not da or not db:
        return False
    if da == db:
        return True
    return da.endswith(db) or db.endswith(da)


def normalize_contact_key(name: str) -> str:
    return re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "", (name or "").lstrip("~").lower())


def contact_query_tokens(query: str) -> list[str]:
    q = re.sub(r"\s+", " ", (query or "").lstrip("~").strip().lower())
    if is_phone_like(q):
        digits = normalize_phone_digits(q)
        return [digits[-9:]] if len(digits) >= 9 else [digits]
    tokens = [t for t in re.split(r"[\s,._-]+", q) if len(t) >= 2]
    if tokens:
        return tokens
    compact = q.replace(" ", "")
    return [compact] if compact else []


def name_matches_query(name: str, query: str) -> bool:
    if is_phone_like(query):
        return phone_matches(name, query)
    tokens = contact_query_tokens(query)
    if not tokens:
        return False
    hay = (name or "").lower()
    norm = normalize_contact_key(name)
    return all(t in hay or t in norm for t in tokens)


def score_name_match(name: str, query: str) -> int:
    if is_phone_like(query) and phone_matches(name, query):
        da = normalize_phone_digits(name)
        db = normalize_phone_digits(query)
        if da == db:
            return 300
        return 220
    tokens = contact_query_tokens(query)
    if not tokens or not name:
        return 0
    hay = name.lower()
    norm = normalize_contact_key(name)
    score = 0
    if normalize_contact_key(query) == norm:
        score += 200
    for token in tokens:
        if re.search(rf"\b{re.escape(token)}\b", hay):
            score += 20
        elif token in hay:
            score += 12
        elif token in norm:
            score += 8
    score -= min(len(name) // 20, 5)
    return score


def contact_title_variants(contact: str) -> list[str]:
    raw = (contact or "").strip()
    if not raw:
        return []
    base = raw.lstrip("~").strip()
    collapsed = re.sub(r"\s+", " ", base)
    variants = [raw, base, collapsed, f"~{collapsed}"]
    if " " in collapsed:
        variants.append(collapsed.replace(" ", "  "))
    if is_phone_like(raw):
        variants.extend(phone_display_variants(raw))
    out: list[str] = []
    seen: set[str] = set()
    for name in variants:
        key = normalize_contact_key(name) or normalize_phone_digits(name)
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(name)
    return out


def _load_aliases_file() -> dict[str, Any]:
    if not ALIASES_PATH.is_file():
        return {}
    try:
        return json.loads(ALIASES_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _parse_customers_md_phones() -> dict[str, dict[str, Any]]:
    """Parse ## Name + **电话：** lines from customers-asiapower.md."""
    out: dict[str, dict[str, Any]] = {}
    for path in CUSTOMERS_MD_CANDIDATES:
        if not path.is_file():
            continue
        current_name = ""
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.startswith("## "):
                current_name = line[3:].strip()
                continue
            if not current_name:
                continue
            m = re.search(r"\*\*电话：\*\*\s*(.+)", line)
            if not m:
                continue
            phone_raw = m.group(1).strip()
            if "未知" in phone_raw or "unknown" in phone_raw.lower():
                continue
            digits = normalize_phone_digits(phone_raw)
            if not digits:
                continue
            entry = out.setdefault(current_name, {"phones": [], "whatsapp_titles": []})
            if digits not in entry["phones"]:
                entry["phones"].append(digits)
            for title in phone_display_variants(digits):
                if title not in entry["whatsapp_titles"]:
                    entry["whatsapp_titles"].append(title)
    return out


def load_contact_aliases() -> dict[str, dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for src in (_load_aliases_file(), _parse_customers_md_phones()):
        for name, row in src.items():
            entry = merged.setdefault(name, {"phones": [], "whatsapp_titles": [], "notes": ""})
            for phone in row.get("phones") or []:
                d = normalize_phone_digits(str(phone))
                if d and d not in entry["phones"]:
                    entry["phones"].append(d)
            for title in row.get("whatsapp_titles") or []:
                t = str(title).strip()
                if t and t not in entry["whatsapp_titles"]:
                    entry["whatsapp_titles"].append(t)
            note = str(row.get("notes") or "").strip()
            if note:
                entry["notes"] = note
    return merged


def _alias_name_matches(name: str, query: str) -> bool:
    name_l = name.lower()
    q = query.strip().lower()
    if not q:
        return False
    if q in name_l or name_l in q:
        return True
    tokens = contact_query_tokens(query)
    name_norm = normalize_contact_key(name)
    q_norm = normalize_contact_key(query)
    if q_norm and q_norm == name_norm:
        return True
    return bool(tokens) and all(t in name_l or t in name_norm for t in tokens)


def search_aliases(query: str, *, limit: int = 8) -> list[dict[str, Any]]:
    hits: list[dict[str, Any]] = []
    for name, row in load_contact_aliases().items():
        if not _alias_name_matches(name, query):
            continue
        titles = list(row.get("whatsapp_titles") or [])
        for phone in row.get("phones") or []:
            titles.extend(phone_display_variants(str(phone)))
        seen: set[str] = set()
        titles_out: list[str] = []
        for title in titles:
            key = normalize_phone_digits(title) or title
            if key in seen:
                continue
            seen.add(key)
            titles_out.append(title)
        hits.append({
            "alias_name": name,
            "whatsapp_titles": titles_out,
            "phones": list(row.get("phones") or []),
            "score": score_name_match(name, query) + 50,
            "source": "alias_directory",
        })
    hits.sort(key=lambda row: -int(row.get("score") or 0))
    return hits[:limit]


def resolve_query_targets(query: str) -> dict[str, Any]:
    """Expand a name or phone query into WhatsApp sidebar titles + search strings."""
    q = (query or "").strip()
    titles: list[str] = []
    search_strings: list[str] = []
    alias_names: list[str] = []

    if is_phone_like(q):
        search_strings.append(q)
        titles.extend(phone_display_variants(q))
    else:
        for hit in search_aliases(q, limit=5):
            alias_names.append(str(hit.get("alias_name") or ""))
            titles.extend(hit.get("whatsapp_titles") or [])
            for phone in hit.get("phones") or []:
                search_strings.extend(phone_display_variants(str(phone)))
        tokens = contact_query_tokens(q)
        if tokens:
            search_strings.append(q)

    if is_phone_like(q):
        digits = normalize_phone_digits(q)
        if digits:
            search_strings.append(digits)
            if digits.startswith("233"):
                search_strings.append(digits[3:])

    out_titles: list[str] = []
    seen: set[str] = set()
    for title in titles:
        for variant in contact_title_variants(title):
            key = normalize_phone_digits(variant) or normalize_contact_key(variant)
            if key and key not in seen:
                seen.add(key)
                out_titles.append(variant)

    out_search: list[str] = []
    seen_s: set[str] = set()
    for s in search_strings + out_titles:
        s = (s or "").strip()
        if not s:
            continue
        key = normalize_phone_digits(s) or s.lower()
        if key not in seen_s:
            seen_s.add(key)
            out_search.append(s)

    return {
        "query": q,
        "whatsapp_titles": out_titles,
        "search_strings": out_search,
        "alias_names": [n for n in alias_names if n],
        "phone_digits": normalize_phone_digits(q) if is_phone_like(q) else "",
    }


def extract_chat_phone(chat: dict[str, Any]) -> str:
    for key in ("phone", "id"):
        raw = str(chat.get(key) or "")
        if "@" in raw:
            raw = raw.split("@", 1)[0]
        digits = normalize_phone_digits(raw)
        if len(digits) >= 8:
            return digits
    name = str(chat.get("name") or "")
    if is_phone_like(name):
        return normalize_phone_digits(name)
    return ""


def _collect_names_from_json_file(path: Path, fields: tuple[str, ...]) -> set[str]:
    names: set[str] = set()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return names
    if isinstance(data, dict):
        for field in fields:
            val = str(data.get(field) or "").strip()
            if val and val.lower() not in {"unknown", "you"}:
                names.add(val)
    return names


def search_local_contact_names(query: str, *, limit: int = 15) -> list[dict[str, Any]]:
    """Search aliases, inbound messages, drafts, profiles, conversations."""
    scored: dict[str, int] = {}
    meta: dict[str, dict[str, Any]] = {}

    def bump(name: str, bonus: int = 0, *, force: bool = False, **extra: Any) -> None:
        name = (name or "").strip()
        if not name:
            return
        if not force and not name_matches_query(name, query):
            return
        key = name
        scored[key] = max(scored.get(key, 0), score_name_match(name, query) + bonus)
        meta.setdefault(key, {}).update(extra)

    for hit in search_aliases(query, limit=limit):
        bonus = int(hit.get("score") or 0)
        for title in hit.get("whatsapp_titles") or []:
            bump(
                str(title),
                bonus=bonus + 100,
                force=True,
                alias_name=hit.get("alias_name"),
                source="alias_directory",
            )

    if INBOUND_DIR.is_dir():
        for path in INBOUND_DIR.glob("*.json"):
            for name in _collect_names_from_json_file(
                path, ("contact_name", "customer_name"),
            ):
                bump(name, bonus=5, source="inbound")

    if DRAFT_DIR.is_dir():
        for path in DRAFT_DIR.glob("*.json"):
            for name in _collect_names_from_json_file(path, ("customer_name",)):
                bump(name, bonus=3, source="draft")

    if PROFILE_DIR.is_dir():
        for path in PROFILE_DIR.glob("*.json"):
            for name in _collect_names_from_json_file(path, ("contact_name",)):
                bump(name, bonus=2, source="profile")

    if CONVERSATIONS_DIR.is_dir():
        for path in CONVERSATIONS_DIR.glob("*.json"):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                name = str(data.get("contact") or data.get("contact_name") or "").strip()
                bump(name, bonus=4, source="conversation")
            except Exception:
                continue

    ranked = sorted(scored.items(), key=lambda item: (-item[1], len(item[0])))
    return [
        {
            "name": name,
            "score": score,
            "source": meta.get(name, {}).get("source", "local_records"),
            "alias_name": meta.get(name, {}).get("alias_name", ""),
        }
        for name, score in ranked[:limit]
    ]


def rank_store_chats(chats: list[dict[str, Any]], query: str, *, limit: int = 10) -> list[dict[str, Any]]:
    targets = resolve_query_targets(query)
    query_digits = normalize_phone_digits(query)
    ranked: list[tuple[int, dict[str, Any]]] = []
    for chat in chats or []:
        name = str(chat.get("name") or "").strip()
        if not name or name.lower() == "unknown":
            continue
        chat_phone = extract_chat_phone(chat)
        score = 0
        if name_matches_query(name, query):
            score = max(score, score_name_match(name, query))
        if query_digits and chat_phone and phone_matches(chat_phone, query_digits):
            score = max(score, 280 if chat_phone == query_digits else 240)
        for title in targets.get("whatsapp_titles") or []:
            if phone_matches(name, title) or name.strip() == title.strip():
                score = max(score, 290)
            elif name_matches_query(name, title):
                score = max(score, 200)
        if score <= 0:
            continue
        ranked.append((score, chat))
    ranked.sort(key=lambda item: (-item[0], len(item[1].get("name", ""))))
    out: list[dict[str, Any]] = []
    for score, chat in ranked[:limit]:
        out.append({
            "name": chat.get("name"),
            "index": chat.get("index"),
            "id": chat.get("id"),
            "phone": extract_chat_phone(chat),
            "is_group": chat.get("is_group"),
            "score": score,
            "source": "whatsapp_store",
        })
    return out

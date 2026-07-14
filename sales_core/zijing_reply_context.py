"""子敬 WhatsApp 自动回复 — 训练规则 + 快速话术（CEO 定稿写入此处 / SOP）."""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOP_PATH = ROOT / "docs" / "customer-service-sop.md"
TRAINING_DIR = ROOT / "docs" / "zijing-training"
LIVE_RULES_PATH = TRAINING_DIR / "LIVE-RULES.md"
# Cap injected markdown so prompts stay within model context budgets.
_LIVE_RULES_MAX_CHARS = 7000
_SOP_CUSTOMER_MAX_CHARS = 2500

_GREETING_ONLY_RE = re.compile(
    r"^(?:hi+|hello+|hey+|good\s+(?:morning|afternoon|evening))[\s!?.]*$",
    re.I,
)
_HOW_ARE_YOU_RE = re.compile(
    r"^how\s+(?:are\s+you|you\s+doing|is\s+it\s+going)[\s!?.]*$",
    re.I,
)
_MORE_INFO_RE = re.compile(
    r"(?:can i get more info|more info on this|need more info)",
    re.I,
)

# APSALES-P0: price intent — advance sale, never dead-end at "cannot quote"
_PRICE_INQUIRY_RE = re.compile(
    r"(?:"
    r"how\s*much|best\s*price|lowest\s*price|price\s*list|pricelist|"
    r"\bquotation\b|\bquote\b|\bpricing\b|\bcost\b|\bcheap(?:er)?\b|"
    r"\bprix\b|\bdevis\b|سعر|报价|多少钱|什么价|价格"
    r")",
    re.I,
)

_PRICE_ADVANCE_EN = (
    "Yes — we can help with pricing.\n\n"
    "To quote the correct engine/parts, I need the exact vehicle first "
    "(wrong code = wrong price).\n\n"
    "Please send:\n"
    "• VIN, or vehicle model + year + engine code\n"
    "• What you need (long block / complete engine / gearbox / accessories)\n"
    "• Quantity + destination port\n\n"
    "Once we have that, we check the right one and move to quotation.\n\n"
    "www.asia-power.com"
)

_PRICE_ADVANCE_FR = (
    "Oui — nous pouvons vous aider pour le prix.\n\n"
    "Pour un devis exact, j'ai besoin du véhicule précis "
    "(mauvais code = mauvais prix).\n\n"
    "Merci d'envoyer:\n"
    "• VIN, ou modèle + année + code moteur\n"
    "• Besoin (long block / complete engine / gearbox)\n"
    "• Quantité + port de destination\n\n"
    "Ensuite on vérifie et on avance vers le devis.\n\n"
    "www.asia-power.com"
)

_PRICE_ADVANCE_AR = (
    "نعم — يمكننا المساعدة في السعر.\n\n"
    "للتسعير الصحيح نحتاج مواصفات السيارة أولاً "
    "(كود خاطئ = سعر خاطئ).\n\n"
    "يرجى إرسال:\n"
    "• VIN أو الموديل + السنة + كود المحرك\n"
    "• المطلوب (long block / complete engine / gearbox)\n"
    "• الكمية + ميناء الوصول\n\n"
    "بعدها نتحقق ونتقدم نحو عرض السعر.\n\n"
    "www.asia-power.com"
)


def is_price_inquiry(message: str) -> bool:
    """True when buyer is asking for price / quotation / cheap / price list."""
    body = (message or "").strip()
    if not body:
        return False
    return bool(_PRICE_INQUIRY_RE.search(body))


def zijing_price_advance_reply(message: str = "") -> str:
    """
    Price-intent reply via Commercial Decision Rules V1 (one NBA).
    Never invent a price number.
    """
    try:
        from sales_core.commercial_decision import decide_commercial

        return decide_commercial(message or "").reply
    except Exception:
        inbound = message or ""
        if re.search(r"[\u0600-\u06FF]", inbound):
            return _PRICE_ADVANCE_AR
        if re.search(r"\b(?:bonjour|salut|merci|prix|devis|combien)\b", inbound, re.I):
            return _PRICE_ADVANCE_FR
        # Fallback: one identity ask — not the old fixed trio
        return (
            "Yes — we can help with pricing once identity is solid.\n\n"
            "Please send the VIN (or a clear engine plate photo)."
        )


def _clip(text: str, max_chars: int) -> str:
    s = (text or "").strip()
    if len(s) <= max_chars:
        return s
    return s[: max_chars - 1].rstrip() + "…"


def _read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return ""


@lru_cache(maxsize=4)
def _cached_file(path_str: str, mtime_ns: int) -> str:
    return _read_text(Path(path_str))


def _load_watched(path: Path) -> str:
    if not path.is_file():
        return ""
    try:
        mtime_ns = path.stat().st_mtime_ns
    except OSError:
        return _read_text(path)
    return _cached_file(str(path), mtime_ns)


def load_zijing_live_rules() -> str:
    """CEO training distilled for customer-facing auto-reply (no private session PII)."""
    return _clip(_load_watched(LIVE_RULES_PATH), _LIVE_RULES_MAX_CHARS)


def load_zijing_sop_customer_slice() -> str:
    """
    Customer-facing slices from SOP (skip「给龙哥四段中文」draft format).
    """
    raw = _load_watched(SOP_PATH)
    if not raw:
        return ""
    # Keep sections that matter for live customer replies; drop draft-to-CEO format.
    keep_headers = (
        "## 二、标准开场话术",
        "## 三、车型知识",
        "## 四、报价规范",
        "## 五、库存查询",
    )
    chunks: list[str] = []
    parts = re.split(r"(?=^## )", raw, flags=re.M)
    for part in parts:
        if any(part.startswith(h) for h in keep_headers):
            chunks.append(part.strip())
    return _clip("\n\n".join(chunks), _SOP_CUSTOMER_MAX_CHARS)


def zijing_training_rules_addon() -> str:
    """Condensed rules for APSales WhatsApp auto-reply prompt (+ live training files)."""
    base = (
        "Zijing (子敬) trained WhatsApp rules — MUST follow:\n"
        "- Sound like a real person texting, not a call center. Short lines.\n"
        "- Do NOT start every message with `Hello sir`.\n"
        "- Never use corporate filler like \"I'd be happy to help\" / \"Great news!\".\n"
        "- Existing customer sent only `Hi`/`Hello` with no new question → reply `Hi` only.\n"
        "- Vague opener → website + ask need: www.asia-power.com + What you need?\n"
        "- Specific enquiry → still include www.asia-power.com once if not just sent.\n"
        "- Price / quotation / best price / cheap / price list: NEVER stop at "
        "'cannot quote'. Explain why VIN/model is needed, ask for VIN or model+year+"
        "engine code, then advance toward quotation. Never invent a price number.\n"
        "- Never auto-send a numeric price, payment, shipping, container, duty, "
        "discount — collect facts first, then escalate quote numbers to CEO if needed.\n"
        "- GHS / RMB / USD — never guess currency conversion.\n"
        "- Ghana local stock: say ready to collect in GHS when applicable.\n"
        "- China late night: say photos/videos tomorrow morning, don't promise instant.\n"
    )
    live = load_zijing_live_rules()
    sop = load_zijing_sop_customer_slice()
    parts = [base]
    if live:
        parts.append("--- Zijing LIVE-RULES.md (CEO training; highest priority) ---\n" + live)
    if sop:
        parts.append("--- customer-service-sop (customer-facing slices) ---\n" + sop)
    return "\n\n".join(parts)


def zijing_quick_reply(message: str, *, contact_name: str = "") -> str | None:
    """
    Rule-based instant reply for WhatsApp auto-send (no LLM).
    Returns plain English text only, or None to fall through to LLM draft.
    """
    body = (message or "").strip()
    if not body:
        return None

    if _GREETING_ONLY_RE.match(body):
        return "Hi"

    if _HOW_ARE_YOU_RE.match(body):
        return "Good thanks, you?\n\nwww.asia-power.com\n\nWhat you need?"

    if _MORE_INFO_RE.search(body):
        return (
            "Hello! Welcome to AsiaPower 🙏\n\n"
            "Please visit our website: www.asia-power.com\n\n"
            "What are you looking for?"
        )

    if is_price_inquiry(body):
        return zijing_price_advance_reply(body)

    return None

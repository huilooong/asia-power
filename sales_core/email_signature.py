"""Professional email signatures and formatting for APSales outbound drafts."""

from __future__ import annotations

import re

_DRAFT_META_RE = re.compile(
    r"\n?\(Draft informed by sales intelligence — not sent\.\)\s*$",
    re.I,
)

_SIGNATORY = {
    "zh": "鲁子敬\n国际销售经理",
    "en": "Zijing Lu\nInternational Sales Manager",
    "fr": "Zijing Lu\nResponsable commercial international",
    "ar": "Zijing Lu\nمدير المبيعات الدولية",
}

_EMAIL_SIGNATURES: dict[str, str] = {
    "zh": (
        "AsiaPower · 全球循环经济供应链公司\n"
        "BSB Motors\n\n"
        "销售咨询：sales@asia-power.com\n"
        "官网：https://asia-power.com\n\n"
        "中国办公室：河南省郑州市南三环与商都路\n"
        "微信：16638801930（请通过微信联系，不接手机来电）\n\n"
        "加纳办公室：Ghana, Accra, Tabora, Flower Street No.2\n"
        "WhatsApp：+86 166 3880 1930"
    ),
    "en": (
        "AsiaPower · Global Circular Economy Supply Chain\n"
        "BSB Motors\n\n"
        "Sales: sales@asia-power.com\n"
        "Web: https://asia-power.com\n\n"
        "China Office: Zhengzhou, Henan\n"
        "WeChat: 16638801930 (WeChat messages only — no mobile/voice calls)\n\n"
        "Ghana Office: Accra, Ghana, Tabora, Flower Street No.2\n"
        "WhatsApp: +86 166 3880 1930"
    ),
    "fr": (
        "AsiaPower · Chaîne d'approvisionnement de l'économie circulaire\n"
        "BSB Motors\n\n"
        "Ventes : sales@asia-power.com\n"
        "Site : https://asia-power.com\n\n"
        "Bureau Chine : Zhengzhou, Henan\n"
        "WeChat : 16638801930 (contact via WeChat uniquement — pas d'appels téléphoniques)\n\n"
        "Bureau Ghana : Accra, Tabora, Flower Street No.2\n"
        "WhatsApp : +86 166 3880 1930"
    ),
    "ar": (
        "AsiaPower · سلسلة توريد الاقتصاد الدائري العالمية\n"
        "BSB Motors\n\n"
        "المبيعات: sales@asia-power.com\n"
        "الموقع: https://asia-power.com\n\n"
        "مكتب الصين: Zhengzhou, Henan\n"
        "WeChat: 16638801930 (تواصل عبر WeChat فقط — لا مكالمات هاتفية)\n\n"
        "مكتب غانا: Accra, Tabora, Flower Street No.2\n"
        "WhatsApp: +86 166 3880 1930"
    ),
}


def email_signature(lang: str) -> str:
    code = lang if lang in _EMAIL_SIGNATURES else "en"
    person = _SIGNATORY.get(code, _SIGNATORY["en"])
    company = _EMAIL_SIGNATURES[code]
    return f"{person}\n\n--\n{company}"


def strip_draft_meta(text: str) -> str:
    return _DRAFT_META_RE.sub("", (text or "").strip()).strip()


def has_email_signature(text: str) -> bool:
    body = text or ""
    return "sales@asia-power.com" in body and ("鲁子敬" in body or "Zijing Lu" in body)


def append_email_signature(body: str, lang: str) -> str:
    clean = strip_draft_meta(body)
    sig = email_signature(lang)
    if "鲁子敬" in clean or "Zijing Lu" in clean:
        return clean
    if _EMAIL_SIGNATURES.get(lang, _EMAIL_SIGNATURES["en"]).splitlines()[0] in clean:
        return clean
    return f"{clean.rstrip()}\n\n{sig}"


def finalize_email_draft(body: str, lang: str) -> str:
    """Customer-facing email draft: no internal meta, with company signature."""
    return append_email_signature(strip_draft_meta(body), lang)

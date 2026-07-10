"""Platform supply wording — APSales must not imply self-owned stock by default."""

from __future__ import annotations

import re

SUPPLY_PHRASES = {
    "en": "We can check available supply from our verified China-based supplier network.",
    "zh": "我们可以从已验证的中国供应商网络为您查询供货情况。",
    "fr": "Nous pouvons vérifier les disponibilités auprès de notre réseau de fournisseurs vérifiés en Chine.",
    "ar": "يمكننا التحقق من التوفر من شبكة الموردين المعتمدة لدينا في الصين.",
}

STOCK_CLAIM_RE = re.compile(
    r"\b(we have (it )?in stock|we have stock|we currently have|yes,? we have|"
    r"available in our warehouse|our stock|we own)\b",
    re.I,
)


def supply_phrase(lang: str) -> str:
    return SUPPLY_PHRASES.get(lang, SUPPLY_PHRASES["en"])


def extract_product_keywords(message: str) -> list[str]:
    """Extract likely product codes/terms for inventory search."""
    text = message or ""
    keywords: list[str] = []
    for m in re.finditer(r"\b([A-Z]{1,3}\d{2,4}[A-Z]?)\b", text):
        keywords.append(m.group(1))
    for term in ("G4KJ", "G4KD", "G4NA", "HR15DE", "HR16DE", "engine", "gearbox", "half-cut"):
        if term.lower() in text.lower() and term not in keywords:
            keywords.append(term)
    return keywords[:3]


def inventory_ownership_label(hit: bool) -> str:
    if hit:
        return "platform_catalog_match — supplier-listed signal found (not AsiaPower-owned unless verified)"
    return "unconfirmed — treat as supplier-network sourcing; AsiaPower does not assume ownership"

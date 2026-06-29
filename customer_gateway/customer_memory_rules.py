"""APLIVE-003 — rules for when inbound messages may write long-term memory."""

from __future__ import annotations

import re
from typing import Any

_COUNTRY_RE = re.compile(
    r"\b(?:ghana|nigeria|kenya|uae|dubai|accra|lagos|tema|port|country|nigeria|saudi)\b",
    re.I,
)
_COUNTRY_ZH_RE = re.compile(r"(?:国家|港口|目的港|城市|加纳|尼日利亚|肯尼亚|迪拜)")
_COMPANY_RE = re.compile(
    r"\b(?:trading|motors|auto|company|ltd|limited|corp|enterprise|import)\b",
    re.I,
)
_PRODUCT_HISTORY_RE = re.compile(
    r"\b(?:regular (?:buyer|order)|monthly order|always buy|usual product|reorder)\b",
    re.I,
)
_DEAL_RE = re.compile(
    r"\b(?:paid|payment received|invoice|shipped|delivered|deal closed|成交|已付款|已发货)\b",
    re.I,
)
_TERMS_RE = re.compile(
    r"\b(?:fob|cif|cfr|exw|incoterms|payment terms|tt advance|lc at sight|信用证|付款方式)\b",
    re.I,
)
_PRICE_SENS_RE = re.compile(
    r"\b(?:too expensive|best price|discount|budget|target price|价格太高|最低价)\b",
    re.I,
)
_LONG_TERM_RE = re.compile(
    r"\b(?:long.?term|monthly|agent|distributor|exclusive|长期合作|代理|独家)\b",
    re.I,
)


def evaluate_memory_write(
    message: str,
    *,
    contact_name: str = "",
    classification: str = "",
) -> dict[str, Any]:
    """
    MEMORY_TO_SAVE gate — generic single-line enquiries do NOT write long-term memory.
    """
    body = (message or "").strip()
    reasons: list[str] = []

    if _COUNTRY_RE.search(body) or _COUNTRY_ZH_RE.search(body):
        reasons.append("country_or_port")
    if _COMPANY_RE.search(body):
        reasons.append("company_signal")
    if _PRODUCT_HISTORY_RE.search(body):
        reasons.append("purchase_pattern")
    if _DEAL_RE.search(body):
        reasons.append("deal_record")
    if _TERMS_RE.search(body):
        reasons.append("trade_terms")
    if _PRICE_SENS_RE.search(body):
        reasons.append("price_sensitivity")
    if _LONG_TERM_RE.search(body):
        reasons.append("long_term_intent")

    if reasons:
        return {
            "memory_write": True,
            "memory_reason": "满足长期记忆条件: " + ", ".join(reasons),
        }

    if classification in ("customer_followup",) and _COUNTRY_RE.search(contact_name):
        return {
            "memory_write": True,
            "memory_reason": "跟进客户且联系人含地区信息",
        }

    return {
        "memory_write": False,
        "memory_reason": "普通询盘，仅作为 draft context，不写入长期记忆",
    }

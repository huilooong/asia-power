"""APLIVE-003 — inbound WhatsApp message classifier (Sales Brain v1)."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Any

from sales_core.platform_supply import extract_product_keywords

CLASSIFICATIONS = (
    "customer_inquiry",
    "customer_followup",
    "supplier_message",
    "internal_message",
    "private_message",
    "system_notification",
    "marketing_spam",
    "unknown",
)

DRAFT_ACTION = "generate_draft"
IGNORE_ACTION = "ignore"
INTERNAL_ACTION = "internal_only"

_SYSTEM_PATTERNS = [
    re.compile(r"\btrending products?\b", re.I),
    re.compile(r"\bneeds your attention\b", re.I),
    re.compile(r"\bwheelsky\b", re.I),
    re.compile(r"\bnotification\b", re.I),
    re.compile(r"\balert\b", re.I),
    re.compile(r"\bverification code\b", re.I),
    re.compile(r"\bsecurity code\b", re.I),
    re.compile(r"\byour (?:order|account|subscription)\b", re.I),
    re.compile(r"\bunread messages?\b", re.I),
    re.compile(r"\b(?:promo|promotion|discount offer)\b", re.I),
    re.compile(r"\bclick here to (?:view|see|update)\b", re.I),
    re.compile(r"需要您的关注"),
    re.compile(r"热门产品"),
    re.compile(r"系统通知"),
]

_MARKETING_PATTERNS = [
    re.compile(r"\blimited time offer\b", re.I),
    re.compile(r"\bact now\b", re.I),
    re.compile(r"\bfree shipping\b", re.I),
    re.compile(r"\b(?:sale|clearance) (?:ends|ending)\b", re.I),
    re.compile(r"\bunsubscribe\b", re.I),
]

_PRIVATE_CONTACT_TERMS = (
    "老婆", "老公", "爸", "妈", "父亲", "母亲", "儿子", "女儿",
    "wife", "husband", "mom", "dad", "mother", "father", "family",
)

_PRIVATE_MESSAGE_PATTERNS = [
    re.compile(r"^(?:老婆|老公|爸|妈|亲爱的).{0,20}$"),
    re.compile(r"^(?:hi honey|miss you|love you)\b", re.I),
]

_SUPPLIER_PATTERNS = [
    re.compile(r"\b(?:工厂|供应商|供货|厂家|库存确认|到货通知|发货清单)\b"),
    re.compile(r"\b(?:supplier|factory|warehouse|stock confirm|shipment ready)\b", re.I),
    re.compile(r"\b(?:we can supply|our factory|MOQ|ex.?factory)\b", re.I),
]

_SUPPLIER_CONTACT_HINTS = re.compile(
    r"(?:工厂|supplier|supply co|parts factory|拆车厂|配件厂|trade co\.?\s*ltd)",
    re.I,
)

_INTERNAL_PATTERNS = [
    re.compile(r"\b(?:asiapower|asia power)\s+(?:team|internal|staff)\b", re.I),
    re.compile(r"\b(?:内部|同事|开会|日报|周报)\b"),
    re.compile(r"^/(?:remember|recall|pipeline|drafts)\b", re.I),
]

_GREETING_PATTERNS = [
    re.compile(r"^(?:hi+|hello+|hey+)[\s!?.]*$", re.I),
    re.compile(r"^how\s+(?:are\s+you|you\s+doing)[\s!?.]*$", re.I),
]

_FOLLOWUP_PATTERNS = [
    re.compile(r"\b(?:follow(?:ing)? up|any update|still waiting|checking back|remind)\b", re.I),
    re.compile(r"\b(?:上次|跟进|有消息吗|update on my order)\b", re.I),
]

_INQUIRY_PATTERNS = [
    re.compile(r"\b(?:do you have|have you got|available|in stock|looking for|need)\b", re.I),
    re.compile(r"\b(?:price|quote|quotation|how much|cost)\b", re.I),
    re.compile(r"\b(?:engine|gearbox|motor|half.?cut|chassis|g4k|1nz|2kd)\b", re.I),
    re.compile(r"\b(?:ship|shipping|fob|cif|port)\b", re.I),
]


@dataclass
class InboundClassification:
    classification: str
    confidence: float
    action: str
    reasoning_summary: str
    intent_category: str = "unknown"

    def to_audit_dict(self) -> dict[str, Any]:
        return {
            "classification": self.classification,
            "confidence": self.confidence,
            "action": self.action,
            "reasoning_summary": self.reasoning_summary,
            "intent_category": self.intent_category,
        }


def _env_contacts(name: str) -> frozenset[str]:
    raw = os.getenv(name, "").strip()
    if not raw:
        return frozenset()
    return frozenset(x.strip().lower() for x in raw.split(",") if x.strip())


def _contact_matches(contact: str, terms: tuple[str, ...] | frozenset[str]) -> bool:
    c = (contact or "").strip().lower()
    if not c:
        return False
    for term in terms:
        t = term.lower()
        if c == t or t in c:
            return True
    return False


def _intent_subcategory(text: str) -> str:
    from customer_gateway.message_classifier import classify_text
    return classify_text(text, is_ceo=False)


def classify_inbound_message(
    message: str,
    *,
    contact_name: str = "",
) -> InboundClassification:
    body = (message or "").strip()
    contact = (contact_name or "").strip()

    if not body:
        return InboundClassification(
            classification="unknown",
            confidence=0.3,
            action=IGNORE_ACTION,
            reasoning_summary="空消息，忽略。",
        )

    private_contacts = _env_contacts("WHATSAPP_PRIVATE_CONTACTS")
    supplier_contacts = _env_contacts("WHATSAPP_SUPPLIER_CONTACTS")

    if _contact_matches(contact, _PRIVATE_CONTACT_TERMS) or _contact_matches(contact, private_contacts):
        return InboundClassification(
            classification="private_message",
            confidence=0.95,
            action=IGNORE_ACTION,
            reasoning_summary=f"联系人「{contact}」判定为私人/家庭联系人，不生成销售草稿。",
        )

    for pat in _PRIVATE_MESSAGE_PATTERNS:
        if pat.search(body) and not extract_product_keywords(body):
            return InboundClassification(
                classification="private_message",
                confidence=0.9,
                action=IGNORE_ACTION,
                reasoning_summary="私人对话内容，无商业询盘信号。",
            )

    if _contact_matches(contact, supplier_contacts) or _SUPPLIER_CONTACT_HINTS.search(contact):
        return InboundClassification(
            classification="supplier_message",
            confidence=0.92,
            action=IGNORE_ACTION,
            reasoning_summary=f"联系人「{contact}」判定为供应商侧，不生成客户销售草稿。",
        )

    for pat in _SUPPLIER_PATTERNS:
        if pat.search(body) and not _looks_like_buyer_enquiry(body):
            return InboundClassification(
                classification="supplier_message",
                confidence=0.88,
                action=IGNORE_ACTION,
                reasoning_summary="供应商/工厂侧消息模式，非买家询盘。",
            )

    for pat in _INTERNAL_PATTERNS:
        if pat.search(body) or pat.search(contact):
            return InboundClassification(
                classification="internal_message",
                confidence=0.85,
                action=INTERNAL_ACTION,
                reasoning_summary="内部/团队消息，不生成客户销售草稿。",
            )

    for pat in _SYSTEM_PATTERNS:
        if pat.search(body):
            return InboundClassification(
                classification="system_notification",
                confidence=0.93,
                action=IGNORE_ACTION,
                reasoning_summary="系统/平台通知类消息，忽略。",
            )

    for pat in _MARKETING_PATTERNS:
        if pat.search(body):
            return InboundClassification(
                classification="marketing_spam",
                confidence=0.9,
                action=IGNORE_ACTION,
                reasoning_summary="营销推广/垃圾消息，忽略。",
            )

    intent = _intent_subcategory(body)
    keywords = extract_product_keywords(body)

    for pat in _GREETING_PATTERNS:
        if pat.search(body) and not keywords:
            return InboundClassification(
                classification="customer_followup",
                confidence=0.9,
                action=DRAFT_ACTION,
                reasoning_summary="客户寒暄/打招呼，短回复即可（子敬自动发送低风险）。",
                intent_category="follow_up",
            )

    for pat in _FOLLOWUP_PATTERNS:
        if pat.search(body):
            return InboundClassification(
                classification="customer_followup",
                confidence=0.86,
                action=DRAFT_ACTION,
                reasoning_summary="客户跟进消息，可生成销售回复草稿。",
                intent_category=intent,
            )

    if keywords or any(pat.search(body) for pat in _INQUIRY_PATTERNS):
        conf = 0.92 if keywords else 0.78
        return InboundClassification(
            classification="customer_inquiry",
            confidence=conf,
            action=DRAFT_ACTION,
            reasoning_summary=f"买家询盘（产品/可用性/价格信号: {', '.join(keywords[:3]) or 'general'}）。",
            intent_category=intent,
        )

    return InboundClassification(
        classification="unknown",
        confidence=0.4,
        action=IGNORE_ACTION,
        reasoning_summary="无法识别为有效买家询盘，默认忽略。",
        intent_category=intent,
    )


def _looks_like_buyer_enquiry(text: str) -> bool:
    return bool(
        extract_product_keywords(text)
        or re.search(r"\b(?:do you have|price|quote|buy|need|looking for)\b", text, re.I)
    )


def should_generate_draft(result: InboundClassification) -> bool:
    return result.action == DRAFT_ACTION and result.classification in {
        "customer_inquiry", "customer_followup",
    }

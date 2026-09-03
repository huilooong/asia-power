"""Validated models for the APBD solo-trade workbench."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _clean_list(values: list[str] | tuple[str, ...]) -> tuple[str, ...]:
    result: list[str] = []
    seen: set[str] = set()
    for raw in values:
        value = " ".join(str(raw or "").strip().split())
        if not value:
            continue
        key = value.casefold()
        if key in seen:
            continue
        seen.add(key)
        result.append(value)
    return tuple(result)


class CRMStatus(str, Enum):
    NEW = "new"
    RESEARCHED = "researched"
    DRAFT_READY = "draft_ready"
    APPROVAL_PENDING = "approval_pending"
    APPROVED = "approved"
    SENT = "sent"
    OPENED = "opened"
    REPLIED = "replied"
    QUALIFIED = "qualified"
    DISQUALIFIED = "disqualified"
    REJECTED = "rejected"


@dataclass(frozen=True)
class CampaignBrief:
    product_keywords: tuple[str, ...]
    target_markets: tuple[str, ...]
    customer_types: tuple[str, ...]
    search_depth: int = 2
    max_customers: int = 20
    output_language: str = "en"
    enable_contact_enrichment: bool = False
    enable_ai_scoring: bool = True

    def __post_init__(self) -> None:
        object.__setattr__(self, "product_keywords", _clean_list(self.product_keywords))
        object.__setattr__(self, "target_markets", _clean_list(self.target_markets))
        object.__setattr__(self, "customer_types", _clean_list(self.customer_types))
        if not self.product_keywords:
            raise ValueError("At least one product keyword is required")
        if not self.target_markets:
            raise ValueError("At least one target market is required")
        if not self.customer_types:
            raise ValueError("At least one customer type is required")
        if self.search_depth not in (1, 2, 3):
            raise ValueError("search_depth must be 1, 2, or 3")
        if not 1 <= self.max_customers <= 200:
            raise ValueError("max_customers must be between 1 and 200")
        if self.output_language not in ("en", "zh", "bilingual"):
            raise ValueError("output_language must be en, zh, or bilingual")

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["product_keywords"] = list(self.product_keywords)
        data["target_markets"] = list(self.target_markets)
        data["customer_types"] = list(self.customer_types)
        return data

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> CampaignBrief:
        return cls(
            product_keywords=tuple(data.get("product_keywords") or ()),
            target_markets=tuple(data.get("target_markets") or ()),
            customer_types=tuple(data.get("customer_types") or ()),
            search_depth=int(data.get("search_depth") or 2),
            max_customers=int(data.get("max_customers") or 20),
            output_language=str(data.get("output_language") or "en"),
            enable_contact_enrichment=bool(data.get("enable_contact_enrichment", False)),
            enable_ai_scoring=bool(data.get("enable_ai_scoring", True)),
        )


@dataclass(frozen=True)
class ExternalApproval:
    approved: bool
    approved_by: str
    approval_id: str
    approved_at: str = field(default_factory=utc_now_iso)

    def validate(self) -> None:
        if not self.approved:
            raise PermissionError("External send approval is required")
        if not self.approved_by.strip():
            raise PermissionError("approved_by is required")
        if not self.approval_id.strip():
            raise PermissionError("approval_id is required")

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

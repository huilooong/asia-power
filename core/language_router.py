"""Unified Language Policy Engine — sole language decision layer for AI OS."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_POLICY_PATH = ROOT / "config" / "language_policy.yaml"

# Script / marker heuristics (extensible per language family)
_CJK_RE = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf]")
_ARABIC_RE = re.compile(r"[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]")
_FR_MARKERS = re.compile(
    r"\b(bonjour|merci|moteur|prix|devis|livraison|camion|pièces|"
    r"combien|français|francais|besoin|achat)\b",
    re.I,
)
_EN_MARKERS = re.compile(
    r"\b(hello|hi|thanks|thank you|please|price|quote|delivery|engine|"
    r"stock|enquiry|inquiry|fob|cif|need|want|available)\b",
    re.I,
)

LANGUAGE_LABELS: dict[str, str] = {
    "zh": "Chinese",
    "en": "English",
    "fr": "French",
    "ar": "Arabic",
    "pt": "Portuguese",
    "es": "Spanish",
    "sw": "Swahili",
    "ja": "Japanese",
    "ko": "Korean",
    "th": "Thai",
    "vi": "Vietnamese",
}

BUYER_COUNTERPARTS = frozenset({"buyer", "customer", "client"})
SUPPLIER_COUNTERPARTS = frozenset({"supplier", "vendor"})
BUYER_AGENTS = frozenset({"apsales", "apmarketing", "apcustomersuccess"})
SUPPLY_AGENTS = frozenset({"apsupply", "apinventory"})

_DRAFT_INSTRUCTIONS: dict[str, str] = {
    "en": "Write the customer draft in professional English only. Never use Chinese.",
    "zh": "客户草稿使用专业中文，勿混用英文（产品型号、FOB/CIF 等术语除外）。",
    "fr": "Write the customer draft in professional French only. Never use Chinese.",
    "ar": "Write the customer draft in professional Arabic only. Never use Chinese.",
}

_SUPPLIER_INSTRUCTIONS: dict[str, str] = {
    "zh": "使用专业中文与供应商沟通。",
    "en": "Write in professional English for this supplier.",
}


def _normalize_id(name: str) -> str:
    return (name or "").strip().lower().replace("-", "_")


class LanguageRouter:
    """Central language policy — internal, buyer, and supplier scenarios."""

    def __init__(self, policy: dict[str, Any] | None = None) -> None:
        self._policy = policy or self._default_policy()
        self._internal = frozenset(
            _normalize_id(p) for p in self._policy.get("internal", {}).get("participants", [])
        )
        self._buyer_cfg = self._policy.get("buyer", {})
        self._supplier_cfg = self._policy.get("supplier", {})

    @staticmethod
    def _default_policy() -> dict[str, Any]:
        return {
            "internal": {"default": "zh", "participants": list(_default_internal_participants())},
            "buyer": {"default": "en", "auto_detect": True, "supported": ["en", "zh", "fr", "ar"]},
            "supplier": {"default": "zh", "auto_detect": True, "supported": ["zh", "en"]},
            "future": {"extensible": True},
        }

    @classmethod
    def from_yaml(cls, path: Path | str | None = None) -> LanguageRouter:
        policy_path = Path(path) if path else DEFAULT_POLICY_PATH
        if policy_path.is_file():
            data = yaml.safe_load(policy_path.read_text(encoding="utf-8")) or {}
            return cls(data)
        return cls()

    def reload(self, path: Path | str | None = None) -> None:
        """Reload policy from disk (runtime refresh)."""
        refreshed = self.from_yaml(path)
        self._policy = refreshed._policy
        self._internal = refreshed._internal
        self._buyer_cfg = refreshed._buyer_cfg
        self._supplier_cfg = refreshed._supplier_cfg

    @property
    def policy(self) -> dict[str, Any]:
        return self._policy

    def classify_scenario(self, actor: str, counterpart: str) -> str:
        """Return internal | buyer | supplier."""
        a, c = _normalize_id(actor), _normalize_id(counterpart)

        if c in BUYER_COUNTERPARTS:
            return "buyer"
        if c in SUPPLIER_COUNTERPARTS:
            return "supplier"
        if a in self._internal and c in self._internal:
            return "internal"
        if a in BUYER_AGENTS:
            return "buyer"
        if a in SUPPLY_AGENTS:
            return "supplier"
        return "internal"

    def supported_for(self, scenario: str) -> frozenset[str]:
        if scenario == "buyer":
            return frozenset(self._buyer_cfg.get("supported", ["en", "zh", "fr", "ar"]))
        if scenario == "supplier":
            return frozenset(self._supplier_cfg.get("supported", ["zh", "en"]))
        return frozenset({self._policy.get("internal", {}).get("default", "zh")})

    def default_for(self, scenario: str) -> str:
        if scenario == "buyer":
            return str(self._buyer_cfg.get("default", "en"))
        if scenario == "supplier":
            return str(self._supplier_cfg.get("default", "zh"))
        return str(self._policy.get("internal", {}).get("default", "zh"))

    def auto_detect_enabled(self, scenario: str) -> bool:
        if scenario == "buyer":
            return bool(self._buyer_cfg.get("auto_detect", True))
        if scenario == "supplier":
            return bool(self._supplier_cfg.get("auto_detect", True))
        return False

    def detect_language(self, text: str, *, scenario: str | None = None) -> str:
        """
        Detect language code from message text.
        When scenario is set, only returns codes in that scenario's supported list.
        """
        body = (text or "").strip()
        scenario = scenario or "buyer"
        supported = self.supported_for(scenario)
        default = self.default_for(scenario)

        if not body:
            return default

        if "ar" in supported and _ARABIC_RE.search(body):
            return "ar"

        if "zh" in supported and _CJK_RE.search(body):
            return "zh"

        if "fr" in supported and _FR_MARKERS.search(body):
            return "fr"

        if scenario == "supplier" and "en" in supported:
            latin = sum(1 for ch in body if ch.isascii() and ch.isalpha())
            cjk = len(_CJK_RE.findall(body))
            if latin > cjk and _EN_MARKERS.search(body):
                return "en"
            if cjk == 0 and latin > 8:
                return "en"

        if scenario == "buyer" and "en" in supported and not (
            "zh" in supported and _CJK_RE.search(body)
        ):
            return "en"

        return default

    def resolve_target_language(self, actor: str, counterpart: str, message: str) -> str:
        """
        Resolve the language agents should use for a communication turn.
        Internal: always policy internal default (Chinese).
        Buyer: English default; French/Arabic when detected.
        Supplier: Chinese default; English when supplier writes in English.
        """
        scenario = self.classify_scenario(actor, counterpart)
        if scenario == "internal":
            return self.default_for("internal")

        if self.auto_detect_enabled(scenario):
            detected = self.detect_language(message, scenario=scenario)
            if detected in self.supported_for(scenario):
                return detected

        return self.default_for(scenario)

    def language_label(self, code: str) -> str:
        return LANGUAGE_LABELS.get(code, code.upper())

    def customer_draft_instruction(self, lang: str) -> str:
        """Prompt fragment for buyer-facing draft language."""
        code = lang if lang in self.supported_for("buyer") else self.default_for("buyer")
        return _DRAFT_INSTRUCTIONS.get(
            code,
            f"Write the customer draft in professional {self.language_label(code)} only. "
            "Never use Chinese.",
        )

    def supplier_instruction(self, lang: str) -> str:
        code = lang if lang in self.supported_for("supplier") else self.default_for("supplier")
        return _SUPPLIER_INSTRUCTIONS.get(
            code,
            f"Write in professional {self.language_label(code)} for this supplier.",
        )

    def internal_channel_addon(self, channel: str = "telegram") -> str:
        """System-prompt addon for internal CEO/APCOO channels."""
        if channel == "telegram":
            return (
                "\n\n与 CEO 通过 Telegram 沟通时，默认使用中文回复，"
                "遵循沟通标准：先结论、再原因、再建议。不要输出程序员日志或模型调试信息。"
                "CEO 问状态/进展时优先报内部运营，不要泛泛介绍官网对外卖点。"
            )
        return (
            "\n\n内部沟通默认使用中文：先结论、再原因、再建议。"
            "不要输出程序员日志或模型调试信息。"
        )

    def buyer_facing_rules(self) -> str:
        supported = ", ".join(
            self.language_label(c) for c in sorted(self.supported_for("buyer"))
        )
        return (
            f"Customer drafts: professional {supported} only — use the resolved buyer language; "
            "never expose AI, approval workflow, or internal structure."
        )

    def internal_rules(self) -> str:
        return (
            f"Internal communication with CEO/APCOO/agents/audit/memory/approval: "
            f"{self.language_label(self.default_for('internal'))} only (mandatory)."
        )

    def apsales_prompt_lines(self, profile: dict | None = None) -> list[str]:
        """Language policy lines for APSales system prompt."""
        langs = ", ".join(self.language_label(c) for c in sorted(self.supported_for("buyer")))
        lines = [
            self.internal_rules(),
            f"Customer draft languages: {langs} (auto-detect when buyer writes in them).",
            self.buyer_facing_rules(),
        ]
        if profile:
            lines.insert(
                1,
                f"- Internal language: {profile.get('internal_language', self.default_for('internal'))}",
            )
        return lines


_router: LanguageRouter | None = None


def _default_internal_participants() -> list[str]:
    return [
        "ceo", "apcoo", "apsales", "apsupply", "apinventory",
        "apcustomersuccess", "apmarketing", "apfinance",
        "audit", "memory", "approval",
    ]


def get_router() -> LanguageRouter:
    global _router
    if _router is None:
        _router = LanguageRouter.from_yaml()
    return _router


def init_language_policy(path: Path | str | None = None) -> LanguageRouter:
    """Load policy at runtime bootstrap; returns the shared router."""
    global _router
    _router = LanguageRouter.from_yaml(path)
    return _router


def detect_language(text: str, *, scenario: str | None = None) -> str:
    return get_router().detect_language(text, scenario=scenario)


def resolve_target_language(actor: str, counterpart: str, message: str) -> str:
    return get_router().resolve_target_language(actor, counterpart, message)


def language_label(code: str) -> str:
    return get_router().language_label(code)


def customer_draft_instruction(lang: str) -> str:
    return get_router().customer_draft_instruction(lang)


# Backward-compatible alias used by APSales before APAI-011
def detect_customer_language(text: str) -> str:
    return detect_language(text, scenario="buyer")

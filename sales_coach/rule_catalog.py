"""Stable Sales Coach rule_id catalog (identity for cooldown / dispatch).

rule_hint stays human-readable; rule_id is the only identity key.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

_CATALOG_PATH = Path(__file__).resolve().parent / "rule_catalog.json"
_LEGACY_MAP_PATH = Path(__file__).resolve().parent / "rule_catalog_legacy_map.json"


def catalog_path() -> Path:
    return _CATALOG_PATH


@lru_cache(maxsize=1)
def load_catalog() -> dict[str, Any]:
    data = json.loads(_CATALOG_PATH.read_text(encoding="utf-8"))
    rules = data.get("rules") or []
    by_id: dict[str, dict[str, Any]] = {}
    alias_to_id: dict[str, str] = {}
    for rule in rules:
        rid = str(rule.get("id") or "").strip()
        if not rid:
            continue
        by_id[rid] = rule
        alias_to_id[_norm_key(rid)] = rid
        for alias in rule.get("legacy_aliases") or []:
            key = _norm_key(str(alias))
            if key:
                alias_to_id[key] = rid
    # Exact legacy strings from production pending / escalation_state (no fuzzy merge).
    exact_legacy: dict[str, str] = {}
    if _LEGACY_MAP_PATH.is_file():
        try:
            raw = json.loads(_LEGACY_MAP_PATH.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                for k, v in raw.items():
                    ks = str(k).strip()
                    vs = str(v).strip()
                    if ks and vs and vs in by_id:
                        exact_legacy[ks] = vs
                        alias_to_id[_norm_key(ks)] = vs
        except (json.JSONDecodeError, OSError):
            pass
    unclassified = str(data.get("unclassified_id") or "unclassified").strip() or "unclassified"
    return {
        "version": data.get("version") or 1,
        "unclassified_id": unclassified,
        "by_id": by_id,
        "alias_to_id": alias_to_id,
        "exact_legacy": exact_legacy,
        "rules": rules,
    }


def reload_catalog() -> dict[str, Any]:
    load_catalog.cache_clear()
    return load_catalog()


def known_rule_ids() -> list[str]:
    cat = load_catalog()
    return sorted(cat["by_id"].keys())


def unclassified_id() -> str:
    return str(load_catalog()["unclassified_id"])


def is_known_rule_id(rule_id: str) -> bool:
    rid = (rule_id or "").strip()
    if not rid:
        return False
    return rid in load_catalog()["by_id"]


def catalog_prompt_block() -> str:
    """Compact catalog block for the LLM system prompt."""
    lines = [
        "RULE_ID CATALOG (you MUST pick rule_id from this list; never invent new ids):",
        f"- {unclassified_id()}: use ONLY when no catalog rule fits",
    ]
    for rule in load_catalog()["rules"]:
        rid = rule["id"]
        summary = str(rule.get("summary") or "").strip()
        lines.append(f"- {rid}: {summary}")
    return "\n".join(lines)


def resolve_stable_rule_id(
    *,
    rule_id: str | None = None,
    rule_hint: str | None = None,
    allow_hint_alias: bool = False,
) -> str:
    """Map raw LLM / pending fields → stable catalog id.

    Identity priority:
    1) explicit rule_id if known
    2) legacy alias match on rule_id (old snake_case Chinese-derived ids)
    3) optional legacy alias match on rule_hint (migration / detectors only)
    4) unclassified — NEVER invent identity from free-text hint at runtime
    """
    cat = load_catalog()
    unc = cat["unclassified_id"]
    aliases: dict[str, str] = cat["alias_to_id"]
    exact: dict[str, str] = cat.get("exact_legacy") or {}
    by_id: dict[str, dict[str, Any]] = cat["by_id"]

    rid = (rule_id or "").strip()
    if rid:
        if rid in by_id:
            return rid
        if rid in exact:
            return exact[rid]
        mapped = aliases.get(_norm_key(rid))
        if mapped:
            return mapped

    if allow_hint_alias:
        hint = (rule_hint or "").strip()
        if hint:
            if hint in exact:
                return exact[hint]
            mapped = aliases.get(_norm_key(hint))
            if mapped:
                return mapped

    return unc


def _norm_key(value: str) -> str:
    text = (value or "").strip().lower()
    text = text.replace("—", "-").replace("–", "-")
    text = re.sub(r"[^\w\u4e00-\u9fff]+", "_", text, flags=re.UNICODE)
    text = re.sub(r"_+", "_", text).strip("_")
    return text


def rule_summary(rule_id: str) -> str:
    rule = load_catalog()["by_id"].get((rule_id or "").strip())
    if not rule:
        return ""
    return str(rule.get("summary") or "").strip()

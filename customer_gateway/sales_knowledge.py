"""Load AsiaPower sales knowledge for draft generation."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

KNOWLEDGE_PATH = Path(__file__).resolve().parent.parent / "memory" / "knowledge" / "asiapower_sales_knowledge.json"


@lru_cache(maxsize=1)
def load_sales_knowledge() -> dict[str, Any]:
    if not KNOWLEDGE_PATH.is_file():
        return {}
    return json.loads(KNOWLEDGE_PATH.read_text(encoding="utf-8"))


def engine_knowledge(code: str) -> dict[str, Any] | None:
    knowledge = load_sales_knowledge()
    engines = knowledge.get("engine_knowledge", {})
    key = (code or "").upper().replace("-", "").replace(" ", "")
    for k, v in engines.items():
        if key == k.upper().replace("-", "") or key.startswith(k.upper()):
            return v
    return None


def enquiry_fields_prompt(lang: str = "en") -> str:
    knowledge = load_sales_knowledge()
    fields = knowledge.get("enquiry_fields_required", [])
    if lang.startswith("zh"):
        return "、".join(fields)
    return ", ".join(fields)


def positioning_line(lang: str = "en") -> str:
    knowledge = load_sales_knowledge()
    pos = knowledge.get("positioning", {})
    return pos.get("summary_en" if not lang.startswith("zh") else "summary_zh", "")


def advantages_bullet(lang: str = "en") -> str:
    knowledge = load_sales_knowledge()
    items = knowledge.get("default_advantages", [])
    if lang.startswith("zh"):
        mapping = {
            "verified suppliers": "认证供应商",
            "real photos and videos": "实拍照片与视频",
            "compression test available": "可提供压缩测试",
            "export packing": "出口包装",
            "FOB/CIF support": "支持 FOB/CIF",
        }
        return "、".join(mapping.get(i, i) for i in items)
    return ", ".join(items)


def build_engine_context(keywords: list[str], *, lang: str = "en") -> str:
    parts: list[str] = []
    for kw in keywords:
        info = engine_knowledge(kw)
        if not info:
            continue
        note = info.get("notes_en" if not lang.startswith("zh") else "notes_zh") or info.get("notes_en", "")
        brand = info.get("brand", "")
        variants = info.get("variants", [])
        line = f"{kw.upper()}"
        if brand:
            line += f" ({brand})"
        if note:
            line += f": {note}"
        if variants:
            line += f" Options: {', '.join(variants)}."
        parts.append(line)
    return " ".join(parts)

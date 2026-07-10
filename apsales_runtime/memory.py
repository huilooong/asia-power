"""APSales persistent memory scopes — customer, conversation, supplier, learning."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from apsales_runtime.paths import MEMORY_SCOPES, ensure_runtime_dirs
from tools import memory_tool


@dataclass
class MemoryScope:
    name: str
    path: Path
    description: str

    def exists(self) -> bool:
        return self.path.is_dir()

    def list_files(self, pattern: str = "*", limit: int = 50) -> list[str]:
        if not self.path.is_dir():
            return []
        files = sorted(self.path.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
        return [str(p.relative_to(self.path)) for p in files[:limit]]

    def read_text(self, relative_path: str) -> str | None:
        target = (self.path / relative_path).resolve()
        if not str(target).startswith(str(self.path.resolve())):
            return None
        if not target.is_file():
            return None
        return target.read_text(encoding="utf-8")

    def write_text(self, relative_path: str, content: str) -> Path:
        target = (self.path / relative_path).resolve()
        if not str(target).startswith(str(self.path.resolve())):
            raise ValueError("Path escapes memory scope")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return target


class MemoryStore:
    """Unified access to APSales memory scopes."""

    SCOPES = {
        "customer": MemoryScope(
            "customer",
            MEMORY_SCOPES["customer"],
            "CRM customer profiles (memory/customers/)",
        ),
        "conversation": MemoryScope(
            "conversation",
            MEMORY_SCOPES["conversation"],
            "Inbound messages and gateway state (memory/customer_gateway/)",
        ),
        "supplier": MemoryScope(
            "supplier",
            MEMORY_SCOPES["supplier"],
            "Supplier notes and match history (memory/suppliers/)",
        ),
        "learning": MemoryScope(
            "learning",
            MEMORY_SCOPES["learning"],
            "Sales intelligence learning artifacts (memory/learning/)",
        ),
    }

    def __init__(self) -> None:
        ensure_runtime_dirs()
        memory_tool._ensure_memory_dir()

    def scope(self, name: str) -> MemoryScope:
        if name not in self.SCOPES:
            raise KeyError(f"Unknown memory scope: {name}")
        return self.SCOPES[name]

    def health(self) -> dict[str, Any]:
        memory_tool._ensure_memory_dir()
        index_ok = memory_tool.INDEX_FILE.is_file()
        scopes = {
            name: {
                "path": str(s.path),
                "exists": s.exists(),
                "file_count": len(list(s.path.glob("*"))) if s.exists() else 0,
            }
            for name, s in self.SCOPES.items()
        }
        return {"memory_index": index_ok, "scopes": scopes}

    def snapshot(self) -> dict[str, Any]:
        return {
            "index": str(memory_tool.INDEX_FILE),
            "scopes": {name: str(s.path) for name, s in self.SCOPES.items()},
        }

"""Inventory search tool — read-only catalog search over local JSON."""

from __future__ import annotations

import json
import re
from pathlib import Path

from tools.tool_base import BaseTool, Permission, ToolResult

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
INVENTORY_FILES = (
    DATA / "half-cut-approved.json",
    DATA / "powertrain-catalog-memory.json",
    DATA / "knowledge-base" / "vin-cache.json",
    DATA / "knowledge-base" / "model-dictionary.json",
)


class InventoryTool(BaseTool):
    name = "inventory"
    description = "Search local inventory / catalog JSON (read-only)"
    permission = Permission.READ_ONLY
    requires_approval = False
    default_dry_run = True
    actions = ("search", "preview_update")

    def run(self, action: str, args: list[str], *, dry_run: bool = False) -> ToolResult:
        act = (action or "search").strip().lower()
        if act == "preview_update":
            return self._preview_update(args, dry_run=dry_run)
        return self._search(args)

    def _search(self, args: list[str]) -> ToolResult:
        query = " ".join(args).strip()
        if not query:
            return ToolResult(
                ok=False,
                output="Usage: /tool inventory search <keyword>\nExample: /tool inventory search G4KJ",
                tool_name=self.name,
                action="search",
            )
        needle = query.lower()
        hits: list[str] = []

        for path in INVENTORY_FILES:
            if not path.is_file():
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except OSError:
                continue
            if needle in text.lower():
                rel = path.relative_to(ROOT)
                count = len(re.findall(re.escape(needle), text, re.I))
                hits.append(f"- {rel}: ~{count} match(es)")
                for i, line in enumerate(text.splitlines(), 1):
                    if needle in line.lower() and len(hits) < 12:
                        hits.append(f"  L{i}: {line.strip()[:120]}")

        if not hits:
            return ToolResult(
                ok=True,
                output=f"No inventory matches for «{query}» in local catalog files.",
                tool_name=self.name,
                action="search",
            )
        return ToolResult(
            ok=True,
            output=f"Inventory search «{query}»:\n" + "\n".join(hits[:15]),
            tool_name=self.name,
            action="search",
        )

    def _preview_update(self, args: list[str], *, dry_run: bool) -> ToolResult:
        listing = " ".join(args).strip() or "(unspecified)"
        return ToolResult(
            ok=True,
            output=(
                f"[DRY RUN] inventory preview_update\n"
                f"Would validate and stage update for: {listing}\n"
                "No files written. CEO approval required for live update."
            ),
            dry_run=True,
            risk_level="medium",
            tool_name=self.name,
            action="preview_update",
        )


TOOL = InventoryTool()

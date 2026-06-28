"""VIN lookup tool — local cache first, no direct API calls from agent layer."""

from __future__ import annotations

import json
import re
from pathlib import Path

from tools.tool_base import BaseTool, Permission, ToolResult

ROOT = Path(__file__).resolve().parent.parent
VIN_CACHE = ROOT / "data" / "knowledge-base" / "vin-cache.json"
VIN_RE = re.compile(r"^[A-HJ-NPR-Z0-9]{11,17}$", re.I)


class VinTool(BaseTool):
    name = "vin"
    description = "VIN decode lookup (local cache; API via separate approval)"
    permission = Permission.READ_ONLY
    requires_approval = False
    default_dry_run = False
    actions = ("lookup",)

    def run(self, action: str, args: list[str], *, dry_run: bool = False) -> ToolResult:
        vin = (args[0] if args else action if action and action != "lookup" else "").strip().upper()
        if not vin or vin == "LOOKUP":
            return ToolResult(
                ok=False,
                output="Usage: /tool vin <VIN>\nExample: /tool vin LFMAY86C3K0406545",
                tool_name=self.name,
                action="lookup",
            )
        if not VIN_RE.match(vin):
            return ToolResult(
                ok=False,
                output=f"Invalid VIN format: {vin}",
                tool_name=self.name,
                action="lookup",
            )

        cached = self._cache_lookup(vin)
        if cached:
            summary = self._summarize(cached)
            return ToolResult(
                ok=True,
                output=f"VIN {vin} — cache hit\n{summary}",
                tool_name=self.name,
                action="lookup",
                metadata={"vin": vin, "source": "cache"},
            )

        api_configured = bool(
            __import__("os").getenv("QXB_APPID") and __import__("os").getenv("QXB_SECRET")
        )
        if api_configured:
            return ToolResult(
                ok=False,
                output=(
                    f"VIN {vin} not in local cache.\n"
                    "QXB API credentials are set but live decode is not wired in Tool Engine yet.\n"
                    "Use: node scripts/vin-connectivity-test.js (CEO/manual only)."
                ),
                tool_name=self.name,
                action="lookup",
                metadata={"vin": vin, "api_configured": True},
            )

        return ToolResult(
            ok=False,
            output=(
                f"VIN {vin} not in local cache.\n"
                "QXB API not configured (QXB_APPID / QXB_SECRET missing).\n"
                "Status: not configured for automated lookup."
            ),
            tool_name=self.name,
            action="lookup",
            metadata={"vin": vin, "api_configured": False},
        )

    def _cache_lookup(self, vin: str) -> dict | None:
        if not VIN_CACHE.is_file():
            return None
        try:
            data = json.loads(VIN_CACHE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None
        return data.get(vin) or data.get(vin.upper())

    def _summarize(self, entry: dict) -> str:
        result = (entry.get("rawResponse") or {}).get("result") or {}
        models = result.get("models") or []
        if not models:
            return json.dumps(entry, ensure_ascii=False, indent=2)[:800]
        m = models[0]
        lines = [
            f"Brand: {m.get('brand', '?')}",
            f"Series: {m.get('series', '?')}",
            f"Model: {m.get('model_name', '?')}",
            f"Year: {m.get('years', '?')}",
            f"Engine: {m.get('engine_code', '?')} / {m.get('engine', '?')}",
            f"Factory: {m.get('factory', '?')}",
        ]
        return "\n".join(lines)


TOOL = VinTool()

"""Runtime bootstrap — load constitution, identity, memory, tools."""

from __future__ import annotations

from pathlib import Path

from coo_core.constitution_loader import build_constitution_context, load_constitution_version
from core.language_router import init_language_policy
from tools import memory_tool
from tools.registry import bootstrap_registry, list_tools

ROOT = Path(__file__).resolve().parent.parent
IDENTITY_FILE = ROOT / "IDENTITY.md"


def load_identity() -> str:
    if not IDENTITY_FILE.is_file():
        raise FileNotFoundError(f"Identity file missing: {IDENTITY_FILE}")
    return IDENTITY_FILE.read_text(encoding="utf-8").strip()


def bootstrap_runtime(agent_id: str = "apcoo") -> dict:
    """Load all runtime layers. Returns summary dict."""
    language_router = init_language_policy()
    version = load_constitution_version()
    constitution = build_constitution_context(agent_id)
    identity = load_identity()
    memory_tool._ensure_memory_dir()
    memory_index = memory_tool.INDEX_FILE.is_file()
    bootstrap_registry()
    tools = list_tools()

    return {
        "constitution_version": version,
        "constitution_chars": len(constitution),
        "identity_chars": len(identity),
        "memory_index": memory_index,
        "tools_registered": tools.count("\n- "),
        "language_policy": {
            "internal": language_router.default_for("internal"),
            "buyer": language_router.default_for("buyer"),
            "supplier": language_router.default_for("supplier"),
        },
    }

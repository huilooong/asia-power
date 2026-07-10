"""APSales runtime bootstrap — constitution, memory, tools (no business logic)."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def bootstrap_apsales_runtime(agent_id: str = "apsales") -> dict:
    """Load runtime layers required for 24/7 APSales operation."""
    from coo_core.constitution_loader import build_constitution_context, load_constitution_version
    from core.language_router import init_language_policy
    from tools import memory_tool
    from tools.registry import bootstrap_registry, list_tools

    language_router = init_language_policy()
    version = load_constitution_version()
    constitution = build_constitution_context(agent_id)
    memory_tool._ensure_memory_dir()
    bootstrap_registry()
    tools = list_tools()

    knowledge_summary = {}
    try:
        from knowledge.runtime import bootstrap_knowledge_runtime
        knowledge_summary = bootstrap_knowledge_runtime()
    except ImportError:
        knowledge_summary = {"status": "skipped", "reason": "knowledge.runtime not installed"}

    return {
        "agent_id": agent_id,
        "constitution_version": version,
        "constitution_chars": len(constitution),
        "memory_index": memory_tool.INDEX_FILE.is_file(),
        "tools_registered": tools.count("\n- "),
        "knowledge_runtime": knowledge_summary,
        "language_policy": {
            "internal": language_router.default_for("internal"),
            "buyer": language_router.default_for("buyer"),
            "supplier": language_router.default_for("supplier"),
        },
    }

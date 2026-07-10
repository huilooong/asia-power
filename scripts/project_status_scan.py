#!/usr/bin/env python3
"""Read-only repository status scanner for AsiaPower.

The scanner inspects files already present in the repository and writes a
factual markdown report. It does not import project modules, run business code,
call network services, or execute repository scripts.
"""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = ROOT / "docs" / "cto" / "project-status-scan.md"

SKIP_DIRS = {
    ".git",
    ".venv",
    ".venv-faces",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".cursor",
}

ARCHITECTURE_AREAS = {
    "APCOO": ("apcoo", "coo agent", "chief operating officer"),
    "APSales": ("apsales", "sales intelligence", "sales runtime"),
    "APCGO / APBD": ("apcgo", "apbd", "growth officer", "business development"),
    "APSEO": ("apseo", "seo-", "engine intelligence", "google traffic"),
    "APInventory": ("apinventory", "inventory agent", "子龙", "qxb"),
    "Knowledge Graph": ("knowledge graph", "knowledge schema", "engine.schema", "knowledge_id"),
    "Runtime": ("runtime", "scheduler", "heartbeat", "healthcheck"),
    "Memory": ("memory", "memorystore", "memory tool"),
    "Event Bus": ("event bus", "inquiryreceived", "opportunitycreated", "events.py"),
    "Release Manager": ("release manager", "ops-005", "deploy-production", "release-manager"),
    "Infrastructure": ("nginx", "systemd", "launchd", "deploy", "infrastructure"),
}

AGENT_ALIASES = {
    "apcoo": "APCOO",
    "coo": "APCOO",
    "apsales": "APSales",
    "sales": "APSales",
    "apinventory": "APInventory",
    "inventory": "APInventory",
    "apbd": "APBD",
    "apcgo": "APCGO",
    "apseo": "APSEO",
    "seo": "APSEO",
}


@dataclass
class AgentScan:
    name: str
    role_file: Path | None = None
    profile_file: Path | None = None
    runtime_entries: list[Path] | None = None
    services: list[Path] | None = None
    tests: list[Path] | None = None
    status: str = "missing"

    def __post_init__(self) -> None:
        self.runtime_entries = self.runtime_entries or []
        self.services = self.services or []
        self.tests = self.tests or []


def rel(path: Path | None) -> str:
    if path is None:
        return "unknown from repo scan"
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def iter_files(*roots: str) -> list[Path]:
    files: list[Path] = []
    for root_name in roots:
        root = ROOT / root_name
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.is_dir():
                continue
            if any(part in SKIP_DIRS for part in path.parts):
                continue
            files.append(path)
    return sorted(files)


def read_text(path: Path, limit: int = 300_000) -> str:
    try:
        data = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""
    if len(data) > limit:
        return data[:limit]
    return data


def file_exists(path: str) -> bool:
    return (ROOT / path).exists()


def canonical_agent_name(raw: str) -> str:
    key = raw.lower().replace("_", "-")
    key = key.removeprefix("test-")
    key = key.split(".")[0]
    return AGENT_ALIASES.get(key, raw.upper())


def collect_agents() -> list[AgentScan]:
    names: set[str] = set()

    for path in (ROOT / "constitution" / "roles").glob("*.md"):
        names.add(canonical_agent_name(path.stem))

    for path in (ROOT / "profiles").glob("*.yaml"):
        names.add(canonical_agent_name(path.stem))

    agents_dir = ROOT / "agents"
    if agents_dir.exists():
        for path in agents_dir.iterdir():
            if path.is_dir() and not path.name.startswith("__"):
                names.add(canonical_agent_name(path.name))

    if (ROOT / "docs" / "product" / "apcgo").exists():
        names.add("APCGO")
    if (ROOT / "docs" / "product" / "seo").exists():
        names.add("APSEO")

    preferred = ["APCOO", "APSales", "APInventory", "APCGO", "APBD", "APSEO"]
    ordered = preferred + sorted(n for n in names if n not in preferred)

    tests = iter_files("tests")
    all_files = iter_files(
        "agents", "coo_core", "apsales_runtime", "runtime", "integrations",
        "scripts", "deploy", "ops", "constitution", "profiles",
    )

    scans: list[AgentScan] = []
    for name in ordered:
        low = name.lower()
        role_candidates = [
            ROOT / "constitution" / "roles" / f"{low}.md",
            ROOT / "constitution" / "roles" / f"{low.replace('ap', '', 1)}.md",
        ]
        profile_candidates = [
            ROOT / "profiles" / f"{low}.yaml",
            ROOT / "profiles" / f"{low.replace('ap', '', 1)}.yaml",
        ]
        role_file = next((p for p in role_candidates if p.exists()), None)
        profile_file = next((p for p in profile_candidates if p.exists()), None)

        aliases = {low, low.replace("ap", "", 1)}
        if name == "APCGO":
            aliases.update({"apcgo", "growth"})
        if name == "APSEO":
            aliases.update({"apseo", "seo"})
        if name == "APCOO":
            aliases.update({"coo", "apcoo"})

        runtime_entries = [
            p for p in all_files
            if any(a in str(p.relative_to(ROOT)).lower() for a in aliases)
            and p.suffix in {".py", ".js", ".mjs", ".yaml", ".service", ".plist", ".sh"}
        ]
        services = [
            p for p in runtime_entries
            if p.suffix in {".service", ".plist"} or "telegram" in p.name.lower()
        ]
        matched_tests = [
            p for p in tests
            if any(a in p.name.lower() for a in aliases)
        ]

        status = "missing"
        if role_file and profile_file and (runtime_entries or services):
            status = "active"
        elif (role_file or profile_file) and (runtime_entries or matched_tests):
            status = "partial"
        elif role_file or profile_file or runtime_entries or matched_tests:
            status = "legacy"

        if name == "APCGO" and (ROOT / "docs" / "product" / "apcgo").exists():
            status = "partial"
        if name == "APSEO" and (ROOT / "docs" / "product" / "seo").exists():
            status = "partial"

        scans.append(AgentScan(
            name=name,
            role_file=role_file,
            profile_file=profile_file,
            runtime_entries=runtime_entries[:10],
            services=services[:8],
            tests=matched_tests[:12],
            status=status,
        ))

    return scans


def doc_title(path: Path) -> str:
    text = read_text(path, limit=20_000)
    for line in text.splitlines():
        if line.startswith("#"):
            return line.lstrip("#").strip()
    return path.name


def collect_architecture_docs() -> dict[str, list[Path]]:
    docs = iter_files(
        "docs/architecture",
        "docs/cto",
        "docs/product",
        "docs/agents",
        "docs/ops",
        "knowledge",
    )
    wanted_ext = {".md", ".json", ".yaml", ".yml", ".txt"}
    result: dict[str, list[Path]] = {}
    for area, needles in ARCHITECTURE_AREAS.items():
        matches: list[Path] = []
        for path in docs:
            if path == REPORT_PATH:
                continue
            if path.suffix.lower() not in wanted_ext:
                continue
            if any(part.startswith(".") for part in path.relative_to(ROOT).parts):
                continue
            hay = f"{path.name.lower()} {read_text(path, limit=80_000).lower()}"
            if any(n in hay for n in needles):
                matches.append(path)
        result[area] = matches[:20]
    return result


def component_status() -> list[tuple[str, str, list[str]]]:
    checks = [
        ("Event Bus", ["apsales_runtime/events.py"], ["docs/cto/apsales-runtime-v1.md"]),
        ("Scheduler", ["apsales_runtime/scheduler.py", "runtime/heartbeat.py"], ["docs/cto/apsales-runtime-v1.md", "README-AI-OS.md"]),
        ("Task Queue", ["apsales_runtime/task_queue.py", "tools/task_tool.py"], ["README-AI-OS.md"]),
        ("MemoryStore", ["apsales_runtime/memory.py", "tools/memory_tool.py"], ["README-AI-OS.md", "docs/cto/apsales-runtime-v1.md"]),
        ("approval system", ["coo_core/approval_gate.py", "agents/approval_router.py"], ["README-AI-OS.md"]),
        ("dispatcher", ["coo_core/dispatcher.py", "coo_core/cli_router.py", "agents/router.py"], ["README-AI-OS.md"]),
        ("CLI", ["main.py", "coo_core/cli_router.py"], ["README-AI-OS.md"]),
        ("Telegram bots", ["integrations/telegram_coo_bot.py", "integrations/telegram_apsales_bot.py"], ["README-AI-OS.md"]),
        ("healthcheck", ["runtime/healthcheck.py", "coo_core/health_check.py", "apsales_runtime/healthcheck.py"], ["README-AI-OS.md"]),
        ("heartbeat", ["runtime/heartbeat.py", "apsales_runtime/worker.py"], ["README-AI-OS.md", "docs/cto/apsales-runtime-v1.md"]),
    ]
    rows: list[tuple[str, str, list[str]]] = []
    for name, paths, docs in checks:
        present = [p for p in paths if file_exists(p)]
        status = "present" if present else "missing"
        rows.append((name, status, present + [d for d in docs if file_exists(d)]))
    return rows


def count_tree(path: Path) -> tuple[int, int, list[str]]:
    if not path.exists():
        return 0, 0, []
    dirs = 0
    files = 0
    top: list[str] = []
    for child in sorted(path.iterdir(), key=lambda p: p.name.lower()):
        if child.name in SKIP_DIRS:
            continue
        top.append(child.name + ("/" if child.is_dir() else ""))
    for item in path.rglob("*"):
        if any(part in SKIP_DIRS for part in item.parts):
            continue
        if item.is_dir():
            dirs += 1
        elif item.is_file():
            files += 1
    return dirs, files, top[:20]


def summarize_test(path: Path) -> str:
    name = path.name.lower()
    mapping = [
        ("apcoo", "APCOO bot/runtime/ops behavior"),
        ("apsales_runtime", "APSales runtime foundation"),
        ("apsales_101", "APSales Opportunity integration"),
        ("apsales", "APSales role/platform/sales behavior"),
        ("apinventory", "APInventory agent behavior"),
        ("runtime", "shared runtime config, heartbeat, healthcheck, or supervision"),
        ("telegram", "Telegram integration"),
        ("wecom", "WeCom integration"),
        ("whatsapp", "WhatsApp/customer gateway"),
        ("email", "email routing/outbound/webhook/proxy behavior"),
        ("qxb", "QXB import/upload/photo workflow"),
        ("memory", "memory tool/rules"),
        ("approval", "approval routing/notification/draft approval"),
        ("language", "language policy/router"),
        ("knowledge", "knowledge ingest/runtime behavior"),
        ("risk", "risk/safety behavior"),
        ("deploy", "deployment/service file checks"),
        ("router", "agent routing"),
        ("critic", "COO critic rules"),
        ("planner", "COO planner"),
        ("reporter", "COO reporter"),
    ]
    for token, summary in mapping:
        if token in name:
            return summary
    return "unknown from repo scan"


def collect_tests() -> list[tuple[Path, str]]:
    tests = [p for p in iter_files("tests") if p.name.startswith("test_") and p.suffix in {".py", ".js"}]
    return [(p, summarize_test(p)) for p in tests]


def duplicate_concepts() -> list[tuple[str, str, str]]:
    concepts: list[tuple[str, str, str]] = []

    def exists_any(paths: list[str]) -> bool:
        return any(file_exists(p) for p in paths)

    checks = [
        (
            "Opportunity vs GrowthOpportunity",
            ["docs/cto/apsales/opportunity-model-v1.md", "domain/opportunity/service.py"],
            ["docs/product/apcgo/apcgo-growth-database.md", "docs/product/apcgo/apcgo-opportunity-model.md"],
            "APSales commercial Opportunity and APCGO pre-sales Growth Opportunity both exist as documented models.",
        ),
        (
            "APCGO vs APBD",
            ["docs/product/apcgo/apcgo-overview.md", "docs/agents/apcgo/overview.md"],
            ["agents/apbd/runtime.py", "docs/agents/apbd/overview.md", "constitution/roles/apbd.md"],
            "APCGO product architecture and APBD code/docs both exist.",
        ),
        (
            "APSales Runtime vs APCOO Runtime",
            ["apsales_runtime/service.py", "docs/cto/apsales-runtime-v1.md"],
            ["runtime/service.py", "README-AI-OS.md"],
            "APSales has its own runtime package while APCOO has shared runtime/service.",
        ),
        (
            "Knowledge Graph vs Growth Database",
            ["knowledge/schema/engine.schema.json", "docs/knowledge-schema.md"],
            ["docs/product/apcgo/apcgo-growth-database.md"],
            "Engine knowledge schema and APCGO growth database design both define persistent intelligence objects.",
        ),
        (
            "MemoryStore vs markdown memory",
            ["apsales_runtime/memory.py"],
            ["tools/memory_tool.py", "memory/"],
            "APSales Runtime MemoryStore and markdown/file-based Memory Tool both exist.",
        ),
        (
            "APCOO approval gate vs APSales approval routing",
            ["coo_core/approval_gate.py"],
            ["agents/approval_router.py", "customer_gateway/approval_notification.py"],
            "COO approval gate, generic approval router, and customer-gateway approval notification coexist.",
        ),
        (
            "Node analytics vs Python analytics reports",
            ["server/lib/site-analytics.js"],
            ["scripts/analytics-weekly-report.py", "analytics/metrics/traffic_source.py"],
            "Node site analytics and Python analytics/reporting modules coexist.",
        ),
    ]
    for name, left, right, evidence in checks:
        if exists_any(left) and exists_any(right):
            concepts.append((name, evidence, "present"))
    return concepts


def missing_areas() -> list[str]:
    gaps: list[str] = []
    if not file_exists("docs/product/apcoo/apcoo-architecture-audit.md"):
        gaps.append("APCOO product audit doc is absent.")
    if not file_exists("docs/product/apcgo/apcgo-architecture-audit.md"):
        gaps.append("APCGO architecture audit doc is absent.")
    if not file_exists("docs/product/seo/apseo-011-kpi.md"):
        gaps.append("APSEO KPI framework is absent.")
    if not file_exists("docs/product/apcgo/apcgo-growth-database.md"):
        gaps.append("APCGO Growth Opportunity Database design is absent.")
    if not file_exists("knowledge/schema/engine.schema.json"):
        gaps.append("Engine knowledge schema file is absent.")
    if not file_exists("domain/opportunity/service.py"):
        gaps.append("APSales Opportunity domain service is absent.")
    if not file_exists("apsales_runtime/events.py"):
        gaps.append("APSales runtime Event Bus module is absent.")
    if not file_exists("runtime/service.py"):
        gaps.append("APCOO runtime service is absent.")
    if not file_exists("scripts/project_status_scan.py"):
        gaps.append("Repository status scanner script is absent.")
    if not file_exists("docs/product/apcoo/apcoo-architecture-audit.md"):
        gaps.append("No APCOO product architecture folder was proven before scanner output.")

    # Positive gap evidence from files: if both product docs and no runtime/code.
    if file_exists("docs/product/apcgo/apcgo-overview.md") and not file_exists("agents/apcgo/runtime.py"):
        gaps.append("APCGO has product docs but no `agents/apcgo/runtime.py` found.")
    if file_exists("docs/product/seo/apseo-011-roadmap.md") and not file_exists("agents/apseo/runtime.py"):
        gaps.append("APSEO has product docs but no `agents/apseo/runtime.py` found.")
    if file_exists("docs/product/apcgo/apcgo-growth-database.md") and not file_exists("data/apcgo"):
        gaps.append("APCGO growth database is documented, but no `data/apcgo/` store was found.")
    if file_exists("runtime/service.py") and file_exists("apsales_runtime/service.py"):
        gaps.append("Two runtime foundations exist; repo scan does not prove a single unified runtime owner.")
    if file_exists("tools/memory_tool.py") and file_exists("apsales_runtime/memory.py"):
        gaps.append("Two memory access patterns exist; repo scan does not prove one unified memory source of truth.")
    return gaps or ["No missing area proven by configured checks."]


def recommended_actions(gaps: list[str], duplicates: list[tuple[str, str, str]]) -> list[str]:
    actions: list[str] = []
    if duplicates:
        actions.append("Create a CTO-reviewed ownership map for overlapping concepts before adding new architecture.")
    if any("APCGO has product docs but no" in g for g in gaps):
        actions.append("Before implementing APCGO runtime, define how it reuses or separates from APBD runtime files.")
    if any("APSEO has product docs but no" in g for g in gaps):
        actions.append("Keep APSEO as product/operating documents until a CTO-approved runtime owner is defined.")
    if any("growth database is documented" in g for g in gaps):
        actions.append("Choose a storage owner for APCGO GrowthOpportunity before daily automation.")
    if any("Two runtime foundations" in g for g in gaps):
        actions.append("Document runtime ownership boundaries between `runtime/` and `apsales_runtime/`.")
    if any("Two memory access patterns" in g for g in gaps):
        actions.append("Document when to use `tools/memory_tool.py` vs `apsales_runtime/memory.py`.")
    if file_exists("docs/cto/ops-005-release-manager.md"):
        actions.append("Use existing Release Manager discipline for any future production-impacting changes.")
    if not actions:
        actions.append("No next action beyond periodic scanner reruns was proven by repository evidence.")
    return actions


def markdown_table(headers: list[str], rows: list[list[str]]) -> list[str]:
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join("---" for _ in headers) + " |",
    ]
    for row in rows:
        escaped = [cell.replace("\n", "<br>") for cell in row]
        lines.append("| " + " | ".join(escaped) + " |")
    return lines


def render_report() -> str:
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    agents = collect_agents()
    arch_docs = collect_architecture_docs()
    components = component_status()
    tests = collect_tests()
    duplicates = duplicate_concepts()
    gaps = missing_areas()
    actions = recommended_actions(gaps, duplicates)

    lines: list[str] = [
        "# AsiaPower Project Status Scan",
        "",
        f"Generated: `{generated}`",
        "",
        "Source: repository filesystem scan only. No business scripts, network calls, runtime services, Telegram bots, Facebook scripts, or deployment commands were executed.",
        "",
        "## 1. Existing Agents",
        "",
    ]

    agent_rows: list[list[str]] = []
    for a in agents:
        agent_rows.append([
            a.name,
            rel(a.role_file),
            rel(a.profile_file),
            "<br>".join(rel(p) for p in a.runtime_entries) or "unknown from repo scan",
            "<br>".join(rel(p) for p in a.services) or "unknown from repo scan",
            "<br>".join(rel(p) for p in a.tests) or "unknown from repo scan",
            a.status,
        ])
    lines.extend(markdown_table(
        ["Agent", "Role / constitution file", "Profile file", "Runtime entry", "Telegram/systemd/launchd service", "Tests", "Current status"],
        agent_rows,
    ))

    lines.extend(["", "## 2. Existing Architecture Documents", ""])
    for area in ARCHITECTURE_AREAS:
        lines.append(f"### {area}")
        docs = arch_docs.get(area) or []
        if not docs:
            lines.append("- unknown from repo scan")
        else:
            for p in docs:
                lines.append(f"- `{rel(p)}` — {doc_title(p)}")
        lines.append("")

    lines.extend(["## 3. Existing Runtime Components", ""])
    component_rows = [
        [name, status, "<br>".join(f"`{p}`" for p in paths) or "unknown from repo scan"]
        for name, status, paths in components
    ]
    lines.extend(markdown_table(["Component", "Status", "Evidence"], component_rows))

    lines.extend(["", "## 4. Existing Data Stores", ""])
    store_rows: list[list[str]] = []
    for store in ["data", "memory", "knowledge", "reports", "audit", "docs"]:
        path = ROOT / store
        dirs, files, top = count_tree(path)
        status = "present" if path.exists() else "missing"
        store_rows.append([
            f"`{store}/`",
            status,
            str(dirs),
            str(files),
            "<br>".join(f"`{x}`" for x in top) or "unknown from repo scan",
        ])
    lines.extend(markdown_table(["Store", "Status", "Directories", "Files", "Top-level entries"], store_rows))

    lines.extend(["", "## 5. Existing Tests", ""])
    grouped: dict[str, list[Path]] = defaultdict(list)
    for path, summary in tests:
        grouped[summary].append(path)
    for summary in sorted(grouped):
        lines.append(f"### {summary}")
        for p in grouped[summary]:
            lines.append(f"- `{rel(p)}`")
        lines.append("")

    lines.extend(["## 6. Duplicate Or Overlapping Concepts", ""])
    if duplicates:
        lines.extend(markdown_table(
            ["Concept", "Evidence", "Status"],
            [[name, evidence, status] for name, evidence, status in duplicates],
        ))
    else:
        lines.append("- No duplicate concept from configured checks was proven by files.")

    lines.extend(["", "## 7. Missing Or Incomplete Areas", ""])
    for gap in gaps:
        lines.append(f"- {gap}")

    lines.extend(["", "## 8. Recommended Next Actions", ""])
    for action in actions:
        lines.append(f"- {action}")

    lines.extend([
        "",
        "## Scanner Notes",
        "",
        "- Status labels are file-evidence heuristics: `active`, `partial`, `legacy`, or `missing`.",
        "- `unknown from repo scan` means no matching file was found by this script.",
        "- The scanner intentionally ignores `node_modules`, virtualenvs, git internals, and bytecode caches.",
    ])
    return "\n".join(lines) + "\n"


def main() -> int:
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(render_report(), encoding="utf-8")
    print(f"Wrote {rel(REPORT_PATH)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Summarize global public demand channels for APSales.

This is a safe, read-only planner. It does not log in, scrape pages, post,
comment, DM, email or WhatsApp. It reads the approved source registry and
writes a practical channel priority report.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
SOURCE_FILE = ROOT / "config" / "apsales_global_demand_sources.json"
REPORT_FILE = ROOT / "docs" / "agent-reports" / "apsales-global-demand-sources.md"

PRIORITY_WEIGHT = {"S": 4, "A": 3, "B": 2, "C": 1}
RISK_WEIGHT = {"Low": 1, "Medium": 2, "High": 3, "Critical": 4}


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def load_sources(path: Path = SOURCE_FILE) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def source_score(row: dict[str, Any]) -> int:
    priority = PRIORITY_WEIGHT.get(str(row.get("priority") or "C"), 1)
    risk = RISK_WEIGHT.get(str(row.get("risk") or "Medium"), 2)
    # High-value channels can still be S, but the report should surface that
    # they need stricter approval and lower automation.
    return priority * 25 - max(0, risk - 2) * 5


def sorted_sources(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        rows,
        key=lambda r: (
            source_score(r),
            PRIORITY_WEIGHT.get(str(r.get("priority") or "C"), 1),
            str(r.get("platform") or ""),
        ),
        reverse=True,
    )


def write_report(registry: dict[str, Any], *, limit: int) -> None:
    sources = list(registry.get("sources") or [])
    ranked = sorted_sources(sources)
    platform_counts = Counter(str(s.get("platform") or "unknown") for s in sources)
    type_counts = Counter(str(s.get("type") or "unknown") for s in sources)
    region_counts = Counter(str(s.get("region") or "unknown") for s in sources)

    by_priority: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in ranked:
        by_priority[str(row.get("priority") or "C")].append(row)

    lines = [
        "# APSales Global Demand Sources",
        "",
        f"Generated: {_now()}",
        "",
        "## Purpose",
        "",
        "This report expands AsiaPower demand discovery beyond Facebook. The goal is to find public buyer demand for engines, gearboxes and half-cuts across regional social platforms, forums, classifieds and video comments, then route qualified demand into APSales approval drafts.",
        "",
        "## Safety Boundary",
        "",
    ]
    for rule in registry.get("rules") or []:
        lines.append(f"- {rule}")

    lines.extend([
        "",
        "## Channel Mix",
        "",
        f"- Total approved source seeds: {len(sources)}",
        f"- Platforms: {len(platform_counts)}",
        f"- Regions: {len(region_counts)}",
        "",
        "### By Region",
        "",
    ])
    for key, count in sorted(region_counts.items()):
        lines.append(f"- {key}: {count}")

    lines.extend(["", "### By Source Type", ""])
    for key, count in sorted(type_counts.items()):
        lines.append(f"- {key}: {count}")

    lines.extend(["", "## Highest Priority Channels", ""])
    lines.append("| Rank | Priority | Risk | Region | Countries | Platform | Type | Why it matters | Allowed action |")
    lines.append("| ---: | --- | --- | --- | --- | --- | --- | --- | --- |")
    for idx, row in enumerate(ranked[:limit], 1):
        countries = ", ".join(row.get("countries") or [])
        lines.append(
            f"| {idx} | {row.get('priority')} | {row.get('risk')} | {row.get('region')} | "
            f"{countries} | {row.get('platform')} | {row.get('type')} | "
            f"{str(row.get('buyer_signal') or '').replace('|', '/')} | {row.get('allowed_action')} |"
        )

    lines.extend(["", "## Target Queries", ""])
    for row in ranked[:limit]:
        lines.append(f"### {row.get('platform')} — {row.get('id')}")
        for query in row.get("target_queries") or []:
            lines.append(f"- {query}")
        lines.append("")

    lines.extend([
        "## Operational Rule",
        "",
        "All channels feed the same downstream workflow:",
        "",
        "Public channel signal -> local intel JSONL -> buyer intent scoring -> APSales reply draft -> human approval -> manual or approved reply -> AsiaPower landing page / WhatsApp / inquiry form.",
        "",
        "Do not create a separate sales process per platform. The channel changes; the APSales approval workflow stays the same.",
    ])

    REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
    REPORT_FILE.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Build APSales global demand source report")
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--json", action="store_true")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    registry = load_sources()
    sources = list(registry.get("sources") or [])
    write_report(registry, limit=args.limit)
    result = {
        "ok": True,
        "sources": len(sources),
        "report": str(REPORT_FILE),
        "registry": str(SOURCE_FILE),
    }
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"Sources: {len(sources)}")
        print(f"Report: {REPORT_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

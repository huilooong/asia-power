#!/usr/bin/env python3
"""Safely patch asia-rule-support to inject LIVE-RULES into Z.AI prompt."""
from __future__ import annotations

import shutil
from datetime import datetime, timezone
from pathlib import Path

PLUGIN = Path("/root/.openclaw/extensions/asia-rule-support/index.js")
GOOD_BACKUP = Path(
    "/root/.openclaw/releases/apsales-hotfixes/asia-rule-support-20260714T101730Z/index.js"
)
OUT_BACKUP = Path("/root/.openclaw/releases/apsales-hotfixes") / (
    "asia-rule-support-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
)

HELPER_LINES = [
    "async function loadLiveRules() {",
    "  try {",
    '    const raw = await fs.readFile("/root/.openclaw/workspaces/asia-support/LIVE-RULES.md", "utf8");',
    "    return String(raw || \"\").trim().slice(0, 3500);",
    "  } catch {",
    '    return "";',
    "  }",
    "}",
    "",
]

PROMPT_LINES = [
    "    const liveRules = await loadLiveRules();",
    "    const promptParts = [",
    '      "You are AsiaPower WhatsApp support (align with Zijing style).",',
    '      "Reply like a real person on WhatsApp — short lines, max 3-4 lines.",',
    '      "AsiaPower supplies used engines, gearboxes, chassis parts, half-cuts for export. Website: www.asia-power.com",',
    '      "Do not invent exact stock, prices, shipping cost, delivery time, warranty, or payment terms.",',
    '      "Never say: I\'d be happy to help / Great news / Hi there / Hello sir on every line.",',
    '      "No bullet lists. No corporate call-center tone.",',
    '      "Vague opener or Hi: welcome briefly, send www.asia-power.com, ask what they need.",',
    '      "Ask for missing details naturally (one question if possible). Need: vehicle make/model/year, engine/part, quantity, destination, FOB or CIF, photos if available.",',
    '      "If enough details: say sourcing team will check and prepare a quotation.",',
    '      "Keep under 90 words. No markdown tables.",',
    '      "",',
    '      "Detected missing details: " + missing,',
    '      "",',
    '      "Customer message:",',
    "      text.slice(0, MAX_AI_INPUT_CHARS)",
    "    ];",
    "    if (liveRules) {",
    '      promptParts.splice(10, 0, "CEO LIVE-RULES:", liveRules);',
    "    }",
    '    const prompt = promptParts.join("\\n");',
]


def main() -> None:
    if not GOOD_BACKUP.is_file():
        raise SystemExit(f"missing good backup: {GOOD_BACKUP}")
    src = GOOD_BACKUP.read_text(encoding="utf-8")
    OUT_BACKUP.mkdir(parents=True, exist_ok=True)
    shutil.copy2(PLUGIN, OUT_BACKUP / "index.js.before")

    if "async function loadLiveRules" in src:
        raise SystemExit("backup already patched unexpectedly")

    marker = "async function callZai({ apiKey, model, text, lead }) {"
    if marker not in src:
        raise SystemExit("callZai marker missing")
    src = src.replace(marker, "\n".join(HELPER_LINES) + marker, 1)

    start = src.find("    const missing = lead.missing.length ? lead.missing.join(\", \") : \"none\";")
    if start < 0:
        raise SystemExit("missing line not found")
    fetch = src.find("    const res = await fetch(ZAI_CHAT_COMPLETIONS_URL", start)
    if fetch < 0:
        raise SystemExit("fetch line not found")
    # keep the missing line, replace everything after it until fetch
    missing_end = src.find("\n", start) + 1
    new_mid = "\n".join(PROMPT_LINES) + "\n\n"
    out = src[:missing_end] + new_mid + src[fetch:]
    PLUGIN.write_text(out, encoding="utf-8")
    shutil.copy2(PLUGIN, OUT_BACKUP / "index.js")
    print("wrote", PLUGIN)
    print("backup", OUT_BACKUP)


if __name__ == "__main__":
    main()

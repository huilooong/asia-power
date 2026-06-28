"""Runtime healthcheck — verify APCOO dependencies."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from coo_core.constitution_loader import load_constitution, load_constitution_version
from runtime.bootstrap import ROOT
from tools import memory_tool
from tools.registry import bootstrap_registry, get_tool

IDENTITY_FILE = ROOT / "IDENTITY.md"


def _check(name: str, ok: bool, detail: str, *, required: bool = True) -> dict:
    return {
        "name": name,
        "ok": ok,
        "detail": detail,
        "required": required,
    }


def run_healthcheck() -> tuple[bool, list[dict]]:
    """Run all health checks. Returns (overall_ok, checks)."""
    checks: list[dict] = []

    # Constitution
    try:
        version = load_constitution_version()
        body = load_constitution()
        checks.append(_check(
            "constitution",
            bool(version and body),
            f"version={version}, {len(body)} chars",
        ))
    except Exception as exc:
        checks.append(_check("constitution", False, str(exc)))

    # Memory index
    try:
        memory_tool._ensure_memory_dir()
        idx_ok = memory_tool.INDEX_FILE.is_file()
        checks.append(_check(
            "memory_index",
            idx_ok,
            str(memory_tool.INDEX_FILE) if idx_ok else "index.json missing (created empty)",
        ))
    except Exception as exc:
        checks.append(_check("memory_index", False, str(exc)))

    # Tool registry
    try:
        bootstrap_registry()
        git_tool = get_tool("git")
        vin_tool = get_tool("vin")
        ok = git_tool is not None and vin_tool is not None
        checks.append(_check("tool_registry", ok, f"git={bool(git_tool)}, vin={bool(vin_tool)}"))
    except Exception as exc:
        checks.append(_check("tool_registry", False, str(exc)))

    # Telegram token (optional but reported)
    import os
    tg_token = bool((os.getenv("COO_TELEGRAM_BOT_TOKEN") or "").strip())
    tg_ids = bool((os.getenv("COO_TELEGRAM_ALLOWED_CHAT_IDS") or "").strip())
    checks.append(_check(
        "telegram_config",
        tg_token and tg_ids,
        f"token={'set' if tg_token else 'missing'}, whitelist={'set' if tg_ids else 'missing'}",
        required=False,
    ))

    # OpenAI key (optional for slash commands)
    oai = bool((os.getenv("OPENAI_API_KEY") or "").strip())
    checks.append(_check(
        "openai_key",
        oai,
        "set" if oai else "missing (chat mode disabled)",
        required=False,
    ))

    # Git repo
    try:
        proc = subprocess.run(
            ["git", "rev-parse", "--is-inside-work-tree"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=10,
        )
        git_ok = proc.returncode == 0 and "true" in (proc.stdout or "").lower()
        branch = ""
        if git_ok:
            br = subprocess.run(
                ["git", "branch", "--show-current"],
                cwd=ROOT,
                capture_output=True,
                text=True,
                timeout=10,
            )
            branch = (br.stdout or "").strip()
        checks.append(_check(
            "git_repo",
            git_ok,
            f"inside work tree, branch={branch or '?'}",
        ))
    except Exception as exc:
        checks.append(_check("git_repo", False, str(exc)))

    # Identity file
    checks.append(_check(
        "identity",
        IDENTITY_FILE.is_file(),
        str(IDENTITY_FILE),
        required=False,
    ))

    critical_ok = all(c["ok"] for c in checks if c["required"])
    return critical_ok, checks


def format_healthcheck_report(checks: list[dict]) -> str:
    lines = ["AsiaPower Runtime Healthcheck", ""]
    for c in checks:
        mark = "OK" if c["ok"] else ("WARN" if not c["required"] else "FAIL")
        req = "" if c["required"] else " (optional)"
        lines.append(f"[{mark}] {c['name']}{req}: {c['detail']}")
    lines.append("")
    critical_fail = any(not c["ok"] and c["required"] for c in checks)
    lines.append("Overall: OK" if not critical_fail else "Overall: FAIL")
    return "\n".join(lines)


def main() -> int:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")

    ok, checks = run_healthcheck()
    print(format_healthcheck_report(checks))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

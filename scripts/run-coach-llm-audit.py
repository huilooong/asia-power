#!/usr/bin/env python3
"""Run Coach LLM LIVE-RULES audit against Evidence (read-only reports)."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except Exception:
    pass

if not os.getenv("OPENAI_API_KEY"):
    env_path = ROOT / ".env"
    if env_path.is_file():
        for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
            if not line.startswith("OPENAI_API_KEY="):
                continue
            os.environ["OPENAI_API_KEY"] = line.split("=", 1)[1].strip().strip("'").strip('"')


def _env_truthy(name: str, default: str = "") -> bool:
    return (os.getenv(name) or default).strip().lower() in ("1", "true", "yes", "on")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Coach LLM LIVE-RULES audit (read-only reports). "
        "Daily default skips already-audited evidence_ids to save cost."
    )
    p.add_argument(
        "--force",
        action="store_true",
        help="Ignore audited_evidence_ids cache and re-judge the window "
        "(use after prompt/filter changes). Same as COACH_AUDIT_FORCE=1 "
        "or COACH_AUDIT_SKIP_AUDITED=0.",
    )
    p.add_argument(
        "--window-days",
        type=int,
        default=None,
        help="Override COACH_AUDIT_WINDOW_DAYS (default 2).",
    )
    p.add_argument(
        "--max-conversations",
        type=int,
        default=None,
        help="Override COACH_AUDIT_MAX_CONVOS (default 25).",
    )
    p.add_argument(
        "--suffix",
        default=None,
        help="Report filename suffix (e.g. force-verify → …-llm-audit-force-verify.md).",
    )
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    from sales_coach.llm_audit import run_llm_conformance_audit

    args = parse_args(argv)
    window = args.window_days if args.window_days is not None else int(
        os.getenv("COACH_AUDIT_WINDOW_DAYS") or "2"
    )
    max_c = args.max_conversations if args.max_conversations is not None else int(
        os.getenv("COACH_AUDIT_MAX_CONVOS") or "25"
    )
    force = bool(args.force) or _env_truthy("COACH_AUDIT_FORCE")
    # Explicit skip env still works; --force / COACH_AUDIT_FORCE wins to disable skip.
    skip_env_off = (os.getenv("COACH_AUDIT_SKIP_AUDITED") or "1").strip().lower() in (
        "0",
        "false",
        "no",
    )
    skip = not (force or skip_env_off)
    suffix = (args.suffix if args.suffix is not None else os.getenv("COACH_AUDIT_REPORT_SUFFIX") or "").strip()

    print("OPENAI_API_KEY set:", bool(os.getenv("OPENAI_API_KEY")))
    print(
        "audit mode:",
        "FORCE (re-judge window, ignore audited cache)" if not skip else "incremental (skip audited)",
    )
    if force:
        print("force flag: --force or COACH_AUDIT_FORCE=1")

    result = run_llm_conformance_audit(
        window_days=window,
        max_conversations=max_c,
        write=True,
        skip_audited=skip,
        combine_with_structured=True,
        report_suffix=suffix,
    )
    slim = {k: v for k, v in result.items() if k != "markdown"}
    print(json.dumps(slim, ensure_ascii=False, indent=2))

    # Closed loop: worth-CEO items → approval_gate Telegram; rest → digest file.
    if result.get("ok") and not _env_truthy("COACH_ESCALATION_OFF"):
        try:
            from sales_coach.escalation import escalate_violations_to_ceo

            esc = escalate_violations_to_ceo(result.get("violations") or [])
            print(json.dumps({"escalation": esc}, ensure_ascii=False, indent=2, default=str))
        except Exception as exc:  # noqa: BLE001 — audit report already written
            print(f"[coach-llm-audit] escalation failed: {type(exc).__name__}: {exc}", file=sys.stderr)

    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())

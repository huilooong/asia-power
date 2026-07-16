#!/usr/bin/env python3
"""Run Coach LLM LIVE-RULES audit against Evidence (read-only reports)."""

from __future__ import annotations

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


def main() -> int:
    from sales_coach.llm_audit import run_llm_conformance_audit

    window = int(os.getenv("COACH_AUDIT_WINDOW_DAYS") or "2")
    max_c = int(os.getenv("COACH_AUDIT_MAX_CONVOS") or "25")
    skip = (os.getenv("COACH_AUDIT_SKIP_AUDITED") or "1").strip().lower() not in (
        "0",
        "false",
        "no",
    )
    suffix = (os.getenv("COACH_AUDIT_REPORT_SUFFIX") or "").strip()
    print("OPENAI_API_KEY set:", bool(os.getenv("OPENAI_API_KEY")))
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
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())

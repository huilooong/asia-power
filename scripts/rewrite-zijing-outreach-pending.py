#!/usr/bin/env python3
"""Rewrite pending website_lead outreach drafts with 子敬 LLM voice. Does not send."""

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
    # Minimal .env parse (avoid bash source issues with angle brackets)
    env_path = ROOT / ".env"
    if env_path.is_file():
        for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip().strip("'").strip('"')
            if key and key not in os.environ:
                os.environ[key] = val

from customer_gateway.outreach_engine import rewrite_pending_website_outreach_drafts


def main() -> int:
    print("OPENAI_API_KEY set:", bool(os.getenv("OPENAI_API_KEY")))
    results = rewrite_pending_website_outreach_drafts(limit=20)
    out_path = ROOT / "reports" / "zijing-outreach-rewrite-2026-07-15.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    print("rewrote:", len(results))
    print("saved:", out_path)
    for i, r in enumerate(results, 1):
        print("---", i, r.get("outreach_id"))
        print(
            "skip=",
            r.get("skipped"),
            "fallback=",
            r.get("used_template_fallback"),
            "changed=",
            r.get("changed"),
        )
        print("name=", r.get("name"), "country=", r.get("country"), "product=", r.get("product"))
        if r.get("body"):
            print("SUBJ:", r.get("subject"))
            print(r["body"])
            print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Send a test message via WeCom 子敬 app (CEO-only smoke test)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from integrations.wecom_client import send_text_to_group, send_text_to_user
from integrations.wecom_config import load_wecom_config


def main() -> int:
    parser = argparse.ArgumentParser(description="Send WeCom test message as 子敬 app")
    parser.add_argument("--user", help="Member userid (1:1 test)")
    parser.add_argument("--chat", help="Group chatid (group test)")
    parser.add_argument("--text", default="子敬测试消息 ✅ AsiaPower WeCom 已连通", help="Message body")
    args = parser.parse_args()

    if not args.user and not args.chat:
        parser.error("Provide --user or --chat")

    load_dotenv(ROOT / ".env")
    cfg = load_wecom_config()
    if not cfg.enabled:
        print("WeCom not configured — see wecom-zijing-setup-runbook.md", file=sys.stderr)
        return 1

    try:
        if args.chat:
            body = send_text_to_group(args.chat, args.text, cfg=cfg)
        else:
            body = send_text_to_user(args.user, args.text, cfg=cfg)
        print("OK:", body)
        return 0
    except Exception as exc:
        print("FAIL:", exc, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

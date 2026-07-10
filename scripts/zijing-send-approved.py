#!/usr/bin/env python3
"""Send CEO-approved low-risk WhatsApp reply via 子敬 browser session.

Workflow: Cursor 定稿话术 → 本脚本发送。

Usage:
  python3 scripts/zijing-send-approved.py --contact "George Okyere" --message "Hi"
  python3 scripts/zijing-send-approved.py --contact "George Okyere" --resolve-only
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")


def _print_candidates(result: dict) -> None:
    candidates = result.get("candidates") or []
    if not candidates:
        print("  (no candidates)")
        return
    for row in candidates[:8]:
        name = row.get("name")
        score = row.get("score")
        source = row.get("source", "?")
        print(f"  - {name!r} score={score} source={source}")


def main() -> int:
    parser = argparse.ArgumentParser(description="子敬 · CEO 定稿后发送 WhatsApp（低风险）")
    parser.add_argument("--contact", required=True, help="客户名（可模糊，如 George Okyere）")
    parser.add_argument("--message", default="", help="已确认英文话术")
    parser.add_argument(
        "--resolve-only",
        action="store_true",
        help="只检索联系人（本地记录 + WhatsApp 会话），不发送",
    )
    parser.add_argument("--dry-run", action="store_true", help="只校验，不发送")
    args = parser.parse_args()

    contact = args.contact.strip()
    message = (args.message or "").strip()
    if not contact:
        print("ERROR: --contact required")
        return 1
    if not args.resolve_only and not message:
        print("ERROR: --message required unless --resolve-only")
        return 1

    from customer_gateway.whatsapp_contact_resolver import (
        resolve_query_targets,
        search_aliases,
        search_local_contact_names,
    )

    local_hits = search_local_contact_names(contact, limit=10)
    alias_hits = search_aliases(contact, limit=5)
    if alias_hits:
        print("Alias directory matches:")
        for row in alias_hits:
            titles = ", ".join(repr(t) for t in (row.get("whatsapp_titles") or [])[:3])
            print(f"  - {row['alias_name']!r} → WhatsApp titles: {titles}")
    if local_hits:
        print("Local record matches:")
        for row in local_hits:
            print(f"  - {row['name']!r} score={row['score']}")

    if args.resolve_only:
        from customer_gateway.whatsapp_browser_adapter import WhatsAppBrowserAdapter

        adapter = WhatsAppBrowserAdapter()
        page = adapter._launch(headless=False)
        try:
            page.goto(
                "https://web.whatsapp.com",
                wait_until="domcontentloaded",
                timeout=60_000,
            )
            if not adapter._wait_for_login(page, timeout_sec=60):
                print("ERROR: login_timeout")
                return 1
            store_hits = adapter.find_store_chats_by_query(page, contact, limit=10)
            targets = resolve_query_targets(contact)
            print("Resolved targets:", json.dumps(targets, ensure_ascii=False, indent=2))
            if store_hits:
                print("WhatsApp store matches:")
                for row in store_hits:
                    print(
                        f"  - {row['name']!r} index={row.get('index')} "
                        f"score={row.get('score')}"
                    )
            else:
                print("WhatsApp store: no matches")
            return 0 if (local_hits or store_hits) else 1
        finally:
            adapter.close()

    from customer_gateway.whatsapp_safety import low_risk_auto_send_enabled

    if not low_risk_auto_send_enabled():
        print("ERROR: WHATSAPP_AUTO_SEND_LOW_RISK=1 且 ACK 已设才能发送")
        return 1

    from customer_gateway.whatsapp_auto_sender import BLOCKED_SEND_RE

    if BLOCKED_SEND_RE.search(message):
        print("BLOCKED: message contains price/payment/shipping terms — need manual send")
        return 1
    if len(message) > 700:
        print("BLOCKED: message too long for low-risk lane")
        return 1

    if args.dry_run:
        print(f"DRY RUN OK — would send to {contact!r}: {message!r}")
        if local_hits:
            print(f"  local hint: {local_hits[0]['name']!r}")
        return 0

    from customer_gateway.whatsapp_browser_adapter import WhatsAppBrowserAdapter

    adapter = WhatsAppBrowserAdapter()
    result = adapter.send_low_risk_text(contact_name=contact, text=message)
    if result.get("ok"):
        print(
            f"OK — sent to {result.get('contact_name')!r} "
            f"via {result.get('match_mode')} ({result.get('chars', len(message))} chars)"
        )
        from customer_gateway.whatsapp_auto_sender import _record_auto_send

        _record_auto_send({
            "customer_name": result.get("contact_name") or contact,
            "customer_reply_draft": message,
            "original_message": "ceo_approved_send",
        })
        return 0

    print(f"FAIL: {result.get('error', 'unknown')}")
    tried = result.get("tried_titles") or []
    if tried:
        print("Tried titles:", ", ".join(repr(x) for x in tried[:10]))
    print("Candidates:")
    _print_candidates(result)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

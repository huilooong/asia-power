#!/usr/bin/env python3
"""Local bridge-only control writer. No network and no customer-send capability."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from customer_gateway.ai_reply_control import change_state

if __name__ == "__main__":
    payload = json.load(sys.stdin)
    import re
    target = str(payload.get("target", ""))
    if not re.fullmatch(r"\+[1-9][0-9]{7,14}", target):
        raise ValueError("invalid customer number")
    change_state(ROOT, "pause", target, "whatsapp_human:" + str(payload.get("message_id", "")))
    print(json.dumps({"ok": True, "paused": target}))

#!/usr/bin/env python3
"""Watch .claude/plans/coach-fix-*.md for new Cursor 实施报告 content → Telegram CEO."""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except Exception:
    pass

STATE_PATH = ROOT / "memory" / "sales_coach" / "plan_completion_watch.json"
PLANS = ROOT / ".claude" / "plans"
REPORT_HEADER = "## Cursor 实施报告"


def _load_state() -> dict:
    if not STATE_PATH.is_file():
        return {"files": {}}
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {"files": {}}


def _save_state(state: dict) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def _report_section(text: str) -> str:
    idx = text.find(REPORT_HEADER)
    if idx < 0:
        return ""
    return text[idx + len(REPORT_HEADER) :].strip()


def _meaningful(section: str) -> bool:
    # Ignore placeholder / empty / only "已开始" without 完成
    body = re.sub(r"<!--.*?-->", "", section, flags=re.S).strip()
    if not body:
        return False
    if "完成报告" in body or "### 完成" in body or "已落地" in body or "Release" in body:
        return True
    # Any substantial addition beyond a single 已开始 line
    lines = [ln.strip() for ln in body.splitlines() if ln.strip() and not ln.strip().startswith("- 已开始")]
    return len("".join(lines)) >= 40


def main() -> int:
    state = _load_state()
    files = state.setdefault("files", {})
    notified = 0
    if not PLANS.is_dir():
        print("[coach-plan-watch] no plans dir")
        return 0

    for path in sorted(PLANS.glob("coach-fix-*.md")):
        text = path.read_text(encoding="utf-8", errors="replace")
        section = _report_section(text)
        digest = hashlib.sha256(section.encode("utf-8")).hexdigest()
        prev = files.get(path.name) or {}
        if prev.get("sha256") == digest:
            continue
        files[path.name] = {
            "sha256": digest,
            "mtime": path.stat().st_mtime,
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }
        if not _meaningful(section):
            continue
        # First time we see meaningful content (or content changed to meaningful)
        if prev.get("notified_sha256") == digest:
            continue
        msg = (
            f"Cursor 已完成任务（请复核）\n"
            f"文件: {path}\n"
            f"建议找 Claude 复核一遍 diff / 测试 / 部署再算数——不要只看「已完成」字样。"
        )
        try:
            from coo_core.approval_gate import notify_ceo

            sent = notify_ceo(msg)
            print(f"[coach-plan-watch] notified {path.name} sent={sent}")
            files[path.name]["notified_sha256"] = digest
            notified += 1
        except Exception as exc:  # noqa: BLE001
            print(f"[coach-plan-watch] notify failed {path.name}: {exc}", file=sys.stderr)

    _save_state(state)
    print(json.dumps({"ok": True, "notified": notified}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""每小时运行一次，向龙哥 Telegram 汇报各 agent 工作进展。"""

from __future__ import annotations

import json
import os
import sys
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

BOT_TOKEN = os.getenv("COO_TELEGRAM_BOT_TOKEN", "").strip()
CHAT_ID = os.getenv("COO_TELEGRAM_ALLOWED_CHAT_IDS", "").strip().split(",")[0].strip()

ACTIVITY = ROOT / "memory/customer_gateway/zijing_activity_stream.jsonl"
AFRICA_LEADS = ROOT / "memory/customer_gateway/africa_maps_leads.jsonl"
MAPS_LEADS = ROOT / "memory/customer_gateway/maps_leads.jsonl"
OUTREACH_QUEUE = ROOT / "memory/customer_gateway/outreach_queue"
EMAIL_COUNTER = ROOT / "reports/email-daily-count.json"
APBD_LOG = ROOT / "reports/apbd-once.log"
ZIJING_LOG = ROOT / "reports/zijing-run.log"


def tg_send(text: str) -> None:
    if not BOT_TOKEN or not CHAT_ID:
        print(f"[hourly-report] Telegram not configured, printing instead:\n{text}")
        return
    payload = {"chat_id": CHAT_ID, "text": text, "parse_mode": "HTML"}
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            resp = json.loads(r.read())
            if not resp.get("ok"):
                print(f"[hourly-report] Telegram error: {resp}", file=sys.stderr)
    except Exception as exc:
        print(f"[hourly-report] Telegram send failed: {exc}", file=sys.stderr)


def count_lines(path: Path) -> int:
    if not path.exists():
        return 0
    try:
        return sum(1 for _ in path.open(encoding="utf-8", errors="ignore"))
    except Exception:
        return 0


def count_with_email(path: Path) -> int:
    if not path.exists():
        return 0
    count = 0
    try:
        for line in path.open(encoding="utf-8", errors="ignore"):
            try:
                d = json.loads(line)
                if d.get("email") and "@" in d["email"]:
                    count += 1
            except Exception:
                pass
    except Exception:
        pass
    return count


def recent_activity(hours: int = 1) -> list[dict]:
    if not ACTIVITY.exists():
        return []
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    events = []
    try:
        for line in ACTIVITY.open(encoding="utf-8", errors="ignore"):
            try:
                d = json.loads(line)
                ts_str = d.get("ts", "")
                if not ts_str:
                    continue
                ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                if ts >= cutoff:
                    events.append(d)
            except Exception:
                pass
    except Exception:
        pass
    return events


def email_stats_today() -> dict:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if not EMAIL_COUNTER.exists():
        return {"date": today, "sent": 0, "limit": 90}
    try:
        d = json.loads(EMAIL_COUNTER.read_text())
        if d.get("date") != today:
            return {"date": today, "sent": 0, "limit": 90}
        return d
    except Exception:
        return {"date": today, "sent": 0, "limit": 90}


def pending_drafts() -> int:
    if not OUTREACH_QUEUE.exists():
        return 0
    try:
        return sum(
            1 for f in OUTREACH_QUEUE.glob("*.json")
            if json.loads(f.read_text()).get("status") == "pending"
        )
    except Exception:
        return 0


def last_apbd_cycle() -> str:
    if not APBD_LOG.exists():
        return "无记录"
    try:
        lines = APBD_LOG.read_text(errors="ignore").splitlines()
        for line in reversed(lines):
            if "cycle" in line.lower() or "mission" in line.lower() or "outreach" in line.lower():
                return line.strip()[:120]
    except Exception:
        pass
    return "无记录"


def zijing_current_progress() -> str:
    events = recent_activity(hours=1)
    if not events:
        return "最近 1 小时无活动"
    last = events[-1]
    detail = last.get("detail", "")
    status = last.get("status", "")
    completed = [e for e in events if e.get("status") == "completed"]
    new_leads = 0
    for e in completed:
        result = e.get("result", "")
        if "有效" in result:
            try:
                new_leads += int(result.split("/")[0].split("+")[-1])
            except Exception:
                pass
    summary = f"{detail}" if detail else status
    if new_leads:
        summary += f" | +{new_leads} 新线索"
    return summary[:200]


def main() -> None:
    now = datetime.now(timezone.utc)
    hour_str = now.strftime("%Y-%m-%d %H:%M UTC")

    africa_total = count_lines(AFRICA_LEADS)
    africa_email = count_with_email(AFRICA_LEADS)
    maps_total = count_lines(MAPS_LEADS)
    email_st = email_stats_today()
    drafts = pending_drafts()
    zijing_prog = zijing_current_progress()
    apbd_last = last_apbd_cycle()

    msg = (
        f"🦞 <b>AsiaPower 小时报</b> · {hour_str}\n"
        f"\n"
        f"<b>📡 子敬 · Africa Maps</b>\n"
        f"  累计线索: {africa_total} 条（含邮箱 {africa_email}）\n"
        f"  本小时: {zijing_prog}\n"
        f"\n"
        f"<b>🧠 APBD 大脑</b>\n"
        f"  上次周期: {apbd_last}\n"
        f"\n"
        f"<b>📧 邮件发送</b>\n"
        f"  今日已发: {email_st['sent']} / {email_st['limit']} 封\n"
        f"  待发草稿: {drafts} 条\n"
        f"\n"
        f"<b>🌐 asia-power.com</b> · 持续引流中"
    )

    tg_send(msg)
    print(msg)


if __name__ == "__main__":
    main()

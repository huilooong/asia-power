#!/usr/bin/env python3
"""Mac local · FB ↔ X alternate social run (CEO 2026-07-04).

Each cycle: Facebook action → X action → Facebook → X …
Respects platform_block_only (fb_platform_limits.json) for FB actions.
X session must be logged in on this Mac (same as FB).

Usage:
  APSALES_SOCIAL_ENGAGEMENT=1 python3 scripts/apsales-social-alternate-run.py
  python3 scripts/apsales-social-alternate-run.py --pairs 3 --json
  python3 scripts/apsales-social-alternate-run.py --preview 10
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except ModuleNotFoundError:
    pass

os.environ.setdefault("APSALES_SOCIAL_BROWSER_HEADLESS", "0")
os.environ.setdefault("APSALES_SOCIAL_ENGAGEMENT", "1")
os.environ.setdefault("APSALES_SOCIAL_ALTERNATE", "1")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="子敬 · FB↔X 交替社媒运行")
    p.add_argument("--pairs", type=int, default=1, help="FB+X pairs this run (default 1 = 1 FB + 1 X)")
    p.add_argument("--plan", action="store_true", help="Regenerate today's interleaved queue first")
    p.add_argument("--preview", type=int, default=0, metavar="N", help="Show next N actions only, no execute")
    p.add_argument("--json", action="store_true", help="JSON output")
    return p


def main() -> int:
    args = build_parser().parse_args()

    from customer_gateway.fb_platform_limits import get_operating_mode, is_platform_limited
    from customer_gateway.social_engagement_engine import (
        execute_alternate_cycle,
        plan_daily_actions,
        preview_alternate_sequence,
    )
    from customer_gateway.social_session import get_all_session_status
    from customer_gateway.zijing_routing import run_maps_email_mode

    mode_info = get_operating_mode()
    limited, _ = is_platform_limited()

    if args.preview:
        preview = preview_alternate_sequence(args.preview)
        if args.json:
            print(json.dumps({"preview": preview}, ensure_ascii=False, indent=2))
        else:
            print("=== 下一动作预览 · FB↔X 交替 ===")
            for i, row in enumerate(preview, 1):
                tag = "（预计）" if row.get("projected") else ""
                print(f"  {i:2}. {row.get('label', '?')} {tag}")
        return 0

    # CEO 路由：限流 → 仅 Maps+邮件，跳过 FB/X
    if limited:
        from customer_gateway.zijing_activity_stream import track_step

        with track_step("alternate_run", f"限流 · 改跑 Maps+邮件 · {mode_info.get('mode_label', '')}", platform="maps"):
            maps_out = run_maps_email_mode(source="alternate_run", max_countries=2)
        if args.json:
            print(json.dumps({"mode": "limited", "operating_mode": mode_info, **maps_out}, ensure_ascii=False, indent=2, default=str))
        else:
            print(f"=== 限流模式 · Maps+邮件（跳过 FB↔X）===")
            af = maps_out.get("africa_maps") or {}
            mf = maps_out.get("maps_fallback") or {}
            if af and not af.get("skipped"):
                print(
                    f"  🌍 非洲 Maps: 线索 +{af.get('new_leads', 0)} · "
                    f"草稿 +{af.get('new_drafts', 0)}"
                )
            elif mf and not mf.get("skipped"):
                print(f"  🗺 Maps: 线索 +{mf.get('new_leads', 0)} · 草稿 +{mf.get('new_drafts', 0)}")
            else:
                print(f"  — 跳过: {(af or mf or {}).get('reason', maps_out.get('error', '—'))}")
        return 0

    sessions = get_all_session_status()
    fb_ok = (sessions.get("platforms") or {}).get("facebook", {}).get("logged_in")
    x_ok = (sessions.get("platforms") or {}).get("x", {}).get("logged_in")
    if not fb_ok or not x_ok:
        msg = {"ok": False, "error": "needs_login", "facebook": bool(fb_ok), "x": bool(x_ok)}
        if args.json:
            print(json.dumps(msg, ensure_ascii=False, indent=2))
        else:
            print("❌ 需要 Mac 本地 FB + X 均已登录")
            print(f"   Facebook: {'✅' if fb_ok else '❌'} · X: {'✅' if x_ok else '❌'}")
        return 1

    if args.plan:
        plan_daily_actions(force=True)

    from customer_gateway.zijing_activity_stream import log_step_end, log_step_start

    log_step_start(
        "alternate_run",
        f"FB↔X 交替 · pairs={max(1, args.pairs)}",
        platform="fb+x",
    )
    result = execute_alternate_cycle(max_pairs=max(1, args.pairs))
    result["mode"] = "normal"
    result["operating_mode"] = mode_info
    seq = result.get("sequence") or []
    log_step_end(
        "alternate_run",
        f"完成 {result.get('executed', 0)} 步 · " + (" → ".join(s.get("label", "?") for s in seq[:6]) if seq else "无动作"),
        platform="fb+x",
        status="completed" if result.get("executed") else "idle",
    )

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    else:
        seq = result.get("sequence") or []
        print(f"=== FB↔X 交替运行 · 完成 {result.get('executed', 0)} 步 ===")
        if seq:
            print("  本次:", " → ".join(s.get("label", "?") for s in seq))
        else:
            print("  本次: 无可执行动作（可能 block / 未到时间 / 队列为空）")
        if result.get("stopped_reason"):
            print(f"  ⏸ 停止原因: {result['stopped_reason']}")
        preview = result.get("next_10") or preview_alternate_sequence(10)
        print("\n下一 10 步:")
        for i, row in enumerate(preview, 1):
            print(f"  {i:2}. {row.get('label', '?')}")

    ok = bool(result.get("executed", 0)) or not result.get("stopped_reason")
    return 0 if ok or result.get("skipped") else 1


if __name__ == "__main__":
    raise SystemExit(main())

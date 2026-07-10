#!/usr/bin/env python3
"""子敬 · 模式感知统一入口（CEO 2026-07-04）

限流（fb_platform_limits.json 有 active block）→ 非洲 Google Maps + 邮件草稿
正常 → FB↔X 交替 或 Facebook aggressive 每日运行

Usage:
  python3 scripts/apsales-zijing-run.py
  python3 scripts/apsales-zijing-run.py --json
  python3 scripts/apsales-zijing-run.py --force-mode limited   # 模拟限流
  python3 scripts/apsales-zijing-run.py --force-mode normal    # 模拟正常
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


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="子敬 · 限流/正常 自动路由")
    p.add_argument("--pairs", type=int, default=1, help="正常模式 FB↔X 对数（默认 1）")
    p.add_argument("--max-countries", type=int, default=3, help="限流模式每轮处理国家数")
    p.add_argument(
        "--force-mode",
        choices=("limited", "normal"),
        help="模拟模式（写入 APSALES_ZIJING_FORCE_MODE 环境变量）",
    )
    p.add_argument("--json", action="store_true", help="JSON 输出")
    return p


def main() -> int:
    args = build_parser().parse_args()

    if args.force_mode:
        os.environ["APSALES_ZIJING_FORCE_MODE"] = args.force_mode

    from customer_gateway.fb_platform_limits import get_operating_mode
    from customer_gateway.zijing_routing import route_and_run

    mode_info = get_operating_mode()
    result = route_and_run(
        pairs=max(1, args.pairs),
        aggressive=True,
        max_countries=max(1, args.max_countries),
    )

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    else:
        mode = result.get("mode") or mode_info.get("mode")
        label = result.get("mode_label") or mode_info.get("mode_label")
        print(f"=== 子敬运行 · {label} ({mode}) ===")
        if mode == "limited":
            af = result.get("africa_maps") or {}
            mf = result.get("maps_fallback") or {}
            if af and not af.get("skipped"):
                print(
                    f"  🌍 非洲 Maps: 线索 +{af.get('new_leads', 0)} · "
                    f"草稿 +{af.get('new_drafts', 0)} · "
                    f"{af.get('countries_done', 0)}/{af.get('countries_total', 54)} 国"
                )
            elif mf and not mf.get("skipped"):
                print(
                    f"  🗺 Maps: 线索 +{mf.get('new_leads', 0)} · "
                    f"草稿 +{mf.get('new_drafts', 0)}"
                )
            else:
                print(f"  — 跳过: {(af or mf or {}).get('reason', result.get('error', '—'))}")
        else:
            path = result.get("path", "—")
            if path == "alternate":
                alt = result.get("alternate") or {}
                seq = alt.get("sequence") or []
                print(f"  FB↔X 交替: {alt.get('executed', 0)} 步")
                if seq:
                    print("  本次:", " → ".join(s.get("label", "?") for s in seq))
            elif path == "facebook_daily":
                fb = result.get("facebook_daily") or {}
                print(f"  Facebook daily: {'✅' if fb.get('ok') else '❌'} batches={fb.get('batches_run', 1)}")
            elif result.get("error"):
                print(f"  ❌ {result['error']}")
        pauses = (mode_info.get("active_pauses") or {})
        if pauses:
            print(f"  ⏸ 暂停动作: {', '.join(f'{k}→{v}' for k, v in pauses.items())}")

    ok = bool(result.get("ok"))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

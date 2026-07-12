#!/usr/bin/env python3
"""Social autopilot — publish approved queue + scan replies + notify CEO."""

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


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="子敬 · 社媒自动发帖 + 回复扫描 + 非洲互动")
    p.add_argument("--publish", action="store_true", help="Process pending publish queue")
    p.add_argument("--scan-replies", action="store_true", help="Scan live posts for new comments")
    p.add_argument("--all", action="store_true", help="Publish + scan + engagement + reply-watch")
    p.add_argument("--engage", action="store_true", help="Run human-paced FB+X engagement cycle")
    p.add_argument("--plan-only", action="store_true", help="Plan today's engagement queue only")
    p.add_argument("--status", action="store_true", help="Show session + engagement summary JSON")
    p.add_argument("--max-posts", type=int, default=0, help="Max posts this run (0=env default)")
    p.add_argument("--max-actions", type=int, default=0, help="Max engagement actions this run (0=env default)")
    p.add_argument("--json", action="store_true", help="JSON output")
    p.add_argument("--browse", action="store_true", help="Run Facebook friends feed browse (Mac local)")
    p.add_argument("--browse-status", action="store_true", help="Show last browse session summary")
    p.add_argument("--discover-global-demand", action="store_true", help="Discover public global buyer-demand signals")
    p.add_argument("--comment-review-queue", action="store_true", help="Build manual review queue for public video/comment candidates")
    p.add_argument("--demand-drafts", action="store_true", help="Build reply drafts from saved social buyer-demand intel")
    p.add_argument("--create-demand-drafts", action="store_true", help="Write selected social demand replies to draft_queue")
    return p


def main() -> int:
    args = build_parser().parse_args()

    from customer_gateway.social_autopilot import load_pending_queue, run_autopilot
    from customer_gateway.social_session import get_all_session_status

    if args.browse_status:
        try:
            from integrations.social_browser.facebook_feed_research import get_browse_summary
            print(json.dumps(get_browse_summary(), ensure_ascii=False, indent=2))
        except Exception as exc:
            print(json.dumps({"error": str(exc)}, ensure_ascii=False, indent=2))
        return 0

    if args.status:
        payload = {
            "sessions": get_all_session_status(),
            "pending_queue": len(load_pending_queue()),
        }
        if os.getenv("APSALES_SOCIAL_ENGAGEMENT", "0").strip() == "1":
            try:
                from customer_gateway.social_engagement_engine import get_today_summary
                payload["engagement"] = get_today_summary()
            except Exception:
                pass
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0

    if args.discover_global_demand:
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "global_demand_discovery",
            ROOT / "scripts" / "apsales-global-demand-discovery.py",
        )
        mod = importlib.util.module_from_spec(spec)
        assert spec and spec.loader
        spec.loader.exec_module(mod)
        discovery_args = mod.build_parser().parse_args(["--json", "--deep-read"])
        result = mod.discover(discovery_args)
        if args.json:
            print(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            print("=== 子敬全球公开需求发现 ===")
            print(f"已检查搜索结果: {result.get('reviewed', 0)}")
            print(f"买家需求: {result.get('buyer_demand', 0)}")
            print(f"评论检查候选: {result.get('comment_review_candidate', 0)}")
            print(f"市场信号: {result.get('market_signal', 0)}")
            print(f"报告: {result.get('report')}")
        return 0

    if args.comment_review_queue:
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "comment_review_queue",
            ROOT / "scripts" / "apsales-comment-review-queue.py",
        )
        mod = importlib.util.module_from_spec(spec)
        assert spec and spec.loader
        spec.loader.exec_module(mod)
        queue_args = mod.build_parser().parse_args(["--json"])
        rows = mod.load_rows(mod.DEFAULT_INTEL_FILES)
        candidates = mod.select_candidates(rows, limit=queue_args.limit)
        mod.write_report(candidates, rows_reviewed=len(rows))
        result = {
            "ok": True,
            "reviewed": len(rows),
            "candidates": len(candidates),
            "report": str(mod.REPORT_FILE),
        }
        if args.json:
            print(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            print("=== 子敬公开评论检查队列 ===")
            print(f"已读取情报: {len(rows)}")
            print(f"评论检查候选: {len(candidates)}")
            print(f"报告: {mod.REPORT_FILE}")
        return 0

    if args.demand_drafts or args.create_demand_drafts:
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "social_demand_drafts",
            ROOT / "scripts" / "apsales-social-demand-drafts.py",
        )
        mod = importlib.util.module_from_spec(spec)
        assert spec and spec.loader
        spec.loader.exec_module(mod)
        rows = mod.load_intel_rows(mod.DEFAULT_INTEL_FILES)
        candidates = mod.select_candidates(rows, limit=10, min_score=70)
        created = mod.create_drafts(candidates) if args.create_demand_drafts else []
        mod.write_report(rows=rows, candidates=candidates, created=created)
        payload = {
            "ok": True,
            "reviewed": len(rows),
            "candidates": len(candidates),
            "drafts_created": len(created),
            "report": str(mod.REPORT_FILE),
            "created": created,
        }
        if args.json:
            print(json.dumps(payload, ensure_ascii=False, indent=2))
        else:
            print("=== 子敬社媒需求草稿 ===")
            print(f"已读取情报: {len(rows)}")
            print(f"高意图需求: {len(candidates)}")
            print(f"已创建草稿: {len(created)}")
            print(f"报告: {mod.REPORT_FILE}")
        return 0

    do_publish = args.publish or args.all
    do_scan = args.scan_replies or args.all
    if args.plan_only:
        do_publish = False
        do_scan = False
    elif not do_publish and not do_scan:
        do_publish = True
        do_scan = True

    max_posts = args.max_posts or None
    if max_posts:
        os.environ["APSALES_SOCIAL_MAX_POSTS_PER_RUN"] = str(max_posts)
    max_actions = args.max_actions or None
    if max_actions:
        os.environ["APSALES_SOCIAL_ENGAGEMENT_MAX_PER_RUN"] = str(max_actions)

    from customer_gateway.zijing_activity_stream import log_step_end, log_step_start, track_step

    log_step_start("autopilot", f"publish={do_publish} scan={do_scan}", platform="")
    result = run_autopilot(publish=do_publish, scan_replies=do_scan)
    if do_publish:
        pub = result.get("publish") or {}
        log_step_end(
            "publish",
            f"发布 {pub.get('published', 0)} 帖",
            platform="",
            status="completed" if not any(not r.get("ok") and not r.get("skipped") for r in (pub.get("results") or [])) else "failed",
        )
    if do_scan:
        scan = result.get("reply_scan") or {}
        log_step_end("scan_replies", f"扫描 {scan.get('scanned', 0)} 帖", platform="", status="completed")

    do_engage = args.engage or args.plan_only or (
        args.all and os.getenv("APSALES_SOCIAL_ENGAGEMENT", "0").strip() == "1"
    )
    if do_engage:
        os.environ.setdefault("APSALES_SOCIAL_ALTERNATE", "1")
        from customer_gateway.social_engagement_engine import plan_daily_actions, run_engagement_cycle
        if args.plan_only:
            with track_step("engage", "制定今日 FB↔X 交替计划", platform="fb+x"):
                result["engagement"] = plan_daily_actions(force=True)
        else:
            with track_step("engage", "FB↔X 交替执行（1 FB + 1 X）", platform="fb+x"):
                result["engagement"] = run_engagement_cycle(plan=True, execute=not args.plan_only)

    if args.all:
        try:
            from scripts.apsales_social_reply_watch import run_reply_watch, notify_if_needed  # type: ignore
        except ImportError:
            import importlib.util
            spec = importlib.util.spec_from_file_location(
                "reply_watch",
                ROOT / "scripts" / "apsales-social-reply-watch.py",
            )
            mod = importlib.util.module_from_spec(spec)
            assert spec and spec.loader
            spec.loader.exec_module(mod)
            rw = mod.run_reply_watch()
            mod.notify_if_needed(rw)
            result["reply_watch"] = rw
        else:
            rw = run_reply_watch()
            notify_if_needed(rw)
            result["reply_watch"] = rw

    if args.browse or (args.all and os.getenv("APSALES_FB_BROWSE", "0").strip() == "1"):
        try:
            from integrations.social_browser.facebook_feed_research import browse_friends_feed
            deep = os.getenv("APSALES_FB_BROWSE_DEEP", "1").strip() == "1"
            with track_step("browse_feed", f"Autopilot 浏览 deep={deep}", platform="facebook"):
                result["browse_feed"] = browse_friends_feed(
                    deep=deep,
                    max_posts=int(os.getenv("APSALES_FB_BROWSE_MAX_POSTS", "50")),
                    max_friends=int(os.getenv("APSALES_FB_BROWSE_MAX_FRIENDS", "30")),
                )
        except Exception as exc:
            result["browse_feed"] = {"ok": False, "error": str(exc)}

    log_step_end("autopilot", "Autopilot 运行结束", platform="", status="completed")

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    else:
        pub = result.get("publish") or {}
        scan = result.get("reply_scan") or {}
        print(f"=== 子敬社媒 Autopilot · {result.get('ran_at')} ===")
        if pub:
            print(f"待发队列: {pub.get('pending_count', 0)} · 本次发布: {pub.get('published', 0)}")
            for row in pub.get("results") or []:
                if row.get("ok"):
                    print(f"  ✅ {row.get('platform')} → {row.get('post_url')}")
                elif row.get("skipped"):
                    print(f"  ⏭ {row.get('platform')} — {row.get('reason')}")
                else:
                    print(f"  ❌ {row.get('platform')} — {row.get('error')}")
        if scan:
            print(f"回复扫描: {scan.get('scanned', 0)} 帖 · 新回复 {scan.get('new_replies', 0)} 条")
        eng = result.get("engagement") or {}
        if eng:
            exe = eng.get("execute") or eng
            alt = exe.get("alternate_mode") or eng.get("alternate_mode")
            mode = "FB↔X 交替 · " if alt else ""
            print(f"互动引擎: {mode}计划 {eng.get('plan', {}).get('planned', '—')} · 本次执行 {exe.get('executed', 0)} · 待办 {exe.get('pending', '—')}")
            seq = exe.get("sequence") or []
            if seq:
                print(f"  序列: {' → '.join(s.get('label', '?') for s in seq)}")
            if exe.get("stopped_reason"):
                print(f"  ⏸ 频率上限: {exe.get('stopped_reason')}")
        br = result.get("browse_feed") or {}
        if br:
            if br.get("ok"):
                print(
                    f"好友动态浏览: ✅ {br.get('intel_saved', br.get('notes_saved', 0))} 条情报 · "
                    f"发动机线索 {br.get('engine_leads', 0)} 条 · {br.get('duration_minutes', '—')} 分钟"
                )
            elif br.get("error"):
                print(f"好友动态浏览: ❌ {br.get('error')}")

    failed = any(
        not r.get("ok") and not r.get("skipped")
        for r in (result.get("publish") or {}).get("results") or []
    )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

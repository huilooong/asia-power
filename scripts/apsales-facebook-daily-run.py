#!/usr/bin/env python3
"""Mac daily Facebook run — ONE browser session for all FB work.

Priority order (CEO 2026-07-04 · traffic to asia-power.com):
  1. Accept pending friend requests
  2. Search + join FB groups
  3. Group greetings — human intro + link
  4. Group comments — helpful + link when relevant
  5. Browse feed → market intel JSONL
  6. Send friend DMs
  7. Timeline post ONLY if --post and CEO explicitly wants it

--until-block: platform probe mode — join→greet→comment→DM loop until FB hard block.
  Session max 3h wall clock, then rest 1h (anti infinite-loop). No self-imposed daily caps.
--aggressive: legacy alias; prefer --until-block.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except ModuleNotFoundError:
    pass

SESSION_MAX_SECONDS = 3 * 3600  # 3 hours probe session
SESSION_REST_SECONDS = 3600       # 1 hour rest after session cap
UNLIMITED = 9999


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="子敬 · Facebook 每日一体运行（单浏览器 · 小组优先）")
    p.add_argument("--all", action="store_true", help="Run full pipeline")
    p.add_argument("--aggressive", action="store_true", help="Legacy — same as --until-block")
    p.add_argument("--until-block", action="store_true", help="Probe FB limits: loop until platform block")
    p.add_argument("--accept", action="store_true", help="Accept friend requests only")
    p.add_argument("--groups", action="store_true", help="Search + join + greet groups")
    p.add_argument("--browse", action="store_true", help="Browse feed only")
    p.add_argument("--dm", action="store_true", help="Send friend DMs only")
    p.add_argument("--post", action="store_true", help="Timeline post if quota left")
    p.add_argument("--accept-max", type=int, default=10, help="Max friend accepts (default 10)")
    p.add_argument("--max-posts", type=int, default=50, help="Max feed posts to scan")
    p.add_argument("--dm-max", type=int, default=0, help="Max DMs this run (0=policy default)")
    p.add_argument("--join-max", type=int, default=0, help="Max group joins this run (0=policy batch)")
    p.add_argument("--greet-max", type=int, default=0, help="Max group greetings this run (0=policy batch)")
    p.add_argument("--comment-max", type=int, default=0, help="Max group comments this run (0=policy batch)")
    p.add_argument("--json", action="store_true", help="JSON output")
    p.add_argument("--clear-lock", action="store_true", help="Force clear stale browser lock")
    p.add_argument(
        "--maps-fallback",
        action="store_true",
        help="After FB run (or when group_join blocked), run Google Maps prospecting + email drafts",
    )
    return p


def _probe_mode() -> bool:
    from customer_gateway.social_engagement_engine import load_policy, _platform_block_only

    return _platform_block_only(load_policy())


def _policy_batch_sizes() -> dict[str, int | float]:
    from customer_gateway.social_engagement_engine import load_policy

    policy = load_policy()
    fb = (policy.get("platforms") or {}).get("facebook") or {}
    groups = policy.get("facebook_groups") or {}
    sched = policy.get("scheduling") or {}
    batch = int(fb.get("join_batch_size") or groups.get("join_batch_size") or 5)
    probe = _probe_mode()
    return {
        "join_batch": batch if not probe else max(batch, 10),
        "greet_batch": batch if not probe else max(batch, 10),
        "comment_batch": max(2, batch - 2) if not probe else max(batch, 8),
        "dm_batch": int(fb.get("max_dms_per_run") or 5) if not probe else 10,
        "session_max_hours": float(sched.get("aggressive_session_max_hours") or 3),
        "rest_hours": float(sched.get("aggressive_rest_hours") or 1),
        "probe_mode": probe,
    }


def _daily_caps_remaining() -> dict[str, int]:
    if _probe_mode():
        return {"joins": UNLIMITED, "greetings": UNLIMITED, "comments": UNLIMITED, "dms": UNLIMITED}
    from integrations.social_browser.facebook_groups import load_group_policy, load_groups_state

    pol = load_group_policy()
    state = load_groups_state()
    from customer_gateway.social_engagement_engine import load_policy

    policy = load_policy()
    fb = (policy.get("platforms") or {}).get("facebook") or {}
    dm_cap = int(fb.get("max_dms_per_day") or 25)
    dm_sent = 0
    dm_log = ROOT / "memory" / "customer_gateway" / "fb_friend_dm_log.jsonl"
    if dm_log.is_file():
        today = state.get("date") or ""
        try:
            for line in dm_log.read_text(encoding="utf-8").splitlines():
                if not line.strip():
                    continue
                row = json.loads(line)
                if str(row.get("sent_at") or "").startswith(today) and row.get("status") == "sent":
                    dm_sent += 1
        except (json.JSONDecodeError, OSError):
            pass
    return {
        "joins": max(0, pol["max_joins_per_day"] - int(state.get("joins_today") or 0)),
        "greetings": max(0, pol["max_greetings_per_day"] - int(state.get("greetings_today") or 0)),
        "comments": max(0, pol["max_comments_per_day"] - int(state.get("comments_today") or 0)),
        "dms": max(0, dm_cap - dm_sent),
    }


def _pending_facebook_post() -> dict | None:
    from customer_gateway.social_autopilot import load_pending_queue

    for item in load_pending_queue():
        platform = (item.get("platform") or "").strip().lower()
        if platform in ("facebook", "fb"):
            return item
    return None


def _timeline_quota_left() -> tuple[bool, str]:
    from customer_gateway.social_engagement_engine import load_policy, load_state, timeline_posts_disabled

    policy = load_policy()
    state = load_state()
    disabled, until = timeline_posts_disabled(policy)
    if disabled:
        return False, f"rate_limited_until_{until}"

    fb = (policy.get("platforms") or {}).get("facebook") or {}
    cap = int(fb.get("max_timeline_posts_per_day") or fb.get("max_posts_per_day") or 0)
    if cap <= 0:
        return False, "timeline_disabled_by_policy"
    counts = (state.get("counts") or {}).get("facebook") or {}
    if int(counts.get("post", 0)) >= cap:
        return False, "daily_timeline_cap"
    return True, "ok"


def _run_timeline_post(page, context, item: dict) -> dict:
    from customer_gateway.social_post_assets import resolve_post_assets
    from integrations.social_browser.platform_adapter import post_facebook_browser

    resolved = resolve_post_assets(item, "facebook")
    return post_facebook_browser(
        message=resolved["caption"],
        link=resolved["listing_url"],
        image_urls=resolved["image_urls"],
        page=page,
        context=context,
    )


def _run_group_comments(*, max_comments: int) -> dict:
    from customer_gateway.social_engagement_engine import load_policy, _pick_template
    from integrations.social_browser.facebook_groups import load_groups_config, _groups_list
    from integrations.social_browser.platform_adapter import engage_comment_browser

    cfg = load_groups_config()
    joined = [
        g for g in _groups_list(cfg)
        if g.get("status") in ("joined", "greeted", "pending") and g.get("group_url")
    ]
    policy = load_policy()
    results: list[dict] = []
    errors: list[str] = []
    for i, grp in enumerate(joined[:max_comments]):
        text = _pick_template(policy, with_link=(i % 2 == 1))
        cr = engage_comment_browser(
            "facebook",
            search_query=grp.get("name") or grp.get("group_url", ""),
            text=text,
        )
        results.append(cr)
        if cr.get("error") == "rate_limited" or cr.get("blocked"):
            errors.append("rate_limited")
            break
        time.sleep(random.uniform(4.0, 8.0))
    return {"ok": not errors, "comments": results, "errors": errors}


def run_daily(
    *,
    do_accept: bool,
    do_groups: bool,
    do_browse: bool,
    do_dm: bool,
    do_post: bool,
    do_comments: bool,
    accept_max: int,
    max_posts: int,
    dm_max: int,
    join_max: int,
    greet_max: int,
    comment_max: int,
    aggressive: bool = False,
    until_block: bool = False,
    _retry: bool = True,
) -> dict:
    from customer_gateway.zijing_activity_stream import log_step_end, log_step_start, track_step
    from integrations.social_browser.session_manager import (
        SocialBrowserSessionBusy,
        acquire_browser,
        clear_stale_lock,
        lock_status,
    )
    from integrations.social_browser.facebook_friends import accept_friend_requests
    from integrations.social_browser.facebook_feed_research import browse_friends_feed
    from integrations.social_browser.facebook_messenger import send_friend_dms
    from integrations.social_browser.facebook_groups import run_daily_group_actions

    clear_stale_lock(force=False)
    batches = _policy_batch_sizes()
    probe = until_block or aggressive or bool(batches.get("probe_mode"))
    session_max = int(float(batches["session_max_hours"]) * 3600) if probe else SESSION_MAX_SECONDS
    rest_seconds = int(float(batches.get("rest_hours") or 1) * 3600)

    result: dict = {
        "ok": True,
        "aggressive": aggressive,
        "until_block": until_block or probe,
        "probe_mode": probe,
        "lock_before": lock_status(),
        "accept": None,
        "groups": None,
        "comments": None,
        "browse": None,
        "dm": None,
        "post": None,
        "batches": [],
        "errors": [],
    }

    mode_label = (
        "Facebook 平台上限探测 · until-block"
        if probe
        else "Facebook 每日一体运行（小组优先）"
    )
    log_step_start("daily_run", mode_label, platform="facebook")

    accept_done = False
    browse_done = False
    session_start = time.monotonic()
    batch_num = 0
    rest_taken = False
    hard_blocked = False

    try:
        with acquire_browser("facebook") as session:
            page = session.page
            context = session.context

            while True:
                batch_num += 1
                caps = _daily_caps_remaining()
                batch_result: dict = {"batch": batch_num, "caps_before": caps}

                if probe and batch_num > 1:
                    elapsed = time.monotonic() - session_start
                    if elapsed >= session_max:
                        if rest_taken:
                            batch_result["stopped"] = "session_time_limit_after_rest"
                            result["batches"].append(batch_result)
                            break
                        batch_result["resting"] = True
                        result["batches"].append(batch_result)
                        time.sleep(rest_seconds)
                        session_start = time.monotonic()
                        rest_taken = True
                        batch_num = 0
                        continue
                    if not probe and all(caps[k] <= 0 for k in ("joins", "greetings", "comments", "dms")):
                        batch_result["stopped"] = "daily_caps_reached"
                        result["batches"].append(batch_result)
                        break

                if do_accept and not accept_done:
                    with track_step("accept_friends", f"通过好友请求 max={accept_max}", platform="facebook"):
                        result["accept"] = accept_friend_requests(
                            max_accept=accept_max,
                            page=page,
                            context=context,
                        )
                    batch_result["accept"] = result["accept"]
                    accept_done = True
                    if not result["accept"].get("ok") and result["accept"].get("error") == "not_logged_in":
                        result["ok"] = False
                        result["errors"].append("not_logged_in")
                        log_step_end("daily_run", "未登录，中止", platform="facebook", status="failed")
                        return result

                blocked = False
                batch_blocks: list[str] = []
                if do_groups and (probe or caps["joins"] > 0 or caps["greetings"] > 0):
                    jmax = join_max if join_max > 0 else (batches["join_batch"] if probe else min(batches["join_batch"], caps["joins"]))
                    gmax = greet_max if greet_max > 0 else (batches["greet_batch"] if probe else min(batches["greet_batch"], caps["greetings"]))
                    if probe:
                        jmax = int(jmax) if jmax else batches["join_batch"]
                        gmax = int(gmax) if gmax else batches["greet_batch"]
                    else:
                        jmax = min(int(jmax), caps["joins"]) if caps["joins"] < UNLIMITED else int(jmax)
                        gmax = min(int(gmax), caps["greetings"]) if caps["greetings"] < UNLIMITED else int(gmax)
                    if jmax > 0 or gmax > 0:
                        with track_step(
                            "group_actions",
                            f"小组 入组≤{jmax} 问候≤{gmax} batch={batch_num}",
                            platform="facebook",
                        ):
                            grp_out = run_daily_group_actions(
                                max_joins=jmax,
                                max_greetings=gmax,
                                search_first=(batch_num == 1),
                                page=page,
                                context=context,
                            )
                        if result["groups"] is None:
                            result["groups"] = {"ok": True, "search": grp_out.get("search"), "joins": [], "greetings": [], "errors": []}
                        result["groups"]["joins"].extend(grp_out.get("joins") or [])
                        result["groups"]["greetings"].extend(grp_out.get("greetings") or [])
                        if grp_out.get("search") and batch_num == 1:
                            result["groups"]["search"] = grp_out["search"]
                        if grp_out.get("errors"):
                            result["groups"]["errors"].extend(grp_out["errors"])
                            result["errors"].extend(grp_out["errors"])
                            if "rate_limited" in grp_out["errors"]:
                                batch_blocks.append("group_join")
                        batch_result["groups"] = grp_out
                        joins_n = len(grp_out.get("joins") or [])
                        greets_n = len(grp_out.get("greetings") or [])
                        from customer_gateway.zijing_activity_stream import log_result

                        log_result(
                            "group_actions",
                            f"batch={batch_num} · 入组 +{joins_n} · 问候 +{greets_n}",
                            platform="facebook",
                            mode="normal" if not probe else "probe",
                            counts={"joins": joins_n, "greetings": greets_n},
                        )

                if do_comments and (probe or caps["comments"] > 0):
                    cmax = comment_max if comment_max > 0 else (batches["comment_batch"] if probe else min(batches["comment_batch"], caps["comments"]))
                    if not probe:
                        cmax = min(int(cmax), caps["comments"]) if caps["comments"] < UNLIMITED else int(cmax)
                    if cmax > 0:
                        with track_step("group_comments", f"小组评论 max={cmax} batch={batch_num}", platform="facebook"):
                            c_out = _run_group_comments(max_comments=int(cmax))
                        if result["comments"] is None:
                            result["comments"] = {"ok": True, "items": [], "errors": []}
                        result["comments"]["items"].extend(c_out.get("comments") or [])
                        if c_out.get("errors"):
                            result["comments"]["errors"].extend(c_out["errors"])
                            result["errors"].extend(c_out["errors"])
                            if "rate_limited" in c_out["errors"]:
                                batch_blocks.append("group_comment")
                        batch_result["comments"] = c_out

                if do_browse and not browse_done and batch_num == 1:
                    with track_step("browse_feed", f"浏览动态 max_posts={max_posts}", platform="facebook"):
                        result["browse"] = browse_friends_feed(
                            max_posts=max_posts,
                            deep=False,
                            page=page,
                            context=context,
                        )
                    batch_result["browse"] = result["browse"]
                    browse_done = True
                    if not result["browse"].get("ok"):
                        result["errors"].append(result["browse"].get("error") or "browse_failed")

                if do_dm and (probe or caps["dms"] > 0):
                    dmax = dm_max if dm_max > 0 else (batches["dm_batch"] if probe else min(batches["dm_batch"], caps["dms"]))
                    if not probe:
                        dmax = min(int(dmax), caps["dms"]) if caps["dms"] < UNLIMITED else int(dmax)
                    if dmax > 0:
                        with track_step("friend_dm", f"好友私信 max={dmax} batch={batch_num}", platform="facebook"):
                            dm_out = send_friend_dms(
                                max_send=dmax,
                                dry_run=False,
                                page=page,
                                context=context,
                            )
                        if result["dm"] is None:
                            result["dm"] = dm_out
                        else:
                            result["dm"]["sent"] = int(result["dm"].get("sent") or 0) + int(dm_out.get("sent") or 0)
                            result["dm"]["failed"] = int(result["dm"].get("failed") or 0) + int(dm_out.get("failed") or 0)
                            result["dm"]["sent_today"] = dm_out.get("sent_today")
                        if dm_out.get("blocked"):
                            result["errors"].append("dm_blocked")
                            batch_blocks.append("dm")
                        batch_result["dm"] = dm_out
                        from customer_gateway.zijing_activity_stream import log_result

                        log_result(
                            "friend_dm",
                            f"batch={batch_num} · sent={int(dm_out.get('sent') or 0)} failed={int(dm_out.get('failed') or 0)}",
                            platform="facebook",
                            counts={
                                "sent": int(dm_out.get("sent") or 0),
                                "dms_sent": int(dm_out.get("sent") or 0),
                            },
                            status="failed" if dm_out.get("blocked") else "completed",
                        )

                if do_post and batch_num == 1:
                    allowed, reason = _timeline_quota_left()
                    if not allowed:
                        log_step_start("timeline_post", f"跳过时间线发帖: {reason}", platform="facebook")
                        log_step_end("timeline_post", "跳过", platform="facebook", status="completed", duration_ms=0)
                        result["post"] = {"ok": True, "skipped": True, "reason": reason}
                    else:
                        pending = _pending_facebook_post()
                        if pending:
                            with track_step("timeline_post", "时间线发帖（余量）", platform="facebook"):
                                result["post"] = {
                                    "queue_item": pending.get("post_id") or pending.get("queue_id"),
                                    **_run_timeline_post(page, context, pending),
                                }
                        else:
                            result["post"] = {"ok": True, "skipped": True, "reason": "no_pending_facebook_post"}

                result["batches"].append(batch_result)

                if batch_blocks and probe:
                    batch_result["stopped"] = "facebook_blocked"
                    batch_result["blocked_actions"] = batch_blocks
                    hard_blocked = True
                    break

                if blocked:
                    batch_result["stopped"] = "facebook_blocked"
                    hard_blocked = True
                    break

                if not probe:
                    break

                caps_after = _daily_caps_remaining()
                progress = (
                    len(batch_result.get("groups", {}).get("joins") or [])
                    + len(batch_result.get("groups", {}).get("greetings") or [])
                    + len(batch_result.get("comments", {}).get("comments") or batch_result.get("comments", {}).get("items") or [])
                    + int((batch_result.get("dm") or {}).get("sent") or 0)
                )
                if progress == 0 and batch_num > 2:
                    batch_result["stopped"] = "no_progress"
                    result["batches"].append(batch_result)
                    break

                if not probe and all(caps_after[k] <= 0 for k in ("joins", "greetings", "comments", "dms")):
                    batch_result["stopped"] = "daily_caps_reached"
                    break

                pause = random.uniform(30.0, 90.0)
                from customer_gateway.zijing_activity_stream import log_sleep

                log_sleep(
                    pause,
                    f"batch={batch_num} 完成 · 下一批 {batch_num + 1} · {int(pause)}s",
                    platform="facebook",
                    mode="probe" if probe else "normal",
                )
                time.sleep(pause)

    except SocialBrowserSessionBusy as exc:
        result["ok"] = False
        result["errors"].append(str(exc))
        result["lock_busy"] = exc.lock_info
        log_step_end("daily_run", f"浏览器锁占用: {exc}", platform="facebook", status="failed")
        if _retry:
            clear_stale_lock(force=True)
            retry = run_daily(
                do_accept=do_accept,
                do_groups=do_groups,
                do_browse=do_browse,
                do_dm=do_dm,
                do_post=do_post,
                do_comments=do_comments,
                accept_max=accept_max,
                max_posts=max_posts,
                dm_max=dm_max,
                join_max=join_max,
                greet_max=greet_max,
                comment_max=comment_max,
                aggressive=aggressive,
                until_block=until_block,
                _retry=False,
            )
            retry["recovered_after_stale_lock"] = True
            return retry

    # 非 probe 的 aggressive：主会话结束后单独跑评论（避免双浏览器抢锁）
    if aggressive and not probe and do_comments and not any(
        e in result.get("errors", []) for e in ("rate_limited", "dm_blocked")
    ):
        caps = _daily_caps_remaining()
        if caps["comments"] > 0:
            cmax = comment_max if comment_max > 0 else min(batches["comment_batch"], caps["comments"])
            if cmax > 0:
                from customer_gateway.zijing_activity_stream import track_step

                with track_step("group_comments", f"小组评论 max={cmax} post-session", platform="facebook"):
                    c_out = _run_group_comments(max_comments=cmax)
                if result["comments"] is None:
                    result["comments"] = {"ok": True, "items": [], "errors": []}
                result["comments"]["items"].extend(c_out.get("comments") or [])
                if c_out.get("errors"):
                    result["comments"]["errors"].extend(c_out["errors"])
                    result["errors"].extend(c_out["errors"])

    result["lock_after"] = lock_status()
    result["caps_remaining"] = _daily_caps_remaining()
    result["batches_run"] = batch_num
    partial_ok = any(
        (result.get(k) or {}).get("ok") or (result.get(k) or {}).get("sent", 0) > 0
        for k in ("accept", "groups", "browse", "dm", "post", "comments")
        if result.get(k)
    ) or len(result.get("batches") or []) > 0
    if result["errors"] and not partial_ok:
        result["ok"] = False

    status = "completed" if result.get("ok") else "failed"
    log_step_end("daily_run", f"完成 batches={batch_num} errors={len(result['errors'])}", platform="facebook", status=status)

    return result


def main() -> int:
    # CEO 看板需要实时输出
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(line_buffering=True)
        except Exception:
            pass
    args = build_parser().parse_args()

    if args.clear_lock:
        from integrations.social_browser.session_manager import clear_stale_lock

        cleared = clear_stale_lock(force=True)
        print(json.dumps({"cleared": cleared}, ensure_ascii=False))
        if not args.all and not any((args.accept, args.groups, args.browse, args.dm, args.post)):
            return 0

    os.environ.setdefault("APSALES_SOCIAL_BROWSER_HEADLESS", "0")

    from customer_gateway.fb_platform_limits import get_operating_mode, is_platform_limited
    from customer_gateway.zijing_routing import run_maps_email_mode

    mode_info = get_operating_mode()
    limited, limit_reason = is_platform_limited()

    # 限流模式：跳过 FB 动作，直接 Maps+邮件
    if limited:
        maps_out = run_maps_email_mode(source="facebook_daily", max_countries=3)
        result = {
            "ok": True,
            "mode": "limited",
            "skipped_fb": True,
            "reason": limit_reason,
            "operating_mode": mode_info,
            **maps_out,
        }
        if args.json:
            print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
        else:
            print(f"=== 限流模式 · Maps+邮件（跳过 Facebook）===")
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

    do_all = args.all or not any((args.accept, args.groups, args.browse, args.dm, args.post))
    do_accept = args.accept or do_all
    do_groups = args.groups or do_all
    do_browse = args.browse or do_all
    do_dm = args.dm or do_all
    until_block = args.until_block or args.aggressive or _probe_mode()
    do_post = args.post and not until_block
    do_comments = do_groups and (until_block or args.aggressive or do_all)

    result = run_daily(
        do_accept=do_accept,
        do_groups=do_groups,
        do_browse=do_browse,
        do_dm=do_dm,
        do_post=do_post,
        do_comments=do_comments,
        accept_max=args.accept_max,
        max_posts=args.max_posts,
        dm_max=args.dm_max,
        join_max=args.join_max,
        greet_max=args.greet_max,
        comment_max=args.comment_max,
        aggressive=args.aggressive or until_block,
        until_block=until_block,
    )
    result["mode"] = "normal"
    result["operating_mode"] = mode_info

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        acc = result.get("accept") or {}
        grp = result.get("groups") or {}
        cm = result.get("comments") or {}
        br = result.get("browse") or {}
        dm = result.get("dm") or {}
        post = result.get("post") or {}
        caps = result.get("caps_remaining") or {}
        mode = "平台上限探测" if result.get("until_block") or result.get("probe_mode") else ("AGGRESSIVE" if result.get("aggressive") else "标准")
        print(f"=== Facebook 每日一体运行 · gooddlong · {mode} · 小组引流优先 ===")
        if acc:
            mark = "✅" if acc.get("ok") else "❌"
            print(f"{mark} 好友请求: 通过 {acc.get('accepted', 0)} 个")
        if grp:
            search = grp.get("search") or {}
            joins = grp.get("joins") or []
            greetings = grp.get("greetings") or []
            print(
                f"{'✅' if grp.get('ok') else '—'} 小组: 搜索 {search.get('found', 0)} 个 · "
                f"入组 {len(joins)} · 问候 {len(greetings)}"
            )
        if cm and cm.get("items"):
            ok_n = sum(1 for c in cm["items"] if c.get("ok"))
            print(f"{'✅' if ok_n else '—'} 小组评论: {ok_n}/{len(cm['items'])}")
        if br:
            mark = "✅" if br.get("ok") else "❌"
            print(
                f"{mark} 动态浏览: 扫描 {br.get('posts_scanned', 0)} 帖 · "
                f"情报 {br.get('intel_saved', 0)} 条 · 发动机线索 {br.get('engine_leads', 0)} 条"
            )
        if dm:
            print(
                f"{'✅' if dm.get('sent', 0) else '—'} 私信: 发送 {dm.get('sent', 0)} 人 · "
                f"失败 {dm.get('failed', 0)} · 今日累计 {dm.get('sent_today', 0)}"
            )
        if post:
            if post.get("skipped"):
                print(f"— 时间线发帖: 跳过 ({post.get('reason', '—')})")
            elif post.get("ok"):
                print(f"✅ 时间线发帖: {post.get('post_url') or '已发'}")
            elif post:
                print(f"❌ 时间线发帖: {post.get('error') or 'failed'}")
        if caps and not result.get("probe_mode"):
            print(
                f"📊 今日余量: 入组 {caps.get('joins', '?')} · "
                f"问候 {caps.get('greetings', '?')} · 评论 {caps.get('comments', '?')} · "
                f"私信 {caps.get('dms', '?')}"
            )
        elif result.get("probe_mode"):
            print("📊 模式: 平台上限探测 — 无自我日上限，仅 FB block 时暂停该动作")
        if result.get("batches_run", 1) > 1:
            print(f"🔄 批次: {result['batches_run']} 轮")
        if result.get("errors"):
            print(f"⚠️  {', '.join(result['errors'])}")

    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())

"""CEO routing: platform limited → Africa Maps + email drafts; normal → FB + X social."""

from __future__ import annotations

from typing import Any

from customer_gateway.fb_platform_limits import get_operating_mode
from customer_gateway.zijing_activity_stream import log_step_end, log_step_start


def run_maps_email_mode(
    *,
    source: str = "routing",
    max_countries: int = 3,
    force: bool = True,
) -> dict[str, Any]:
    """Limited mode: Africa Maps scrape + email drafts (CEO approval only)."""
    mode_info = get_operating_mode()
    pauses = ",".join(sorted((mode_info.get("active_pauses") or {}).keys())) or "—"
    detail = (
        f"限流备用 · {mode_info.get('reason') or 'platform_block'} · "
        f"来源:{source} · 暂停:{pauses}"
    )
    log_step_start("maps_fallback", detail, platform="maps")

    africa_result: dict[str, Any] | None = None
    maps_result: dict[str, Any] | None = None
    error: str | None = None

    try:
        from customer_gateway.africa_maps_prospect import run_africa_maps_batch

        africa_result = run_africa_maps_batch(force=force, max_countries=max_countries)
    except Exception as exc:
        error = str(exc)[:200]

    if not africa_result or africa_result.get("skipped"):
        try:
            from customer_gateway.maps_prospect import run_maps_prospect_batch

            maps_result = run_maps_prospect_batch(force=True)
        except Exception as exc:
            error = error or str(exc)[:200]

    end_parts: list[str] = []
    if africa_result and not africa_result.get("skipped"):
        end_parts.append(
            f"非洲 +{africa_result.get('new_leads', 0)} 线索 · "
            f"+{africa_result.get('new_drafts', 0)} 草稿"
        )
    if maps_result and not maps_result.get("skipped"):
        end_parts.append(
            f"Maps +{maps_result.get('new_leads', 0)} 线索 · "
            f"+{maps_result.get('new_drafts', 0)} 草稿"
        )
    if not end_parts:
        skip_reason = (africa_result or {}).get("reason") or (maps_result or {}).get("reason") or error or "无产出"
        end_parts.append(f"跳过: {skip_reason}")

    log_step_end("maps_fallback", " · ".join(end_parts), platform="maps", status="completed")

    return {
        "ok": True,
        "mode": "limited",
        "mode_label": mode_info.get("mode_label") or "限流 · Maps+邮件",
        "source": source,
        "africa_maps": africa_result,
        "maps_fallback": maps_result,
        "error": error,
    }


def run_social_normal_mode(*, pairs: int = 1, aggressive: bool = True) -> dict[str, Any]:
    """Normal mode: FB↔X alternate when both logged in; else Facebook daily aggressive."""
    from customer_gateway.social_session import get_all_session_status

    sessions = get_all_session_status()
    platforms = sessions.get("platforms") or {}
    fb_ok = bool((platforms.get("facebook") or {}).get("logged_in"))
    x_ok = bool((platforms.get("x") or {}).get("logged_in"))

    log_step_start(
        "zijing_run",
        f"正常模式 · FB+X 社媒 · FB={'✅' if fb_ok else '❌'} X={'✅' if x_ok else '❌'}",
        platform="fb+x",
    )

    result: dict[str, Any] = {
        "ok": False,
        "mode": "normal",
        "mode_label": "正常 · FB+X",
        "facebook_logged_in": fb_ok,
        "x_logged_in": x_ok,
    }

    if not fb_ok:
        result["error"] = "needs_login"
        log_step_end("zijing_run", "Facebook 未登录", platform="fb+x", status="failed")
        return result

    try:
        if fb_ok and x_ok:
            from customer_gateway.social_engagement_engine import execute_alternate_cycle

            alt = execute_alternate_cycle(max_pairs=max(1, pairs))
            result["alternate"] = alt
            result["path"] = "alternate"
            result["ok"] = bool(alt.get("executed", 0)) or not alt.get("stopped_reason")
        else:
            # Import run_daily from facebook daily script (same repo, no circular deps)
            import importlib.util
            from pathlib import Path

            fb_script = Path(__file__).resolve().parent.parent / "scripts" / "apsales-facebook-daily-run.py"
            spec = importlib.util.spec_from_file_location("apsales_facebook_daily_run", fb_script)
            if spec is None or spec.loader is None:
                raise ImportError("cannot load apsales-facebook-daily-run.py")
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            fb_out = mod.run_daily(
                do_accept=True,
                do_groups=True,
                do_browse=True,
                do_dm=True,
                do_post=False,
                do_comments=True,
                accept_max=10,
                max_posts=50,
                dm_max=0,
                join_max=0,
                greet_max=0,
                comment_max=0,
                aggressive=aggressive,
                until_block=aggressive,
            )
            result["facebook_daily"] = fb_out
            result["path"] = "facebook_daily"
            result["ok"] = bool(fb_out.get("ok"))
    except Exception as exc:
        result["error"] = str(exc)[:200]
        log_step_end("zijing_run", f"失败: {exc}", platform="fb+x", status="failed")
        return result

    executed = 0
    if result.get("path") == "alternate":
        executed = int((result.get("alternate") or {}).get("executed") or 0)
    log_step_end(
        "zijing_run",
        f"{result.get('path', '—')} · 完成 {executed or '—'} 步",
        platform="fb+x",
        status="completed" if result.get("ok") else "failed",
    )
    return result


def route_and_run(*, pairs: int = 1, aggressive: bool = True, max_countries: int = 3) -> dict[str, Any]:
    """Pick mode from fb_platform_limits.json and run the matching pipeline."""
    mode_info = get_operating_mode()
    if mode_info.get("mode") == "limited":
        out = run_maps_email_mode(source="zijing_run", max_countries=max_countries)
        out["operating_mode"] = mode_info
        return out
    out = run_social_normal_mode(pairs=pairs, aggressive=aggressive)
    out["operating_mode"] = mode_info
    return out

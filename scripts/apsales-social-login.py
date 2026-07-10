#!/Users/longhui/Desktop/AsiaPower/.venv/bin/python3
"""One-time social login capture for 子敬 — saves browser session to memory/.

Run with project venv (required for dotenv/playwright):
  .venv/bin/python3 scripts/apsales-social-login.py --platform facebook
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except ModuleNotFoundError:
    _venv_py = ROOT / ".venv" / "bin" / "python3"
    print(
        "❌ 缺少 python-dotenv。请用项目虚拟环境运行：\n"
        f"   {_venv_py} scripts/apsales-social-login.py ...",
        file=sys.stderr,
    )
    raise SystemExit(1) from None


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="子敬 · 社媒一次性登录（保存 Cookie/Session）")
    p.add_argument(
        "--platform",
        choices=["facebook", "instagram", "x"],
        help="facebook | instagram | x",
    )
    p.add_argument("--verify-only", action="store_true", help="Only verify existing session")
    p.add_argument("--status", action="store_true", help="Show all platform session status")
    p.add_argument("--wait-seconds", type=int, default=300, help="Auto-wait if non-interactive")
    p.add_argument("--export", default="", help="Export session tarball path (for local → prod upload)")
    p.add_argument(
        "--setup-meta-ig",
        action="store_true",
        help="Discover META_IG_USER_ID via Graph API (no IG browser login; needs Page token)",
    )
    return p


def main() -> int:
    args = build_parser().parse_args()

    from customer_gateway.social_session import (
        export_session_bundle,
        get_all_session_status,
        is_logged_in,
        session_status,
    )

    if args.status:
        import json
        print(json.dumps(get_all_session_status(), ensure_ascii=False, indent=2))
        return 0

    if args.setup_meta_ig:
        import subprocess
        cmd = [sys.executable, str(ROOT / "scripts" / "apsales-meta-ig-setup.py"), "--write-env"]
        return subprocess.call(cmd)

    if not args.platform:
        build_parser().error("--platform is required unless using --status or --setup-meta-ig")

    platform = args.platform
    if args.verify_only:
        from customer_gateway.social_session import api_ready, mark_connected
        if platform == "instagram" and api_ready("instagram"):
            print("instagram: ✅ 已登录（api）")
            return 0
        from integrations.social_browser.platform_adapter import verify_login
        ok = verify_login(platform)
        if ok:
            mark_connected(platform, method="browser")
            print(f"{platform}: ✅ 已登录")
        else:
            print(f"{platform}: ❌ 未登录或已过期")
        return 0 if ok else 1

    if is_logged_in(platform):
        st = session_status(platform)
        print(f"✅ {platform} 已有有效会话（{st.get('method')}）— 无需重复登录")
        print(f"   账号: {st.get('account_label') or '—'}")
        if args.export:
            path = export_session_bundle(platform, Path(args.export))
            print(f"📦 已导出: {path}")
            print("   上传到生产: scp 到 /root/.openclaw/workspace/AsiaPower/memory/customer_gateway/social_sessions/")
        return 0

    from integrations.social_browser.platform_adapter import open_login_page

    print(f"\n=== 子敬 · {platform} 一次性登录 ===")
    print("1. 将打开浏览器窗口")
    print("2. 用公司账号登录（含 2FA）")
    print("3. 登录完成后回到终端按 Enter\n")

    result = open_login_page(platform, wait_seconds=args.wait_seconds)
    if result.get("already_logged_in"):
        print(f"\n✅ {platform} 浏览器里已有有效登录，无需再登")
    if result.get("logged_in"):
        print(f"\n✅ {platform} 登录成功，会话已保存到 memory/customer_gateway/social_sessions/{platform}/")
        if args.export:
            path = export_session_bundle(platform, Path(args.export))
            print(f"📦 已导出: {path}")
            print("   上传到生产: scp 到 /root/.openclaw/workspace/AsiaPower/memory/customer_gateway/social_sessions/")
        print("\n下一步（生产服务器）:")
        print("  APSALES_SOCIAL_AUTOPILOT=1 python3 scripts/apsales-social-autopilot.py --publish")
        return 0

    print(f"\n❌ {platform} 登录未检测到 — 请重试（建议本地有界面电脑运行，非 headless 服务器）")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

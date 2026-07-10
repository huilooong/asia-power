#!/Users/longhui/Desktop/AsiaPower/.venv/bin/python3
"""Discover Instagram Business account ID via Meta Graph API (no IG browser login).

Use when Facebook Page + Page Access Token are already configured.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except ModuleNotFoundError:
    print("❌ 请用项目虚拟环境运行: .venv/bin/python3 scripts/apsales-meta-ig-setup.py", file=sys.stderr)
    raise SystemExit(1) from None


def _graph_get(path: str, token: str, fields: str = "") -> dict:
    base = os.getenv("META_GRAPH_API_BASE", "https://graph.facebook.com/v21.0").rstrip("/")
    params = {"access_token": token}
    if fields:
        params["fields"] = fields
    url = f"{base}/{path.lstrip('/')}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Graph API HTTP {exc.code}: {detail}") from exc


def discover_ig_user_id(*, page_id: str, token: str) -> dict:
    """Return IG business account linked to the Facebook Page."""
    page = _graph_get(page_id, token, fields="name,instagram_business_account{id,username}")
    ig = page.get("instagram_business_account") or {}
    ig_id = str(ig.get("id") or "").strip()
    username = str(ig.get("username") or "").strip()
    if not ig_id:
        raise RuntimeError(
            "该 Facebook Page 未绑定 Instagram 商业账号。\n"
            "请先在 Meta Business Suite 把 IG 转成商业号并绑定到此 Page。"
        )
    return {
        "page_id": page_id,
        "page_name": page.get("name") or "",
        "ig_user_id": ig_id,
        "ig_username": username,
    }


def write_env_var(key: str, value: str) -> None:
    env_path = ROOT / ".env"
    env_path.touch()
    lines = env_path.read_text(encoding="utf-8").splitlines() if env_path.is_file() else []
    pattern = re.compile(rf"^{re.escape(key)}=")
    lines = [ln for ln in lines if not pattern.match(ln)]
    lines.append(f"{key}={value}")
    env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def verify_instagram_api() -> bool:
    from customer_gateway.social_session import session_status

    st = session_status("instagram")
    return bool(st.get("logged_in") and st.get("api_configured"))


def main() -> int:
    p = argparse.ArgumentParser(description="Meta Graph API · 自动查 Instagram User ID（无需浏览器登录 IG）")
    p.add_argument("--page-id", default="", help="Facebook Page ID（默认读 .env META_PAGE_ID）")
    p.add_argument("--token", default="", help="Page Access Token（默认读 .env META_PAGE_ACCESS_TOKEN）")
    p.add_argument("--write-env", action="store_true", help="把 META_IG_USER_ID 写入本地 .env")
    p.add_argument("--verify-only", action="store_true", help="仅验证 .env 中 IG API 是否就绪")
    args = p.parse_args()

    if args.verify_only:
        ok = verify_instagram_api()
        print("instagram API: " + ("✅ 已就绪" if ok else "❌ 未配置 META_PAGE_ACCESS_TOKEN + META_IG_USER_ID"))
        return 0 if ok else 1

    page_id = (args.page_id or os.getenv("META_PAGE_ID", "")).strip()
    token = (args.token or os.getenv("META_PAGE_ACCESS_TOKEN", "")).strip()

    if not page_id or not token:
        print("❌ 需要 META_PAGE_ID 和 META_PAGE_ACCESS_TOKEN")
        print("")
        print("CEO 已有 Facebook 浏览器登录时，按下面拿 Token（约 5 分钟）：")
        print("  1. 打开 https://developers.facebook.com/tools/explorer/")
        print("  2. 选你的 App → User or Page → 选 AsiaPower Page")
        print("  3. 勾选权限: pages_show_list, pages_read_engagement,")
        print("     instagram_basic, instagram_content_publish, pages_manage_posts")
        print("  4. Generate Access Token → 复制 EAA... 开头的一串")
        print("  5. Page ID → Page 设置 → 关于 → Page ID")
        print("")
        print("然后运行：")
        print("  .venv/bin/python3 scripts/apsales-meta-ig-setup.py \\")
        print("    --page-id 你的PageID --token EAA你的Token --write-env")
        return 1

    try:
        info = discover_ig_user_id(page_id=page_id, token=token)
    except RuntimeError as exc:
        print(f"❌ {exc}")
        return 1

    print("✅ 已找到绑定的 Instagram 商业账号")
    print(f"   Page: {info['page_name']} ({info['page_id']})")
    print(f"   IG User ID: {info['ig_user_id']}")
    if info["ig_username"]:
        print(f"   IG 用户名: @{info['ig_username']}")

    if args.write_env:
        write_env_var("META_PAGE_ID", page_id)
        write_env_var("META_PAGE_ACCESS_TOKEN", token)
        write_env_var("META_IG_USER_ID", info["ig_user_id"])
        if not os.getenv("META_GRAPH_API_BASE"):
            write_env_var("META_GRAPH_API_BASE", "https://graph.facebook.com/v21.0")
        print("")
        print("✅ 已写入 .env（META_PAGE_ID, META_PAGE_ACCESS_TOKEN, META_IG_USER_ID）")
        print("验证：")
        print("  .venv/bin/python3 scripts/apsales-meta-ig-setup.py --verify-only")
        print("  .venv/bin/python3 scripts/apsales-social-login.py --status")
    else:
        print("")
        print("写入 .env：")
        print(f"  .venv/bin/python3 scripts/apsales-meta-ig-setup.py --write-env")
        print("（或手动把 META_IG_USER_ID 加到 .env）")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

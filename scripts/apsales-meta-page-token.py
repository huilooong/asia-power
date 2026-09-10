"""Install a Facebook Page token so agents post via Graph API (no Google browser login).

CEO generates a token on the phone (already logged into Facebook / Business Suite),
then an agent runs this script. Never commit the token.
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
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except ModuleNotFoundError:
    print("❌ 请用项目虚拟环境运行: .venv/bin/python3 scripts/apsales-meta-page-token.py", file=sys.stderr)
    raise SystemExit(1) from None

from customer_gateway.meta_page_token import (
    DEFAULT_PAGE_ID,
    pick_page,
    token_preview,
)


def graph_base() -> str:
    return os.getenv("META_GRAPH_API_BASE", "https://graph.facebook.com/v21.0").rstrip("/")


def _graph_get(path: str, token: str, params: dict[str, str] | None = None) -> dict[str, Any]:
    query = {"access_token": token, **(params or {})}
    url = f"{graph_base()}/{path.lstrip('/')}?{urllib.parse.urlencode(query)}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Graph API HTTP {exc.code}: {detail}") from exc


def resolve_page_token(*, user_or_page_token: str, page_id: str = "") -> dict[str, str]:
    token = (user_or_page_token or "").strip()
    if not token:
        raise RuntimeError("缺少 token")

    target_id = (page_id or os.getenv("META_PAGE_ID") or DEFAULT_PAGE_ID).strip()

    try:
        page = _graph_get(target_id, token, {"fields": "id,name"})
        if page.get("id"):
            return {
                "page_id": str(page.get("id")),
                "page_name": str(page.get("name") or ""),
                "page_token": token,
                "source": "direct_page_token",
            }
    except RuntimeError:
        pass

    payload = _graph_get("me/accounts", token, {"fields": "id,name,access_token,tasks"})
    accounts = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(accounts, list) or not accounts:
        raise RuntimeError(
            "这个 token 既打不开 Page，也列不出 /me/accounts。"
            "请在 Graph API Explorer 选 User token，勾选 pages_show_list 和 pages_manage_posts，"
            "或直接选 AsiaPower Page 再 Generate Access Token。"
        )
    row = pick_page(accounts, page_id=target_id)
    page_token = str(row.get("access_token") or "").strip()
    if not page_token:
        raise RuntimeError("Page 行没有 access_token，请给 token 增加 pages_show_list / pages_manage_posts")
    return {
        "page_id": str(row.get("id") or ""),
        "page_name": str(row.get("name") or ""),
        "page_token": page_token,
        "source": "user_accounts",
    }


def write_env_var(key: str, value: str) -> None:
    env_path = ROOT / ".env"
    env_path.touch()
    lines = env_path.read_text(encoding="utf-8").splitlines() if env_path.is_file() else []
    pattern = re.compile(rf"^{re.escape(key)}=")
    lines = [ln for ln in lines if not pattern.match(ln)]
    lines.append(f"{key}={value}")
    env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def verify_page_token(page_id: str, token: str) -> dict[str, Any]:
    return _graph_get(page_id, token, {"fields": "id,name"})


def main() -> int:
    p = argparse.ArgumentParser(description="把 Facebook Page token 装进 .env，供后续 Agent 发帖（不走 Google 浏览器验证）")
    p.add_argument("--token", default="", help="Graph Explorer 复制的 User 或 Page token")
    p.add_argument("--page-id", default="", help=f"Facebook Page ID（默认 {DEFAULT_PAGE_ID}）")
    p.add_argument("--write-env", action="store_true", help="写入本地 .env")
    p.add_argument("--verify-only", action="store_true", help="只验证现有 .env")
    args = p.parse_args()

    if args.verify_only:
        page_id = (os.getenv("META_PAGE_ID") or "").strip()
        token = (os.getenv("META_PAGE_ACCESS_TOKEN") or "").strip()
        if not page_id or not token:
            print("❌ META_PAGE_ID / META_PAGE_ACCESS_TOKEN 未配置")
            return 1
        try:
            info = verify_page_token(page_id, token)
        except RuntimeError as exc:
            print(f"❌ {exc}")
            return 1
        print(f"✅ Graph API 可用 · Page {info.get('name')} ({info.get('id')})")
        print(f"   token {token_preview(token)}")
        return 0

    token = (args.token or os.getenv("META_PAGE_ACCESS_TOKEN") or "").strip()
    if not token:
        print("❌ 需要 --token（从手机 Graph API Explorer 复制，不要发到公开群）")
        print("步骤见 docs/ops/ops-meta-agent-graph-api.md")
        return 1

    try:
        resolved = resolve_page_token(user_or_page_token=token, page_id=args.page_id)
        check = verify_page_token(resolved["page_id"], resolved["page_token"])
    except RuntimeError as exc:
        print(f"❌ {exc}")
        return 1

    print("✅ Page token 有效")
    print(f"   Page: {check.get('name')} ({check.get('id')})")
    print(f"   来源: {resolved['source']}")
    print(f"   token: {token_preview(resolved['page_token'])}")

    if args.write_env:
        write_env_var("META_PAGE_ID", resolved["page_id"])
        write_env_var("META_PAGE_ACCESS_TOKEN", resolved["page_token"])
        if not os.getenv("META_GRAPH_API_BASE"):
            write_env_var("META_GRAPH_API_BASE", graph_base())
        print("✅ 已写入 .env（未打印完整 token）")
        print("验证: .venv/bin/python3 scripts/apsales-meta-page-token.py --verify-only")
    else:
        print("写入 .env 请加 --write-env")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

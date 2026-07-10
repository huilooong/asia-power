#!/usr/bin/env python3
"""Verify WeCom credentials without sending customer messages."""

from __future__ import annotations

import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from integrations.wecom_client import verify_credentials
from integrations.wecom_config import load_wecom_config, public_callback_url


def main() -> int:
    load_dotenv(ROOT / ".env")
    cfg = load_wecom_config()

    print("AsiaPower WeCom · AsiaPower 库存 Agent — 配置检查（内部昵称：子敬）\n")
    rows = [
        ("WECOM_CORP_ID", cfg.corp_id or "❌ 未填"),
        ("WECOM_AGENT_ID", cfg.agent_id or "❌ 未填"),
        ("WECOM_AGENT_SECRET", "✅ 已填" if cfg.secret else "❌ 未填"),
        ("WECOM_CALLBACK_TOKEN", "✅ 已填" if cfg.token else "❌ 未填"),
        ("WECOM_ENCODING_AES_KEY", "✅ 已填" if cfg.encoding_aes_key else "❌ 未填"),
        ("回调 URL", public_callback_url(cfg)),
        ("群白名单", ", ".join(cfg.allowed_chat_ids) or "（空=全部允许）"),
    ]
    for k, v in rows:
        print(f"  {k}: {v}")

    if not cfg.enabled:
        print("\n结果: ❌ 配置不完整，请按 data/knowledge-base/wecom-zijing-setup-runbook.md 填写 .env")
        return 1

    try:
        result = verify_credentials(cfg)
        print(f"\n结果: ✅ access_token 获取成功 ({result['access_token_prefix']})")
        print("下一步: 启动回调 python integrations/wecom_callback_server.py")
        return 0
    except Exception as exc:
        print(f"\n结果: ❌ API 验证失败 — {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

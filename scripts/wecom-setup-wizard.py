#!/usr/bin/env python3
"""Interactive WeCom AsiaPower 库存 Agent setup — merges WECOM_* keys into .env safely."""

from __future__ import annotations

import argparse
import getpass
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env"

WECOM_KEYS = [
    "WECOM_CORP_ID",
    "WECOM_AGENT_ID",
    "WECOM_AGENT_SECRET",
    "WECOM_CALLBACK_TOKEN",
    "WECOM_ENCODING_AES_KEY",
    "WECOM_PUBLIC_BASE_URL",
    "WECOM_CALLBACK_HOST",
    "WECOM_CALLBACK_PORT",
    "WECOM_CALLBACK_PATH",
    "WECOM_ALLOWED_CHAT_IDS",
    "WECOM_ALLOWED_USER_IDS",
    "WECOM_REQUIRE_AT_MENTION",
]

PROMPTS: dict[str, tuple[str, str, bool]] = {
    "WECOM_CORP_ID": ("企业 ID（CorpID）", "管理后台 → 我的企业 → 企业信息", False),
    "WECOM_AGENT_ID": ("应用 AgentId", "应用管理 → AsiaPower 库存 Agent → 详情页", False),
    "WECOM_AGENT_SECRET": ("应用 Secret", "同上，点「查看」复制（不会显示在屏幕上）", True),
    "WECOM_CALLBACK_TOKEN": ("回调 Token", "接收消息 → 自己编一串英文数字，与后台一致", False),
    "WECOM_ENCODING_AES_KEY": ("EncodingAESKey", "接收消息 → 点「随机生成」复制", False),
    "WECOM_PUBLIC_BASE_URL": (
        "公网 HTTPS 地址（可选）",
        "开发填 ngrok 地址，如 https://xxxx.ngrok-free.app；本地先测可留空",
        False,
    ),
}

DEFAULTS: dict[str, str] = {
    "WECOM_CALLBACK_HOST": "127.0.0.1",
    "WECOM_CALLBACK_PORT": "8791",
    "WECOM_CALLBACK_PATH": "/wecom/callback",
    "WECOM_ALLOWED_CHAT_IDS": "",
    "WECOM_ALLOWED_USER_IDS": "",
    "WECOM_REQUIRE_AT_MENTION": "1",
}

ASSIGNMENT_RE = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$")


def parse_env(text: str) -> tuple[list[str], dict[str, str]]:
    """Return (lines, key->value) preserving file order."""
    lines = text.splitlines()
    values: dict[str, str] = {}
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        m = ASSIGNMENT_RE.match(stripped)
        if m:
            values[m.group(1)] = m.group(2)
    return lines, values


def merge_env_lines(lines: list[str], updates: dict[str, str]) -> list[str]:
    """Update existing keys in place; append missing WECOM keys at end."""
    seen: set[str] = set()
    out: list[str] = []

    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith("#"):
            m = ASSIGNMENT_RE.match(stripped)
            if m:
                key = m.group(1)
                if key in updates:
                    out.append(f"{key}={updates[key]}")
                    seen.add(key)
                    continue
        out.append(line)

    missing = [k for k in updates if k not in seen]
    if missing:
        if out and out[-1].strip():
            out.append("")
        out.append("# 企业微信 · AsiaPower 库存 Agent（内部昵称：子敬；wecom-setup-wizard.py 写入）")
        for key in missing:
            out.append(f"{key}={updates[key]}")
    return out


def read_existing_values() -> dict[str, str]:
    if not ENV_PATH.exists():
        return {}
    _, values = parse_env(ENV_PATH.read_text(encoding="utf-8"))
    return values


def prompt_value(key: str, existing: str, dry_run: bool) -> str:
    label, hint, secret = PROMPTS[key]
    current = f"（当前已填，回车保留）" if existing else ""
    print(f"\n{label}  →  .env 的 {key}")
    print(f"  提示：{hint} {current}")

    if dry_run:
        sample = existing or f"<dry-run-{key}>"
        print(f"  [dry-run] 将写入: {'***' if secret else sample}")
        return existing or sample

    if secret:
        raw = getpass.getpass("  请粘贴（输入不可见）: ").strip()
    else:
        raw = input("  请粘贴（回车跳过）: ").strip()

    if not raw and existing:
        return existing
    return raw


def collect_updates(existing: dict[str, str], dry_run: bool) -> dict[str, str]:
    updates: dict[str, str] = {}

    print("\n" + "=" * 60)
    print("AsiaPower 企业微信 · AsiaPower 库存 Agent 配置向导")
    print("（内部昵称：子敬）")
    print("只更新 WECOM_* 项，不会动 .env 里其他密钥。")
    if dry_run:
        print("【dry-run 模式】不会写入文件。")
    print("=" * 60)

    for key in PROMPTS:
        val = prompt_value(key, existing.get(key, ""), dry_run)
        if val:
            updates[key] = val

    for key, default in DEFAULTS.items():
        if key not in updates:
            updates[key] = existing.get(key) or default

    return updates


def write_env(updates: dict[str, str], dry_run: bool) -> None:
    if ENV_PATH.exists():
        lines, _ = parse_env(ENV_PATH.read_text(encoding="utf-8"))
    else:
        lines = ["# AsiaPower local secrets — do not commit"]

    merged = merge_env_lines(lines, updates)
    text = "\n".join(merged) + "\n"

    if dry_run:
        print("\n--- dry-run：将写入以下 WECOM 项（不含 Secret 明文）---")
        for k, v in updates.items():
            if k == "WECOM_AGENT_SECRET" and v:
                print(f"  {k}=***")
            else:
                print(f"  {k}={v or '(空)'}")
        print(f"\n目标文件: {ENV_PATH}")
        return

    ENV_PATH.write_text(text, encoding="utf-8")
    print(f"\n✅ 已写入 {ENV_PATH}")
    print("下一步: .venv/bin/python3 scripts/wecom-verify-config.py")


def main() -> int:
    parser = argparse.ArgumentParser(description="WeCom AsiaPower 库存 Agent .env 配置向导（内部昵称：子敬）")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="只演示，不写入 .env",
    )
    args = parser.parse_args()

    existing = read_existing_values()
    updates = collect_updates(existing, args.dry_run)

    required = [
        "WECOM_CORP_ID",
        "WECOM_AGENT_ID",
        "WECOM_AGENT_SECRET",
        "WECOM_CALLBACK_TOKEN",
        "WECOM_ENCODING_AES_KEY",
    ]
    missing = [k for k in required if not updates.get(k, "").strip()]
    if missing and not args.dry_run:
        print("\n❌ 以下必填项为空，未写入 .env：")
        for k in missing:
            print(f"  - {k}")
        print("请重新运行向导，或手动补全后执行 wecom-verify-config.py")
        return 1

    write_env(updates, args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

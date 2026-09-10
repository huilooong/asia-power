"""Resolve Facebook Page tokens for agent Graph API posting."""

from __future__ import annotations

from typing import Any

DEFAULT_PAGE_ID = "61591139770494"
DEFAULT_PAGE_NAME = "AsiaPower"


def token_preview(token: str) -> str:
    raw = (token or "").strip()
    if len(raw) <= 10:
        return "(too short)"
    return f"{raw[:6]}…{raw[-4:]} (len={len(raw)})"


def pick_page(accounts: list[dict[str, Any]], *, page_id: str = "", page_name: str = "") -> dict[str, Any]:
    wanted_id = (page_id or "").strip()
    wanted_name = (page_name or DEFAULT_PAGE_NAME).strip().lower()
    if wanted_id:
        for row in accounts:
            if str(row.get("id") or "") == wanted_id:
                return row
    for row in accounts:
        name = str(row.get("name") or "").strip().lower()
        if name == wanted_name:
            return row
    if len(accounts) == 1:
        return accounts[0]
    raise RuntimeError(
        "未找到 AsiaPower Page。把 --page-id 设成 Graph /me/accounts 返回的 id。"
        f" 现有: {[(r.get('name'), r.get('id')) for r in accounts]}"
    )

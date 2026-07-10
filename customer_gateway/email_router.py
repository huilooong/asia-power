"""Route inbound email threads to 子敬 / 子龙 / CEO by mailbox."""

from __future__ import annotations

import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
MAILBOX_CFG = ROOT / "config" / "email_mailboxes.yaml"

_FALLBACK = {
    "inquiry": "apsales",
    "sales": "apsales",
    "supplier": "apinventory",
    "weylon": "ceo",
}

_OUTBOUND = {
    "apsales": "sales",
    "apinventory": "supplier",
    "ceo": "weylon",
}


def _load_cfg() -> dict:
    if not MAILBOX_CFG.is_file():
        return {"mailboxes": {}}
    return yaml.safe_load(MAILBOX_CFG.read_text(encoding="utf-8")) or {}


def local_part(address: str) -> str:
    raw = (address or "").strip().lower()
    m = re.search(r"([^@<\s]+)@", raw)
    return m.group(1) if m else raw.split("@")[0]


def resolve_route(to_address: str) -> dict:
    """Return agent id and metadata for an inbound To address."""
    local = local_part(to_address)
    cfg = _load_cfg()
    boxes = cfg.get("mailboxes") or {}
    full = f"{local}@{cfg.get('domain', 'asia-power.com')}"
    entry = boxes.get(full) or boxes.get(f"{local}@asia-power.com")
    if entry:
        outbound = entry.get("outbound_from") or _OUTBOUND.get(entry.get("agent", "apsales"), local)
        return {
            "mailbox": local,
            "agent": entry.get("agent", "apsales"),
            "label": entry.get("label", local),
            "forward_to": entry.get("forward_to"),
            "outbound_from": outbound,
        }
    agent = _FALLBACK.get(local, "apsales")
    labels = {
        "apsales": "销售询价",
        "apinventory": "供应商",
        "ceo": "CEO",
    }
    return {
        "mailbox": local,
        "agent": agent,
        "label": labels.get(agent, local),
        "forward_to": "weylonhui@gmail.com" if local == "weylon" else None,
        "outbound_from": _OUTBOUND.get(agent, "sales"),
    }


def outbound_mailbox_for_thread(thread: dict) -> str:
    """对外发信邮箱 local part — 销售一律 sales@."""
    agent = thread.get("routeAgent") or agent_for_thread(thread)
    if agent == "apsales":
        return "sales"
    if agent == "apinventory":
        return "supplier"
    return thread.get("mailbox") or "weylon"


def agent_for_thread(thread: dict) -> str:
    return thread.get("routeAgent") or resolve_route(
        (thread.get("messages") or [{}])[-1].get("to", "sales@asia-power.com")
    )["agent"]

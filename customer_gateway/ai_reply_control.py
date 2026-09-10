"""Explicit owner controls for the WhatsApp bridge; never send a customer message."""
from __future__ import annotations

import fcntl
import json
import os
import re
import tempfile
import time
import uuid
from pathlib import Path

HELP = (
    "AI 回复控制（号码须含国际区号）\n"
    "暂停AI +233XXXXXXXXX\n恢复AI +233XXXXXXXXX\n"
    "暂停全部AI\n恢复全部AI\nAI状态\n"
    "暂停持续到你明确恢复；恢复全部只解除总开关，单独暂停的客户仍需单独恢复。\n"
    "暂停不影响手机人工回复；已交给 WhatsApp 的消息无法撤回。"
    "你在 WhatsApp 手动发送文字、媒体或位置后，该客户会自动暂停。"
)


def parse_command(text: str):
    raw = (text or "").strip()
    if raw in {"AI状态", "ai状态", "/ai status", "/ai", "AI帮助"}:
        return "status", "all"
    if raw in {"暂停全部AI", "暂停全部ai", "/ai pause all"}:
        return "pause", "all"
    if raw in {"恢复全部AI", "恢复全部ai", "/ai resume all"}:
        return "resume", "all"
    match = re.fullmatch(r"(?:/ai\s+(pause|resume)|(?:(暂停|叫停|停止|恢复)\s*AI))\s+(\+[1-9][0-9]{7,14})", raw, re.I)
    if match:
        return ("resume" if (match[1] or match[2]).lower() in {"resume", "恢复"} else "pause"), match[3]
    if re.match(r"^(?:/ai\b|(?:暂停|叫停|停止|恢复).*AI|AI状态)", raw, re.I):
        return "help", "all"
    return None


def state_path(root: Path) -> Path:
    return root / "memory/customer_gateway/ai_reply_control.json"


def load_state(root: Path) -> dict:
    try:
        state = json.loads(state_path(root).read_text())
    except FileNotFoundError:
        return {"version": 1, "global": {}, "customers": {}}
    if not isinstance(state, dict) or state.get("version") != 1 or not isinstance(state.get("customers"), dict) or not isinstance(state.get("global"), dict):
        raise ValueError("invalid AI control state; refusing to reset it")
    for scope in [state["global"], *state["customers"].values()]:
        if not isinstance(scope, dict) or (scope and (not isinstance(scope.get("paused"), bool) or not isinstance(scope.get("revision"), str) or not isinstance(scope.get("updated_ms"), (int, float)))):
            raise ValueError("invalid AI control scope")
    return state


def change_state(root: Path, action: str, target: str, actor: str) -> dict:
    dest = state_path(root)
    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.with_suffix(".lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        state = load_state(root)
        if actor.startswith("whatsapp_human:") and any(e.get("actor") == actor for e in state.get("history", [])):
            return state
        event = {"paused": action == "pause", "revision": str(uuid.uuid4()), "updated_ms": int(time.time() * 1000), "actor": actor}
        if target == "all":
            state["global"] = event
        else:
            state["customers"][target] = event
        state.setdefault("history", []).append({**event, "action": action, "target": target})
        # Same atomic file contains both state and its audit history.
        fd, name = tempfile.mkstemp(prefix=".ai-control-", dir=dest.parent)
        try:
            with os.fdopen(fd, "w") as out:
                json.dump(state, out, ensure_ascii=False)
                out.flush()
                os.fsync(out.fileno())
            os.replace(name, dest)
            if target != "all":
                (root / "memory/customer_gateway/ai_takeover_failed" / target).unlink(missing_ok=True)
        finally:
            if os.path.exists(name):
                os.unlink(name)
        return state


def handle_command(text: str, *, user_id: str, chat_id: str, chat_type: str, allowed_users: set[str], root: Path | None = None) -> str | None:
    command = parse_command(text)
    if command is None:
        return None
    if chat_type != "private" or not allowed_users or str(user_id) not in allowed_users or str(chat_id) != str(user_id):
        return "无权更改 AI 回复：请使用已授权的管理账号私聊机器人。"
    root = root or Path(__file__).resolve().parents[1]
    action, target = command
    if action == "help":
        return HELP
    try:
        state = load_state(root) if action == "status" else change_state(root, action, target, str(user_id))
    except (OSError, ValueError, TypeError):
        return "AI 控制状态读取或保存失败，未确认操作成功。请检查服务状态；不要假定 AI 已暂停或恢复。"
    if action == "status":
        paused = [k for k, v in state["customers"].items() if v.get("paused")]
        return f"AI 总开关：{'暂停' if state['global'].get('paused') else '开启'}\n单独暂停客户：{', '.join(paused) or '无'}\n\n{HELP}"
    label = "全部客户" if target == "all" else target
    if action == "pause":
        return f"已保存暂停指令：{label}。停止桥接自动回复和自动跟进，继续收消息，直到你明确恢复。已提交 WhatsApp 的消息无法撤回。"
    suffix = "单独暂停的客户仍保持暂停。" if target == "all" else ("总开关仍暂停，该客户暂不能自动回复。" if state["global"].get("paused") else "")
    return f"已解除暂停：{label}。{suffix}旧回复不补发，只处理恢复后的新消息。"

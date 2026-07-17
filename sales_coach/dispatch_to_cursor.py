"""On CEO approval of agent_prompt_fix → write .claude/plans/coach-fix-*.md (no code changes)."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sales_coach.config import workspace_root

_PLANS_DIR_REL = Path(".claude/plans")


def plans_dir(root: Path | None = None) -> Path:
    return (root or workspace_root()) / _PLANS_DIR_REL


def slug_for_rule(rule_id: str, day: str | None = None) -> str:
    day = day or datetime.now(timezone.utc).strftime("%Y%m%d")
    safe = re.sub(r"[^a-z0-9_-]+", "-", (rule_id or "unknown").lower()).strip("-")[:60]
    return f"coach-fix-{safe or 'unknown'}-{day}"


def extract_rule_id_from_record(record: dict[str, Any]) -> str:
    text = str(record.get("request_text") or "")
    m = re.search(r"rule_id=([a-z0-9_-]+)", text, re.I)
    if m:
        return m.group(1)
    why = str(record.get("why") or "")
    m2 = re.search(r"发现\s+(\S+)\s+违规", why)
    if m2:
        return re.sub(r"[^a-z0-9_-]+", "-", m2.group(1).lower())[:60]
    return "unknown"


def render_coach_fix_plan(record: dict[str, Any]) -> str:
    approval_id = str(record.get("id") or "AP-unknown")
    rule_id = extract_rule_id_from_record(record)
    why = str(record.get("why") or "").strip()
    request_text = str(record.get("request_text") or "").strip()
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    return f"""# Coach 修复任务: {rule_id}

## 给 Cursor 的交付说明

**龙哥已通过审批网关批准本任务（编号 `{approval_id}`）。**

开始动手前,先在本文件最下面的「Cursor 实施报告」章节追加一行「已开始 <日期时间>」。做完把结果写进同一章节(追加,不覆盖)。

**重要**: Sales Coach 只发现了症状,多数情况下**还没确定根因**。先排查根因,不要假设;查清楚再改代码。不要把批准当成「直接套一个 diff」。

## Context

- 批准编号: `{approval_id}`
- 来源 agent: `{record.get("agent") or "sales_coach"}`
- 动作: `{record.get("action") or "agent_prompt_fix"}`
- 原因摘要: {why or "(无)"}
- Coach 证据包: {request_text or "(无)"}
- 日期: {day}

这是「发现了症状,还没确定根因」类任务(除非证据里已经写明已知模式,例如再次号码泄漏)。排查优先看:
- `deploy/apsales-live-draft/bridge.mjs` 内嵌 prompt
- `docs/zijing-training/LIVE-RULES.md`
- 相关 Evidence / 客户对话原文

## 验证(固定检查项)

- 修完后用真实或构造对话验证违规不再出现。
- **如果这次改动涉及 `bridge.mjs`(或其它包含 agent 对话 prompt 的文件)里的规则,必须同步检查 `docs/zijing-training/LIVE-RULES.md` 有没有对应条目,没有就补上;Cursor 的实施报告里要明确写清楚这次有没有改 `LIVE-RULES.md`、改了哪一条,没改的话要说明为什么不需要改(比如这次只是纯代码层面的确定性检查,不涉及对话措辞规则)。**
- 需要上生产时走 Release Manager,不要 `--allow-dirty` 常态直推。

## Cursor 实施报告

<!-- 追加,不要覆盖之前记录 -->
"""


def write_coach_fix_plan(
    record: dict[str, Any],
    *,
    root: Path | None = None,
) -> Path:
    root = root or workspace_root()
    rule_id = extract_rule_id_from_record(record)
    day = datetime.now(timezone.utc).strftime("%Y%m%d")
    slug = slug_for_rule(rule_id, day)
    path = plans_dir(root) / f"{slug}.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    # Avoid overwrite if same slug already exists — append suffix
    if path.is_file():
        path = plans_dir(root) / f"{slug}-{str(record.get('id') or 'x')[-6:].lower()}.md"
    path.write_text(render_coach_fix_plan(record), encoding="utf-8")
    return path

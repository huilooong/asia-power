# asia-rule-support ↔ 子敬训练对齐（2026-07-14）

## 两套系统

| 系统 | 位置 | 作用 |
|------|------|------|
| **asia-rule-support** | 云端 OpenClaw 插件 `~/.openclaw/extensions/asia-rule-support` | WhatsApp **第一句**自动回（GLM-4.7-flash） |
| **子敬 / sales-agent** | AsiaPower `bridge.mjs` + `sales_core/` | +233 生产接待 / 草稿 / Cloud LLM |

Alma 那类 `Hi! I'd be happy to help...` 来自 **asia-rule-support** 的 Z.AI prompt，不是子敬训练文档。

## 子敬如何学到训练

1. 蒸馏文件：`docs/zijing-training/LIVE-RULES.md`（无客户隐私）
2. Python 注入：`sales_core/zijing_reply_context.py` → `zijing_training_rules_addon()`
3. +233 OpenClaw：`deploy/apsales-live-draft/bridge.mjs` 读同一 LIVE-RULES
4. 云端第一句：asia-rule-support 的 `callZai` prompt + workspace `LIVE-RULES.md`

以后龙哥新训练 → **先改 LIVE-RULES.md**（再可选写 session-*.md 存档）。只写 session 不改 LIVE-RULES，自动回复学不到。

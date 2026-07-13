# APBRAIN-001 — AsiaPower Brain Vault

## Context

CEO / CTO / Cursor / APSales / APCOO 需要共享同一套长期决策知识。  
文档散落、聊天易丢、第二套 wiki 会造成分裂。

## Decision

建立 **AsiaPower Brain**（Obsidian Vault，路径 `AsiaPower-Brain/`）：

- Obsidian = 唯一 Brain
- Git = 唯一版本管理
- Markdown Only
- 不存代码；不存完整 Evidence；旧资料先不迁移

## Why

- 决策可检索、可追溯、可给 ChatGPT 每日摘要恢复上下文
- 避免「文档仓库 / 代码仓库」伪装成知识库
- 未来若 ChatGPT 直连 Obsidian，结构无需重构

## Alternatives Rejected

- 再建 Notion / 独立 DB 知识库 → 违反「唯一 Brain」
- 把 `docs/` 或 `MEMORY.md` 当作 Brain → 角色混乱，且难统一导航
- Brain 内塞代码与完整 ndjson → 体积、隐私、职责错位

## Consequences

- 所有长期共识写入本 Vault（或经 CEO 批准后从旧处迁入）
- 每日 Export → `exports/chatgpt/brain-summary.md`
- 业务代码部署与 Brain 更新解耦；本任务**不部署业务代码**

## Status

Active · 等待 CEO Review（APBRAIN-001）

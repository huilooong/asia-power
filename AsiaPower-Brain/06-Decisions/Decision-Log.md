# Decision Log

AsiaPower 正式决策登记处。  
聊天 ≠ Decision。重要拍板写入本 Log，并可选同步 [[11-Knowledge/CEO-Review/CEO-Review|CEO Review]]。

## Decision 生命周期

```
Proposed → Accepted → Superseded
                ↘ Rejected
```

| 状态 | 含义 |
|------|------|
| Proposed | 已写下，尚未拍板 |
| Accepted | CEO（或授权 Owner）已批准，现行有效 |
| Superseded | 曾有效，已被更新决策替代（保留历史，不删） |
| Rejected | 明确否决，不执行 |

规则：

- 变更状态必须改本条笔记 + 更新本页索引
- Accepted 被取代时：旧条标 Superseded，新条写清替代关系
- 日常讨论、聊天、草稿 **不进入** Decision Log

## 格式（每条必须）

| 字段 | 说明 |
|------|------|
| 日期 | YYYY-MM-DD |
| Decision | 决定了什么 |
| Reason | 为什么 |
| Evidence | 依据摘要（链接到 Evidence Summary / 报告，不贴原始 ndjson） |
| Owner | 负责人 |
| Status | Proposed / Accepted / Superseded / Rejected |

单条笔记用模板 `_templates/Decision`，放在 `06-Decisions/log/`。

## 索引

| 日期 | Decision | Owner | Status | 笔记 |
|------|----------|-------|--------|------|
| 2026-07-13 | 建立 AsiaPower Brain（Obsidian 唯一知识库） | CEO | Accepted | [[06-Decisions/log/2026-07-13-apbrain-001|2026-07-13-apbrain-001]] |

## 相关

- [[07-Lessons/Lesson-Library|Lesson Library]]
- [[03-Architecture/Architecture-Library|Architecture Library]]

# APBRAIN-001 — AsiaPower Brain（Obsidian Knowledge Base）

## Status

**CEO Approved 2026-07-13**  
原则四项已写入 · 未迁移旧资料 · 未部署业务代码

## Goal

建立 AsiaPower **唯一**长期知识库（Brain），供 CEO / CTO(ChatGPT) / Cursor / APSales / APCOO 共享决策知识。

## Deliverables

| 项 | 路径 |
|----|------|
| Vault 根 | `AsiaPower-Brain/` |
| 首页 | `AsiaPower-Brain/Home.md` |
| Decision Log | `AsiaPower-Brain/06-Decisions/Decision-Log.md` |
| Lesson Library | `AsiaPower-Brain/07-Lessons/Lesson-Library.md` |
| Architecture Library | `AsiaPower-Brain/03-Architecture/Architecture-Library.md` |
| Vehicle Intelligence | `AsiaPower-Brain/12-Vehicle-Intelligence/` |
| Long-term Memory | `AsiaPower-Brain/11-Knowledge/Long-term-Memory/` |
| CEO Review | `AsiaPower-Brain/11-Knowledge/CEO-Review/` |
| ChatGPT Export | `AsiaPower-Brain/exports/chatgpt/brain-summary.md` |
| Export 脚本 | `scripts/asiapower-brain-daily-export.py` |
| 本报告 | `docs/tasks/apbrain-001/README.md` |

## Directory Tree（摘要）

```
AsiaPower-Brain/
  Home.md
  README.md
  00-Vision/ … 13-Supplier/
  99-Archive/
  _templates/
  exports/chatgpt/
  .obsidian/   # 轻量核心配置；workspace 不提交
```

## Principles Encoded

1. Obsidian = 唯一 Brain  
2. Git = 唯一版本管理  
3. Markdown Only  
4. Brain 不存代码；Evidence 只存 Summary  
5. ChatGPT 靠 Export，不靠直接读 Vault（未来直连也无需重构）

## Explicit Non-Goals（本任务）

- 不迁移 `docs/` / `MEMORY.md` / `obsidian/AsiaPower-AI-Memory`
- 不改 APSales / Evidence / VIN 业务代码
- 不生产部署

## CEO Review Checklist

- [x] 正式命名 AsiaPower Brain
- [x] Decision 生命周期
- [x] Long-term Memory 只保存共识
- [x] 增加 North Star
- [x] 批准 Git 提交
- [x] 旧 `obsidian/AsiaPower-AI-Memory` 迁入前只读

## Next（另开任务，本任务不加功能）

1. 迁移优先级清单（另任务）  
2. 可选每日 cron export（另任务）  

## Validation

见同目录 `validation.md`。

# AsiaPower Brain

> AsiaPower 的**唯一长期知识库**。  
> 不是文档仓库。不是代码仓库。  
> 这里存的是：**决策、架构、生意、使命、教训、路线图、证据摘要**。

---

## 怎么用

| 角色 | 用法 |
|------|------|
| CEO | 看 [[11-Knowledge/CEO-Review/CEO-Review\|CEO Review]]、改 Decision、批 Roadmap |
| CTO (ChatGPT) | 读每日 [[exports/chatgpt/brain-summary\|brain-summary]]，恢复长期上下文 |
| Cursor | 改代码前先查 Decision / Architecture / Lessons |
| APSales / APCOO | 共享同一套业务与决策知识 |

**原则：Obsidian = 唯一 Brain。不要再建第二套知识系统。**

---

## 导航

### 使命与宪法
- [[00-Vision/North-Star|North Star]] — 北极星（方向校准）
- [[00-Vision/Vision|Vision]] — 我们要成为什么
- [[01-Constitution/Constitution|Constitution]] — 不可破的规则
- [[11-Knowledge/Long-term-Memory/Long-term-Memory|Long-term Memory]] — 只保存长期共识

### 生意与产品
- [[02-Business/Business|Business]]
- [[05-Products/Products|Products]]
- [[13-Supplier/Supplier|Supplier]]

### 架构与智能体
- [[03-Architecture/Architecture-Library|Architecture Library]] — **为什么这样设计**（不是怎么写代码）
- [[04-Agents/Agents|Agents]] — APSales / APCOO / Cursor 等职责边界

### 决策与教训（核心）
- [[06-Decisions/Decision-Log|Decision Log]]
- [[07-Lessons/Lesson-Library|Lesson Library]]
- [[11-Knowledge/CEO-Review/CEO-Review|CEO Review]] — 重要决策，不是聊天记录

### 路线与会议
- [[08-Roadmap/Roadmap|Roadmap]] — Roadmap ≠ Production
- [[09-Meeting/Meetings|Meetings]]
- [[10-Daily/Daily|Daily notes]]

### Vehicle Intelligence
- [[12-Vehicle-Intelligence/Vehicle-Intelligence|Vehicle Intelligence]] — 能力，不是愿景  
  VIN / OE / Engine Plate / Transmission Plate / Vehicle Photo 沉淀处

### Evidence
- [[11-Knowledge/Evidence-Summaries/Evidence-Summaries|Evidence Summaries]] — **只存摘要**  
  真实 ndjson 继续在服务器 / `data/evidence/`，不进 Brain

### ChatGPT Export
- [[exports/chatgpt/README|exports/chatgpt]] — 每日 `brain-summary.md`（约 1000–2000 字）

### 归档
- [[99-Archive/Archive|Archive]]

---

## 快速入口（模板）

- 新建决策 → 用模板 `_templates/Decision`
- 新建 Lesson → 用模板 `_templates/Lesson`
- 新建 Architecture → 用模板 `_templates/Architecture`
- 新建 CEO Review → 用模板 `_templates/CEO-Review`
- 新建 Vehicle Knowledge → 用模板 `_templates/Vehicle-Knowledge`

---

## 版本与边界

| 项 | 规则 |
|----|------|
| 版本管理 | **Git 是唯一版本管理**；Vault 在仓库 `AsiaPower-Brain/` |
| 格式 | **Markdown Only**；禁止数据库、私有格式、重插件依赖 |
| 不存什么 | 代码、完整 Evidence ndjson、密钥、完整客户隐私 |
| 旧资料 | **先不迁移**；本 Vault 从空结构 + 种子页开始（APBRAIN-001） |

---

*APBRAIN-001 · AsiaPower Brain · CEO Approved 2026-07-13*

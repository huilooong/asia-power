# APSALES-EVIDENCE-001 — Phase 1 Audit（analysis.md）

**日期：** 2026-07-13  
**阶段：** Phase 1 Audit → Phase 2 Architecture → **Phase 3 等待 CEO Review**  
**本阶段禁止：** 写实现代码、自动分析、自动改 Prompt、自动部署。

---

## 1. 结论（先看这里）

| 问题 | 答案 |
|------|------|
| 需要新建 Engine 吗？ | **不需要** |
| 需要新建顶层目录吗？ | **不需要** |
| 现有系统能否承担 Evidence V1？ | **能，但缺一条「关联层」** |
| V1 真正要新增什么？ | **append-only Evidence 行 + 完整出站落盘 + 客户下一步事实配对** |
| 今天能不能自动进化？ | **不能，也不该** — 只保存，不学习自动化 |

---

## 2. 当前已有能力（可复用）

### 2.1 四大已有能力（任务规定边界）

| 能力 | 现状 | 能否承担 Evidence？ |
|------|------|---------------------|
| **Sales Decision** | `sales_coach/decisions.py` 启发式 flag；Draft 的 `next_action` / `decision_path`；Sandbox 的 `decision` / `reason_code` | ✅ 可记录 Decision，但 Sandbox 字段偏薄 |
| **Truth Guard** | Draft 走 `constitution_runtime`；Sandbox 走 JS `applyRiskPolicy` + Python `_risk_rewrite`；`truth/truth_guard.py` **未挂 Sandbox** | ⚠️ 双轨；证据可记，策略未统一 |
| **Channel Policy** | WhatsApp Sandbox allowlist、`WHATSAPP_AUTONOMY_MODE`、Draft 审批链 | ✅ Channel 可记 |
| **Evidence（本任务）** | **尚无统一 Evidence 行**；数据散落在 5+ 处 | ❌ 缺关联层 |

### 2.2 现有落盘（按路径）

| Store | 路径 | 强项 | 弱项 |
|-------|------|------|------|
| WA 入站全文 | `data/whatsapp_cloud/normalized/{wamid}.json` | 客户原文完整 | 无 Decision / 无出站 |
| Sandbox 决策日志 | `data/whatsapp_cloud/sandbox/decisions.ndjson` | 真发路径、risk、wamid_out | **入站/出站都截断**；无结构化 Decision |
| 发送状态 | `data/whatsapp_cloud/statuses/` | Meta delivery | 非销售 Decision |
| Draft Queue | `memory/customer_gateway/draft_queue/` | Decision + 宪章 + CEO `revision_note` 最完整 | 多数**不真发**；与 Sandbox 双轨 |
| Conversation Memory | `memory/sales_intelligence/conversations/` | 多轮文本 | 与 WA `wa_id` 未统一键 |
| Customer Profiles | `memory/customer_gateway/customer_profiles/` | 画像汇总 | 非 per-turn Evidence |
| sales_coach | `memory/sales_coach/*` + coach md | 课 / 规则 / self_improve | 是分析层，不是 Evidence 源 |
| audit | `audit/events.jsonl` | 审批事件 | 无完整消息体 |

### 2.3 本地 Sandbox 样本（仓库镜像）

- `data/whatsapp_cloud/sandbox/decisions.ndjson`：约 26 行
- 字段：`at, decision, inbound_excerpt, inbound_type, parser_version, policy_version, reason_code, reply_excerpt, risk_blocked, risk_level, wa_suffix, wamid_out`

---

## 3. Evidence V1 字段覆盖度

| Evidence V1 要求 | 现状 | 缺口 |
|------------------|------|------|
| Customer Message | normalized 有全文；Sandbox 只有 excerpt | Sandbox 路径需引用 normalized，勿再截断当真源 |
| Customer Intent | Draft 有 category；Sandbox 无 | Sandbox 需补 intent（可复用现有分类器，不新建） |
| Conversation / Customer ID | `wa_id` 有；统一 conversation_id 弱 | V1 用 `wa_id` 作 conversation_id 即可 |
| Timestamp | 各处有 | OK |
| **Decision**（非 Reply） | Draft 较完整；Sandbox 只有 decision/reason_code | **必须结构化落盘**（next_action / module / flags） |
| Final Reply（真发） | Sandbox `reply_excerpt` ≤200 | **必须存全文**（sidecar 或取消截断） |
| CEO 修改 | Draft 有 revision_note；Sandbox **无** | Sandbox 直发路径暂无 CEO 改稿；预留字段 |
| Customer Result | **无结构化** | 下一条入站配对事实（vin_sent / silent…） |
| Live Fix | **无** | 可选 `live_fix_id` 关联 issue |

---

## 4. 重复能力 / 屎山风险

| 风险 | 说明 | 本任务如何避免 |
|------|------|----------------|
| 三套对话记忆 | APLIVE `memory/conversations/` vs sales_intelligence vs whatsapp_cloud | Evidence **只引用**，不复制第三套记忆 |
| Draft vs Sandbox 双轨 | 审批链 vs 真发链字段不一致 | Evidence 用 `path=sandbox|draft` 标记，**不合并成新 Engine** |
| Coach / Self-Improve / Evidence 三层混淆 | Coach=读；Self-Improve=检测；Evidence=存 | 职责写死：Evidence 只 append，不分析 |
| reply 截断链式丢失 | JS 200 → coach 再截 | 出站全文落盘一次，分析层只读引用 |
| 新建 engines/ 诱惑 | 任务明确禁止 | 禁止新目录/新 Engine |

---

## 5. 本任务真正需要新增什么？

### 必须新增（最小）

1. **`data/whatsapp_cloud/evidence.ndjson`** — append-only 关联行（不是 Engine）
2. **出站全文 sidecar**（或 decisions 取消截断）— 满足「完整保存最终回复」
3. **写入钩子**（复用现有）：Sandbox 发完后写 1 行；可选 Draft revise/approve 写 1 行
4. **客户下一步配对**（事实）：下一条入站到来时，回填上一条 Evidence 的 `customer_result`（只追加补丁行或同文件 update-append，见 architecture）

### 明确不新增

- 新 Engine / 新顶层目录 / 自动 Prompt / 自动部署 / 自动分析 / BI 统计

### 可复用、零新增逻辑

- `sales_coach/decisions.py` → Decision flags  
- `sales_coach/modules.py` → module 标签  
- normalized 入站全文  
- Draft 的 CEO revision（审批路径）

---

## 6. 与 SELF-IMPROVE-001 的关系

| 项目 | SELF-IMPROVE | EVIDENCE |
|------|--------------|----------|
| 职责 | 读数据 → 发现问题 → ≤3 课建议 | **只保存事实链** |
| 输出 | coach md / proposals | evidence.ndjson |
| 依赖 | 将来应读 Evidence | 不依赖 Coach |

顺序：**先 Evidence，再 Coach 读 Evidence**。  
当前 Coach 可继续读旧源；Evidence 落地后逐步切读，不强制本任务改 Coach。

---

## 7. Phase 1 判定

| 项 | 判定 |
|----|------|
| 现有能力够不够搭 V1？ | **够**（差关联层 + 全文出站 + 客户结果） |
| 是否存在重复？ | **是**（对话记忆三套、Draft/Sandbox 双轨） |
| 是否需要新系统？ | **否** |
| 是否可进入 Architecture？ | **是** |

→ 见同目录 `architecture.md` / `evidence-model.md`。

---

## 8. CEO Architecture Review 修订（2026-07-13）

| 修订 | 落实 |
|------|------|
| Evidence 属 AsiaPower，非 WhatsApp | `data/evidence/` + `whatsapp/` 子通道 |
| Flow 含独立 Truth Guard | schema + writer 独立节点 |
| Coach Read Only | `COACH_READ_ONLY` + CLI 声明 |
| 增加 Decision Result | patch 回填 succeeded/failed/inconclusive |
| 有条件批准后直接 Phase 4 | 已实现，不再二次等审 |

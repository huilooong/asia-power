# APSALES-EVIDENCE-001 — Architecture（V1）

**状态：** CEO Architecture Review — **有条件批准已落实**（2026-07-13）  
**阶段：** Phase 4 Implementation

---

## 1. 一句话架构

> Evidence 属于 **整个 AsiaPower**，不属于 WhatsApp。  
> 在 Sales Decision / Truth Guard / Channel Policy 之上，加一层 **append-only Evidence 存储**；Sales Coach **只读**；不新增 Engine。

---

## 2. Evidence Flow（CEO 定稿）

```
Customer
   ↓
Decision
   ↓
Truth Guard          ← 独立可追溯节点（放行 / 阻止 / 改写 必须可分析）
   ↓
Reply                ← 最终真发全文
   ↓
CEO                  ← 是否修改 / 内容 / 原因
   ↓
Customer Result      ← 客户下一步事实（不猜）
   ↓
Decision Result      ← Decision 是否被客户行为证明成功（学 Decision，不学 Reply）
```

---

## 3. 目录结构（AsiaPower 级）

```
data/evidence/                    # AsiaPower 统一 Evidence 根（非 WhatsApp 专属）
  README.md
  whatsapp/                       # V1 仅实现此通道
    turns.ndjson                  # append-only 主证据
    patches.ndjson                # customer_result / decision_result / ceo 补丁（只追加）
    failed.ndjson                 # 写入失败（不挡业务）
    outbound/{wamid}.txt          # 可选：超长出站 sidecar
  # 以后复用同一模型：
  # email/  website/  supplier/  seo/  apcoo/
```

**禁止：** `data/whatsapp_cloud/evidence.ndjson` 作为 Evidence 主库。  
WhatsApp 的 `normalized/` / `sandbox/decisions.ndjson` 仍可作通道日志；Evidence 另存。

---

## 4. 数据流（实现）

```
WhatsApp 入站 → normalized（通道日志，保留）
        │
        ├── 配对上一条 pending Evidence → patch（Customer Result + Decision Result）
        │
        ├── Channel Policy（Sandbox allowlist）
        ├── APSales → Decision
        ├── Truth Guard（独立节点记录）
        ├── Reply 真发
        │
        └── append data/evidence/whatsapp/turns.ndjson
              （失败只写 failed.ndjson，不阻断发送）
```

---

## 5. 职责边界

| 组件 | 职责 | 禁止 |
|------|------|------|
| Evidence store | 只 append | 覆盖、删除、BI 统计 |
| `asiapower-evidence.js` | 写 WhatsApp 通道 Evidence | 改 Prompt / 改策略 |
| Sales Decision / Truth Guard / Channel Policy | 业务决策 | 被 Evidence 替换 |
| **Sales Coach** | **Read Only**：读 Evidence → Summary / ≤3 课 | **改生产数据 / 自动改 Prompt / 自动改 Decision** |

---

## 6. Business First

Evidence 写入失败 **不得** 阻断客户发信。

---

## 7. Three-stage Evolution

见 `evolution-rule.md`。第一次 Live Fix；第二次 Evidence；第三次才升级长期能力。

---

## 8. CEO Review 结论

| 项 | 结论 |
|----|------|
| 方向 | 认可 |
| Evidence 归属 | AsiaPower 级 `data/evidence/` |
| Flow | Customer→Decision→Truth Guard→Reply→CEO→Customer Result→Decision Result |
| Coach | Read Only（硬边界） |
| 再审 | **不再等待**；直接 Phase 4 |

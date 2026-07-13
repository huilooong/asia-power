# APSALES-EVIDENCE-001 — Review（Phase 5）

## 新增了什么？

1. AsiaPower 级 Evidence 根：`data/evidence/`（V1：`whatsapp/`）
2. 写入模块：`asiapower-evidence.js`
3. Sandbox 挂钩（真发后落盘 + 下一轮入站配对）
4. Decision Result + Truth Guard 独立节点
5. Coach 只读 Daily Summary：`sales_coach/evidence.py`

## 为什么新增？

现有 `sandbox/decisions.ndjson` 截断、缺 Truth Guard 节点、缺 Customer/Decision Result，无法支撑「学 Decision」。

## 为什么不塞进 WhatsApp 目录？

CEO P0：Evidence 属于整个 AsiaPower；以后 Email/Website 等复用同一模型。

## 为什么没有新 Engine？

只做 append 存储 + 薄写入钩子；决策仍在 Sales Decision / Truth Guard / Channel Policy。

## 以后能否复用？

能。换 `channel` 子目录即可；schema 已含 `channel` 字段。

## Coach 边界

**Read Only**：不改生产数据、不自动改 Prompt、不自动改 Decision。

# APSALES-EVIDENCE-001 — Implementation

**状态：✅ Phase 4 已完成**（CEO 有条件批准边界已落实）

---

## 做了什么

1. **Evidence 归属 AsiaPower**：`data/evidence/` + V1 `data/evidence/whatsapp/`
2. **Flow 定稿落盘**：Customer → Decision → **Truth Guard（独立节点）** → Reply → CEO → Customer Result → **Decision Result**
3. **写入钩子**：Sandbox 发信前后调用 `server/lib/asiapower-evidence.js`（失败不挡发送）
4. **Coach Read Only**：`COACH_READ_ONLY=True`；`--evidence-summary` 只读 Evidence，只写 coach markdown
5. **Daily Summary**：四问模板已可生成

---

## 关键文件

| 文件 | 作用 |
|------|------|
| `server/lib/asiapower-evidence.js` | Evidence 写入 / 配对 / Decision Result |
| `server/lib/whatsapp-cloud-sandbox.js` | 挂钩 recordCustomerResult + recordEvidenceTurn |
| `sales_coach/evidence.py` | 只读加载 + Daily Summary |
| `sales_coach/config.py` | `evidence_*` 路径 + `COACH_READ_ONLY` |
| `sales_coach/__main__.py` | `--evidence-summary` |
| `data/evidence/README.md` | 多通道说明 |
| `docs/tasks/apsales-evidence-001/*` | 文档更新 |

---

## 验证证据

本地模拟：

- Turn：询价 → Truth Guard `rewrite`/`price_advance` → Decision `ask_vin`
- Patch：客户发 VIN → Customer Result `sent_vin` → Decision Result **`succeeded`**
- Summary：`docs/agents/apsales/coach/2026-07-13-evidence.md`

命令：

```bash
python -m sales_coach --evidence-summary --date 2026-07-13
```

---

## 未做（刻意）

- Email / Website / Supplier / SEO / APCOO 通道写入（目录预留）
- Draft 审批路径 Evidence（V1 以 WhatsApp Sandbox 真发为主）
- 自动改 Prompt / Decision / 部署
- 生产 Release（需另走 commit → push → Release Manager）

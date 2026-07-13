# APSALES-DECISION-001 — Analysis（Phase 1 Audit）

**日期：** 2026-07-13  
**模式：** WhatsApp Sandbox（`WHATSAPP_AUTONOMY_MODE=sandbox` + CEO 白名单）  
**结论：** 固定三件套 `ask_list` 来自 `sales_core/vehicle_intelligence.py` 的 `build_sales_decision`，不是 Prompt，也不是 Evidence 写错。

---

## 1. 实际调用链（Sandbox）

```
Meta Webhook
→ server/lib/whatsapp-cloud-webhook.js
→ server/lib/whatsapp-cloud-sandbox.js  handleSandboxInbound
→ scripts/whatsapp_cloud_sandbox_reply.py
     ├─ 含 VIN → enrich_and_decide → build_whatsapp_reply（短路，跳过 LLM）
     ├─ 媒体无字 → _safe_media_reply
     └─ 其它 → classify → build_sales_brain_draft → constitution → _risk_rewrite
→ JS applyRiskPolicy（VI 干净路径可跳过重写）
→ Graph API send
→ asiapower-evidence.js recordEvidenceTurn
```

**不经过：** `customer_gateway/inbound_message_router.py` Draft Queue / Telegram Approval。

---

## 2. 审计项对照

| 项 | 位置 | Sandbox |
|----|------|---------|
| Intent Router | `customer_gateway/sales_message_classifier.py` | 非 VIN 路径调用；VIN 短路跳过 |
| Sales Decision | `vehicle_intelligence.build_sales_decision` | VIN 主路径 |
| VIN / Snapshot | `sales_core/vehicle_intelligence.py` | Store → NHTSA → corgi stub → manual |
| Customer Memory | CRM / profiles | **VIN 路径不读**；仅 `customer_hash` |
| Truth Guard | JS `applyRiskPolicy` + Py `_risk_rewrite` | 生效；`truth/truth_guard.py` 未挂 |
| 快速话术 | `zijing_reply_context.zijing_quick_reply` | greeting / price |
| **固定 ask_list** | **`_SALES_ASK_LABELS` + `build_sales_decision` L37–41, 504–527** | **唯一权威** |
| Evidence | `server/lib/asiapower-evidence.js` | turns/patches.ndjson |
| Prompt 重复控制 | LLM prompt vs VI 固定三问 | VI 路径无视 Prompt「只问缺失」 |

---

## 3. 固定 ask_list 根因

```python
# sales_core/vehicle_intelligence.py
_SALES_ASK_LABELS = {
    "product_scope": "Long block / complete engine / gearbox?",
    "quantity": "Quantity?",
    "destination_port": "Destination port?",
}
```

- 只要消息里没有 scope/qty/port → **永远三问全出**
- 与 VIN decode 成功/失败无关 → 解释 24/24 Evidence 相同
- Fallback 模板（JS/Py）复制同一三问 → 漂移风险

---

## 4. 绕过正式决策的路径

1. VIN 短路（跳过 classifier/LLM/CRM）  
2. `zijing_quick_reply`（Hi / price）  
3. Media-only  
4. Python 失败 → JS fallback  
5. Risk rewrite 整段替换  
6. observe 模式 / 非白名单  

---

## 5. V1 复用策略（不新建 Engine）

| 复用 | 用途 |
|------|------|
| `build_sales_decision` 单点替换 | 接入 Commercial Decision Rules |
| `enquiry_context.parse_enquiry_facts` | 已知字段，禁止重复问 |
| `zijing_reply_context` | 价格意图入口，改为走 NBA |
| `applyRiskPolicy` / `_risk_rewrite` | Truth Guard 保持 |
| `asiapower-evidence.js` | 写入 commercial_decision 记录 |

**禁止：** 新微服务、新顶层目录、新独立状态机、Sales Coach 写回。

---

## 6. 风险

| 风险 | 说明 |
|------|------|
| P0 | 固定三问非动态 NBA |
| P1 | JS/Py Truth Guard 双轨漂移 |
| P1 | price advance 仍推三件套 |
| P2 | Evidence `inferDecision` ≠ 真实决策对象 |
| P2 | 无客户历史时 wholesaler 场景需配置表 |

---

## 7. Phase 1 完成标准

- [x] 调用链记录  
- [x] ask_list 根因定位  
- [x] 复用边界明确  
- [ ] → Phase 2 Design  

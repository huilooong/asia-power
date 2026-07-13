# APWA-NIGHTSHIFT-001 — Whitelist Audit

## 双层限制

| 层 | 是否阻断陌生客户自动回复 | 证据 |
|----|--------------------------|------|
| **我们的代码** | **是（当前）** | `sandbox` + `CEO_WHATSAPP_NUMBER` allowlist |
| **Meta 号码状态** | **否** | Graph：`status=CONNECTED`, `code_verification_status=VERIFIED` |

## 代码路径

```
Webhook POST
→ persist（所有入站可落库）
→ runPostPersist（仅 sandbox/live）
→ handleSandboxInbound
     sandbox: 非白名单 → skip not_allowlisted
     live: 全部有 wa_id → APSales
     off: skip autonomy_off
```

## 标记（不阻断）

| 标记 | 含义 |
|------|------|
| `ceo_test` | `CEO_WHATSAPP_NUMBER` |
| `internal` | `WHATSAPP_INTERNAL_WA_IDS`（可选） |
| `public_inbound` | 真实客户 |

## 紧急关闭

```bash
WHATSAPP_AUTONOMY_MODE=off
systemctl restart inventory-site
```

## 变更（本任务）

新增 `live` 模式：+86 官方号所有真实 inbound 进入 APSales；CEO 仍标 `ceo_test`。  
**不**依赖预先登记客户号码。

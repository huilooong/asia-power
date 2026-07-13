# APWA-NIGHTSHIFT-001 — Production Validation

**审计时间：** 2026-07-13  
**主机：** `root@159.65.86.24` · 站点 `/root/.openclaw/workspace/inventory-site/`

## 已验证

| 检查项 | 结果 | 证据 |
|--------|------|------|
| 生产 `WHATSAPP_AUTONOMY_MODE` | `sandbox` | 服务器环境变量 |
| CEO 测试号 | `19402375223` | `CEO_WHATSAPP_NUMBER` |
| Meta +86 号码状态 | CONNECTED / VERIFIED / GREEN | Graph Phone Number API |
| Messaging tier | TIER_250 | Graph |
| 陌生入站能否进 webhook | 是（历史有非 CEO wa_id） | 生产日志样本 |
| 陌生入站能否自动回复 | **否**（sandbox 白名单） | `not_allowlisted` |
| Token 能否查广告 | **否** | 无 ads 相关 scope |
| Truth Guard | 依赖现有路径；本任务未改 Commercial Decision | — |
| 紧急关闭 | `mode=off` 跳过自动回复 | 代码路径 |

## 代码变更（本地，待你批准后部署）

| 文件 | 作用 |
|------|------|
| `server/lib/whatsapp-cloud-sandbox.js` | 新增 `live`：全部 inbound 可进 APSales；标签不阻断 |
| `server/lib/whatsapp-cloud-webhook.js` | `live` 也触发自动回复 |
| `.env.example` | 文档化 `live` / `WHATSAPP_INTERNAL_WA_IDS` |

## 未做（闸门）

| 项 | 状态 |
|----|------|
| 生产切 `WHATSAPP_AUTONOMY_MODE=live` | **未做**（等 CEO） |
| 陌生号端到端自动回复实测 | **未做**（需 live 后） |
| Night Shift 广告草稿创建 | **未做**（需 Ads Manager；本环境无权限） |
| 发布 Night Shift | **禁止** |

## 建议验证顺序（批准 live 后）

1. 生产设 `live` + restart `inventory-site`  
2. 用非 CEO 手机给 +86 发一句英文询价  
3. 确认有自动回复且无内部标签泄漏  
4. 临时设 `off` → 确认不再回复 → 再改回 `live`  
5. 再谈广告草稿 / 发布

# APWA-NIGHTSHIFT-001 — Production Validation

**更新：** 2026-07-13（CEO 批准 live）

## 已执行

| 步骤 | 结果 |
|------|------|
| Commit / push | `e1dd596b7` → `feature/apsales-evidence-001` |
| Deploy | **REL-20260713094832-api-e1dd596b7**（api PASS） |
| 生产 `WHATSAPP_AUTONOMY_MODE` | **`live`** |
| `inventory-site` | active |
| 代码冒烟 | CEO → reply + `ceo_test`；陌生号 → reply + `public_inbound` |
| 紧急关闭逻辑 | `mode=off` 时陌生号 `shouldAutoReply=false`（进程内验证；生产 `.env` 仍为 live） |

## 生产核对命令结果

```
mode: live
ceo: { reply: true, tag: "ceo_test" }
stranger: { reply: true, tag: "public_inbound" }
off_mode → stranger_reply: false
```

## 仍未做（广告闸门）

| 项 | 状态 |
|----|------|
| Night Shift 广告草稿 / 发布 | **未做**（未经批准；+233 未动） |
| Ads Manager 能否选 +86 | 仍需 CEO 后台确认 |
| 真实陌生手机端到端发信 | 建议你或同事用非 CEO 号给 +86 发一句验证 |

## 紧急关闭

```bash
# 生产
WHATSAPP_AUTONOMY_MODE=off
systemctl restart inventory-site
```

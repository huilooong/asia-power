# APSALES P0+P1 — 恢复推理 / 5W2H / 引导成交（2026-07-22）

触发：客户 `+233202102555` 车轱辘话排查。CEO 拍板方案 B。

## 改动

| 层 | 文件 | 做什么 |
|---|---|---|
| P0 核价门 | `deploy/apsales-live-draft/apsales-price-confirmation-gate.mjs` | 取消「已有 part+车辆 ⇒ 默认 inventory」；仅按本轮消息分类；团队 ETA 可解锁 delivery |
| P0 解析 | `deploy/apsales-live-draft/apsales-parse-agent-reply.mjs` | 纯文本回复可恢复；fallback 按问题回答 + 用 `team_replies`；禁止 `what do you need next?` |
| P1 prompt | `deploy/apsales-live-draft/bridge.mjs` | 先答当轮问题；team_replies 必用；5W2H 不再只绑 `possible_repeat_detected` |
| 规则同步 | `docs/zijing-training/LIVE-RULES.md` | 同步 P0 空转禁令 + 先答后问 |

## 验证

```bash
node --test tests/test_apsales_price_confirmation_gate.mjs tests/test_openclaw_parse_agent_reply.mjs
# 25 passed (2026-07-22)
```

## 部署

目标：`apsales-openclaw`（bridge + gate + parse）。需 CEO：commit → push → Release Manager。

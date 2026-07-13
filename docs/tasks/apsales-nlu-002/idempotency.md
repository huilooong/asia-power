# Idempotency (P2)

> **重要声明：** 本次线上「Complete engine / 重复要铭牌」观感的根因 **不是** 并发双发；是 NLU/路由掉进 LLM。  
> **P2 是预防未来真实重复发送**（webhook 重放、并发同 wamid）。

## Inbound

- `claimInboundOnce(messageId)` in `whatsapp-cloud-webhook.js`
- Atomic create `data/whatsapp_cloud/dedup/<wamid>.seen` with `O_EXCL`
- Same wamid → process once; retries skip

## Outbound

- `claimOutboundOnce(rootDir, inboundWamid)` in `whatsapp-cloud-sandbox.js`
- Atomic create under `data/whatsapp_cloud/outbound_dedup/`
- Claim before `sendText`; retry must not double-send for same inbound

## Tests

- Sequential replay: still one normalized file (existing)
- Concurrent 4× same wamid: one claim / one normalized (`tests/test_whatsapp_cloud_webhook.js`)

## Logging

Existing raw / normalized / decision logs retained; dedup skip remains observable.

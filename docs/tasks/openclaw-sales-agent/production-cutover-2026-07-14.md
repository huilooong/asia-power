# +233 WhatsApp → OpenClaw sales-agent 生产切换（2026-07-14）

## 状态

**已发布，CEO 控制号码真实入站已通过 Gateway 并由 bridge 自动发送回复。**

生产 bridge 已默认使用 `APSALES_REPLY_BRAIN=openclaw`。旧 Python Sales Brain 不会作为 OpenClaw 失败时的自动兜底；仅在紧急回滚开关显式设为 `legacy` 时才会运行。

## 发布

| 项目 | 值 |
|---|---|
| 主切换 commit | `431a57fba` — `feat(apsales): route WhatsApp replies through sales-agent` |
| 发布修复 commit | `f32805e2c` — staged bridge 语法校验修复 |
| Release ID | `REL-20260714023759-apsales-openclaw-f32805e2c` |
| 发布完成时间 | `2026-07-14T02:38:49Z` |
| 备份 | `/root/.openclaw/releases/apsales-openclaw-20260714T023841Z` |
| Release Manager 快照 | `releases/REL-20260714023759-apsales-openclaw-f32805e2c/snapshots/` |
| 服务 | `apsales-whatsapp-bridge.service` active；02:38:42 UTC 已重启并重新连接 Business App |

说明：Release Manager 在干净 detached worktree 中无法识别上游分支，因此使用了显式 `DEPLOY_ALLOW_UNPUSHED=1`。代码 commit 已先推送到 GitHub；其余 pre-check、快照、备份、Node 语法校验、服务重启和健康检查均通过。

## 修改文件

- `deploy/apsales-live-draft/bridge.mjs`
  - `openclaw agent --agent sales-agent --session-key agent:sales-agent:whatsapp:+<E164> --json` 调用 Gateway；
  - 只接受 `{"customer_reply":"..."}`，bridge 仅把该正文经 `session.sendText()` 发给客户；
  - Gateway / 模型 / JSON 失败不调用旧 Python 脑、不发客户正文，改写日志并通知 Telegram；
  - `APSALES_REPLY_BRAIN=legacy` 是唯一旧脑回滚路径。
- `scripts/deploy-production.mjs`
  - 新增 Release Manager target：`apsales-openclaw`；
  - 部署前备份 bridge 和环境 drop-in，Node 语法检查后再切换和重启。
- `scripts/lib/release-manager.mjs`
  - 增加新 target 的变更范围与远端快照路径。

## 当前生产环境

```text
APSALES_REPLY_BRAIN=openclaw
APSALES_OPENCLAW_AGENT=sales-agent
APSALES_OPENCLAW_TIMEOUT_SECONDS=90
```

`sales-agent` 无渠道绑定，工具只读；没有 WhatsApp、Telegram、Shell、写入或 Cron 工具。最终发送只由 bridge 的 WhatsApp session 执行。

## Gateway 验证

测试 session key：`agent:sales-agent:whatsapp:+233000000001`

| 调用 | Gateway run | Gateway session | 模型 | 结果 |
|---|---|---|---|---|
| 1 | `c97e74ae-e2ba-43e9-835c-c3cc0f212ab6` | `c551f1bb-5c1f-4dbb-9dcb-1a8a9f8aa697` | `glm-4.7-flash` | 合法 `customer_reply` JSON |
| 2 | `a76b0061-b2fe-4bed-b023-84995a258328` | `c551f1bb-5c1f-4dbb-9dcb-1a8a9f8aa697` | `glm-4.7-flash` | 同一 session，连续上下文成立 |

生产 bridge 源码已检查：

- OpenClaw 分支包含 `runOpenClawReply()`；
- 发信调用为 `session.sendText(senderId, generated.reply)`；
- Telegram 调用位于 WhatsApp 成功发送之后，只作日志；
- `runPython(...apsales-live-sales-brain.py)` 只在 `APSALES_REPLY_BRAIN=legacy` 分支。

## CEO 控制号端到端测试

CEO 控制号码 `+1 940 237 5223` 于 `2026-07-14T02:43:36Z` 向 +233 Business App 发入测试消息。bridge 日志记录了完整链路：

```text
CEO 控制号 → +233 Business App → bridge → Gateway → sales-agent
→ bridge session.sendText → WhatsApp 接受发送
```

| 检查项 | 实测结果 |
|---|---|
| 入站 | `messageId=3A0BEB0E96B010973F17`，bridge 已记录 `inbound` |
| Gateway run | `95a776df-7d73-456e-933a-2edd2b4edc75` |
| customer session | `agent:sales-agent:whatsapp:+19402375223` |
| Gateway session | `dc311980-08bb-4dd7-81e0-0c465005e8e1` |
| model/provider | `glm-4.7-flash` / `zai` |
| bridge 发送 | `session.sendText()` 成功返回 `whatsappMessageId=3EB0F70B3E1CA96FCA163B` |
| Telegram 审批 | 未等待；Telegram 仅在发送成功后作日志 |
| 旧 Python Brain | 未调用；OpenClaw 分支已完成处理 |
| 客户正文 | bridge 只发送解析后的 `customer_reply`；内部分析、风险、分类、JSON 均不进入 `sendText()` |

WhatsApp API 已接受发送并返回 message ID。当前 bridge 日志不保存客户回复正文或已读/送达回执，避免泄露客户内容；因此“已接受发送”已验证，“手机端送达/已读”应以 CEO 手机界面为准。

## 回滚

```bash
ssh root@159.65.86.24 \
  "printf '[Service]\nEnvironment=APSALES_REPLY_BRAIN=legacy\n' \
  > /etc/systemd/system/apsales-whatsapp-bridge.service.d/openclaw-sales-agent.conf \
  && systemctl daemon-reload \
  && systemctl restart apsales-whatsapp-bridge.service"
```

恢复已备份 bridge：

```bash
ssh root@159.65.86.24 \
  "cp /root/.openclaw/releases/apsales-openclaw-20260714T023841Z/bridge.mjs \
  /root/.openclaw/extensions/apsales-live-draft/bridge.mjs \
  && systemctl restart apsales-whatsapp-bridge.service"
```

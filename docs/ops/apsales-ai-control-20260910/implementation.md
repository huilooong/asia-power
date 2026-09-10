# WhatsApp 人工接管及 Coach 首轮修复

状态：本地实现和离线验证完成；CEO 已明确批准生产发布（2026-09-10）。准备通过独立发布目标上线；最终结果以部署报告为准。未向真实客户发送测试消息。

## 用户确认后的操作方式

- 你在同一 WhatsApp 账号手动向某个客户发出文字、图片/语音等媒体或位置后，该客户的 AI 自动暂停。
- 暂停持续到你明确恢复，不设置自动超时。你仍能用手机继续人工回复，客户发来的消息及媒体元信息继续记录。
- 恢复：在 Telegram 指挥中心用已授权管理账号私聊发送 `恢复AI +客户国际号码`。
- 备用操作：`暂停AI +客户国际号码`、`暂停全部AI`、`恢复全部AI`、`AI状态`。
- “恢复全部AI”只解除总开关，单独暂停的客户仍须单独恢复。
- 不向客户发送内部控制指令。恢复只接受新消息，不补发旧生成结果或积压草稿。旧草稿移到 held 目录，保留供人工重新决定。
- 已提交 WhatsApp 传输的消息不能被暂停操作撤回。此功能控制本仓库的 APSales WhatsApp bridge，不代表能停止任何另行运行的外部机器人。

## 已实现

### 人工接管

接管检测放在 WhatsApp 原始消息观察回调，不等待主回复循环。每次发送在底层传输前再次核对暂停状态和控制版本，因此回复生成中途发生暂停、甚至随后恢复，旧回复也会被拦截。

在传输前登记机器人实际 message ID，避免机器人自己的 fromMe 回声被当成人工消息；登记信息持久化，重启后仍可识别。相同文本但不同 ID 的人工消息会触发接管。启用前的历史同步不触发，启用后的延迟人工消息仍会触发；重复同一人工消息不会在恢复后再次暂停。

控制状态由原子写入和文件锁保护，保存操作者与变更历史。损坏的控制文件导致停止自动发送；人工暂停写入失败时，另存持久化禁止发送标记。自动跟进、批准草稿队列、异常兜底都经过同一发送检查。手机人工回复不经过此发送器。

### 销售行为

- 当前意图优先于历史“待询价”状态，识别地址、电话、售后、油品、简短确认和明确的非业务信息。
- 问路和售后先保存人工处理请求；只有管理通知成功才声称已转交，不能编造地址或维修结论。
- 普通 Okay 等确认消息不再触发 VIN 追问；如果上一轮明确在询问是否继续报价，仍保留报价推进逻辑。
- 资格资料限制只约束确定报价，不能要求每一轮唯一的问题都是 VIN。同步更新了 LIVE-RULES。
- 本轮是首轮定向修复，不是全部语言/场景完整 NLU 升级；未用真实模型对全量历史做盲评，也尚未证明线上客户满意度或成交提升。

### Coach

- 小时自检改读 canonical Evidence，缺失或损坏明确失败，不回退到旧 sandbox 假装通过。零轮次明确标为没有可评估数据。
- 同一 evidence_id 不重复统计，同一问题重复小时检查不再增加独立命中次数。
- 违规与好例子标签矛盾、引用不存在的证据、不适用的销售规则进入隔离，不能自动派工或写入正例库。
- 当前意图传入 LLM 裁判；学校日常上下文不作为销售推进失败。
- 同类未验证任务复用一个追踪记录，保留历史计划文件；状态从 detected 开始，不把文件创建当“已接手”。新增逐步记录分诊、负责人、修改、测试、批准、发布和验证回执的入口。
- 原来的完成监视器改报“出现实施记录，未确认完成或上线”；无回执超过 24 小时每天仅汇总提醒一次。
- **仍需实际执行者接手任务。** 本轮没有启动自动改生产的执行代理，也没有清除 168 份历史计划、历史误报或旧正例。新流程阻止继续重复造任务，历史清理应基于人工确认逐批进行。

## 验证

- Node：46 项通过，包含控制读写跨语言互通、范围隔离、暂停/恢复期间的旧回复、消息回声、人工同文消息、重启、媒体接管、延迟同步、最终发送检查，以及既有报价/人工转交/跟进规则。
- Python：51 项通过，包含管理身份与私聊权限、暂停持久化、旧人工消息重放、损坏文件、Evidence 迁移及去重、Coach 矛盾判断隔离、学校上下文、重复派工与回执要求，以及既有 Coach 测试。
- 16 条真实失败情形/措辞变体作离线路由验证；这是意图及确定性路由验证，不是 16 次真实模型回复或真实 WhatsApp 发送。
- bridge/session JavaScript 语法、Python 脚本编译、相关 diff 格式检查通过。
- Telegram 补丁按生产原文件完成本地 dry-run 和语法验证；用生产 handle_message 的补丁后函数做隔离执行，验证管理者私聊暂停、群内拒绝、私聊恢复，不发网络消息。
- 核实生产 Baileys sendMessage 允许 options.messageId 覆盖生成 ID，支持本次机器人回声识别方案。尚未对生产 WhatsApp 连接发送消息作端到端验证。

复现命令：

```sh
node --test tests/test_apsales_reply_control.mjs tests/test_apsales_deal_qualify.mjs tests/test_apsales_live_rules.mjs tests/test_apsales_price_confirmation_gate.mjs tests/test_apsales_reusable_evidence.mjs tests/test_apsales_closing_memory.mjs tests/test_apsales_handoff_routing.mjs
.venv/bin/python -m pytest -q tests/test_ai_reply_control.py tests/test_coach_growth_repairs.py tests/test_sales_coach_self_improve.py tests/test_coach_llm_audit.py tests/test_coach_escalation.py tests/test_sales_coach_rule_proposals.py tests/test_sales_coach.py
```

## 文件与交付位置

报告相对路径：`docs/ops/apsales-ai-control-20260910/implementation.md`。

报告绝对路径：`/Users/longhui/Desktop/AsiaPower/docs/ops/apsales-ai-control-20260910/implementation.md`。

```text
docs/ops/apsales-ai-control-20260910/
  implementation.md
  production-baseline.json
  telegram-baseline.json
  telegram-integration-validation.json
deploy/
  telegram-ai-reply-control.patch
  apsales-live-draft/
    apsales-human-takeover.mjs       [新增]
    apsales-reply-control.mjs        [新增]
    apsales-turn-policy.mjs         [新增]
    bridge.mjs                     [修改]
    apsales-whatsapp-session.mjs    [修改]
customer_gateway/ai_reply_control.py [新增]
sales_coach/
  task_status.py                   [新增]
  detectors.py                     [修改]
  self_improve.py                  [修改]
  llm_audit.py                     [修改]
  dispatch_to_cursor.py             [修改]
  escalation.py                    [修改]
scripts/
  apsales-ai-control.py             [新增]
  coach-task-status.py              [新增]
  run-coach-structured.py           [修改]
  run-coach-plan-completion-watch.py [修改]
tests/
  test_ai_reply_control.py          [新增]
  test_apsales_reply_control.mjs     [新增]
  test_coach_growth_repairs.py       [新增]
docs/zijing-training/LIVE-RULES.md   [修改]
```

预览 URL：不适用；操作方式见本报告。没有修改现有网页。

## 发布和回滚

必须按项目 AI Engineering Standard §11/§12 经 CEO 批准、Release Manager 发布，不能把此次本地完成说成线上启用。

生产正在运行的 bridge/session 与本地改动前 HEAD 完全相同；生产 workspace 中的对应源副本缺失。发布时以记录的运行扩展哈希为基线合并，并同步正确源文件，不能盲目使用 workspace 的旧副本覆盖运行版本。

Telegram 指挥中心运行于 `/opt/asia-power/telegram_command_center/telegram_command_center.py`；本轮没有直接改这个生产文件，准备了可应用的补丁。现有允许名单包含管理者私聊和工作群，本控制入口进一步仅接受允许名单中的正数用户 ID 的本人私聊。

建议原子发布顺序：备份及哈希确认 → 安装共享控制模块/脚本和 Telegram 补丁 → 安装 bridge 配套模块及修改 → 受控重启 → 用获授权的测试会话验证人工接管/恢复 → 再确认启用。Coach 文件可在同一审批范围内单独验证部署。不要运行会连带改无关定时任务的宽泛发布动作。

回滚不得删除控制状态、人工暂停消息、held 草稿或历史证据。若需要回退到不支持暂停的旧 bridge，先停用其自动发送；不能让回滚绕过已经生效的人工暂停。

下一步：批准此版本的生产发布；在受控测试会话完成真实手动接管验证。长期成长效果仍应按上线后的新会话衡量。

发布准备：独立分支 codex/apsales-ai-control-20260910；新增 Release Manager 目标 apsales-ai-control，仅更新清单中的 23 个代码/规则目标文件，不覆盖运行数据、不改定时器。隔离工作树复验：48 项 Node 测试、51 项 Python 测试通过。

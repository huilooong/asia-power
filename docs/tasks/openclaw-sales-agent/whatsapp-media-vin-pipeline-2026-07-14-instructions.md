# 修复 +233 WhatsApp 图片/VIN 处理链路 — 实施指令

Status: assigned to Cursor for implementation. Claude role: spec authoring, codebase verification, acceptance review.

## 目标

让客户通过 +233 WhatsApp Business App 发送底盘号、铭牌或车辆文件照片后，系统能够：

1. 下载真实图片；
2. 识别图片中的 VIN；
3. 校验 VIN；
4. 调用现有 VIN 工具解析车辆；
5. 把解析结果交给 OpenClaw sales-agent；
6. 由 sales-agent 正常回复客户；
7. 将确认后的车辆信息写入车辆知识库。

**不要修改** OpenClaw sales-agent 的生产接管架构。
**不要恢复**旧 Python Sales Brain。
**不要新增** Telegram 审批。
只修复媒体输入与 VIN 工具链。

## 已确认根因

当前 WhatsApp QA driver 收到图片后，只向 bridge 返回 media 事件和文字占位，没有暴露图片下载接口或图片字节。因此 sales-agent 当前只收到类似"客户发来图片"的文字，实际看不到图片，也没有 OCR 结果。

此次媒体消息还触发了 `openclaw_reply_not_json`，导致没有生成有效客户回复。这不是 Prompt 问题，也不是 VIN 解析能力本身的问题。

## 任务一：查清媒体对象

检查：
- `startWhatsAppQaDriverSession()`
- `session.waitForMessage()`
- 当前 media message 数据结构
- 底层 Baileys / QA driver 是否已经持有：message key、media type、mime type、filename、media URL、encrypted media metadata、`downloadMediaMessage` 或等效下载能力

输出真实调用链和当前丢弃图片的位置。

## 任务二：为 bridge 暴露受控媒体下载能力

在 WhatsApp QA driver / bridge 边界增加正式媒体下载接口。

要求：
- 支持 image/jpeg、image/png、image/webp；
- 获取真实图片字节；
- 限制最大文件大小；
- 校验 MIME type；
- 使用临时文件或受控 media 目录；
- 文件名不得直接信任客户输入；
- 记录 message_id、sender、mime、size、hash；
- 处理完成后按保留策略删除或归档；
- 下载失败必须留错误日志，不能静默忽略。

禁止把图片 base64 全量写入普通日志。

## 任务三：增加 VIN 图片识别管线

图片 → 图像预处理 → OCR / 视觉识别 → VIN 候选提取 → VIN 校验 → VIN 解析工具

VIN 候选规则至少包括：
- 17 位；
- 排除 I、O、Q；
- 自动清理空格、横线和 OCR 分隔符；
- 支持一个图片出现多个候选；
- 输出候选值、置信度和识别来源；
- 低置信度不得自动写入知识库；
- 识别不到时由 sales-agent 简短请求客户重拍清晰照片或手动发送 VIN。

不要只依赖英文 OCR；底盘号本身按拉丁字母和数字识别。

## 任务四：接入现有 VIN 工具

确认现有 VIN 解析能力的真实入口，并封装成 sales-agent 可调用的受限工具。

工具必须：
- 只读；
- 参数只接受经过校验的 VIN；
- 返回结构化结果；
- 包含品牌、车型、年份、发动机、变速箱等现有工具能确定的信息；
- 明确标记确定值、推测值和未知值；
- 不得伪造解析结果；
- 不允许 Shell、任意文件访问或写配置。

如果现有 VIN 工具暂时不能注册成 Gateway 原生工具，可以由 bridge/adapter 先解析，再把结构化 VIN 结果作为上下文交给 sales-agent，但必须保留清晰的工具边界和审计记录。

## 任务五：传给 sales-agent

不要把图片只转换成"客户发来图片"。应传递结构化上下文，例如：

```json
{
  "message_type": "image",
  "customer_text": "...",
  "media": {
    "mime_type": "image/jpeg",
    "sha256": "...",
    "ocr_text": "...",
    "vin_candidates": [
      { "vin": "...", "confidence": 0.97, "valid_format": true }
    ]
  },
  "vin_decode": { "status": "success | uncertain | failed", "vehicle": {} }
}
```

sales-agent 最终仍只返回：
```json
{ "customer_reply": "..." }
```

内部 OCR、VIN 候选、工具结果和分析不得原样发送给客户。

## 任务六：修复 openclaw_reply_not_json

检查这次媒体消息为什么触发 `openclaw_reply_not_json`。需要确保：
- media 上下文也使用与文本消息相同的严格 JSON 输出契约；
- 可以去除单层 JSON code fence；
- 非 JSON、超时、模型错误必须记录；
- 不能自动调用旧 Python Sales Brain；
- 不能发送内部错误给客户；
- 可向客户发送安全的简短兜底回复（例如请求补发清晰照片），但该回复必须由受控错误路径产生。

## 任务七：车辆知识库写入边界

不要仅凭 OCR 自动永久写入车辆知识库。写入条件：
- VIN 格式校验通过；
- VIN 工具解析成功或得到客户确认；
- 保存来源 message_id 和图片 hash；
- 标记字段来源：OCR / VIN decoder / customer confirmed / inferred；
- 支持后续纠错；
- 不保存不必要的原始客户图片或敏感信息。

## 测试（至少完成）

1. 清晰 VIN 铭牌图片
2. 倾斜图片
3. 低光图片
4. VIN 中含容易误识别的 0/8、1/L、5/S
5. 无 VIN 的普通汽车图片
6. 图片过大
7. 不支持的媒体格式
8. 媒体下载失败
9. VIN 工具失败
10. sales-agent 返回非 JSON

使用脱敏或测试图片完成自动测试。最后使用 CEO 控制号码完成一次真实端到端测试：
CEO 发 VIN 图片 → bridge 下载图片 → OCR 提取 VIN → VIN 校验 → VIN 工具解析 → sales-agent → bridge 自动回复 WhatsApp

## 发布要求

按现有 Release Manager 发布。保留当前 `APSALES_REPLY_BRAIN=openclaw`，不得切回 legacy。部署前备份 driver、bridge 和相关配置。必须有回滚开关，允许只关闭媒体/VIN功能，不影响文本客户接待。

## 输出报告

保存到 `docs/tasks/openclaw-sales-agent/whatsapp-media-vin-pipeline-2026-07-14.md`，写明：图片在哪一层丢失、修改的文件、媒体下载接口、OCR/VIN 管线、VIN 工具入口、知识库写入规则、测试结果、commit hash、Release ID、真实 WhatsApp 测试结果、回滚命令。

这次直接实现、测试并发布，不再只写分析报告。

---

## 已核实的代码事实（供 Cursor 实施前对照，避免基于假设返工）

以下是对本仓库当前代码的真实情况核实结果，均带 file:line。

### 任务一核实结果：图片在哪一层丢失

- `startWhatsAppQaDriverSession` / `waitForMessage` 定义在**仓库外部**的 npm 包 `@openclaw/whatsapp`（`~/.openclaw/npm/projects/openclaw-whatsapp-290d7f7427/node_modules/@openclaw/whatsapp/dist/api.js`），`bridge.mjs:3` 从部署路径 `/root/.openclaw/extensions/whatsapp/dist/api.js` 引入同一个包。
- 返回的消息对象由 `normalizeObservedMessage()`（api.js:120-146）构造，**只包含** `fromJid, fromPhoneE164, hasMedia, kind, mediaFileName, mediaType, messageId, observedAt, poll, quoted, reaction, text`。**不包含** 原始 message key、`mediaKey`、`fileEncSha256`/`fileSha256`、`directPath`，也没有任何 `downloadMediaMessage` 等价能力——原始 Baileys `WAMessage`（真正带加密媒体字段的对象）在 `normalizeObservedMessage` 跑完后就被丢弃了。**这就是图片数据丢失的确切位置**，发生在数据到达 `bridge.mjs` 之前。
- **重要**：同一个 npm 包里其实已经有能真正下载媒体的代码——`dist/monitor-C5_QBO1-.js:533-556` 的 `downloadInboundMedia()`，调用 Baileys 的 `downloadMediaMessage(msg, "stream", {}, {...})`。但这个函数只被**生产接管架构**用的 `monitorWebChannel`/`monitorWebInbox` 监听路径使用，QA driver 路径（也就是 `bridge.mjs` 现在用的）完全没有接入它。
- **给 Cursor 的强约束建议**：任务书要求"不要修改 OpenClaw sales-agent 的生产接管架构"。因此**不要**把 bridge 从 QA driver 切到 `monitorWebChannel`/`monitorWebInbox` 生产监听路径去偷媒体下载能力——那就是在动生产接管架构。正确方向是在 QA driver / bridge 这一侧单独接入媒体下载：可选路径包括（a）在 bridge.mjs 里绕过 `@openclaw/whatsapp` 暴露的窄接口，直接拿到底层 Baileys socket 后自行调用 `downloadMediaMessage`（需要确认 QA driver session 是否暴露了 socket 引用）；或（b）向 `@openclaw/whatsapp` 包提交/本地 patch 一个新的 QA-driver-only 导出函数，复用 `monitor-C5_QBO1-.js` 里同样的下载逻辑，但不改动任何生产监听代码路径。两条路都不碰生产接管架构，只是扩展 QA driver 侧的能力面。**注意** `@openclaw/whatsapp` 是外部 npm 依赖（不在本仓库版本控制内），如果选择本地 patch，必须记录 patch 方式（如 `patch-package`）避免被后续 `npm install`/包更新静默覆盖。
- 占位符文字生成的确切位置：`deploy/apsales-live-draft/bridge.mjs:262-285`（`mediaLabel()` / `textForRouting()`），产出类似"[客户通过 WhatsApp 发来图片，当前桥只收到媒体事件...]"的占位文本，这就是当前发给 sales-agent 的东西。

### 任务二相关：bridge 现状

`deploy/apsales-live-draft/bridge.mjs`（410 行）流程：`main()`(369-404) → `startWhatsAppQaDriverSession` → 循环 `session.waitForMessage` → `handleMessage()`(287-367) → `textForRouting()` 拼文字+`mediaPlaceholder` → `runOpenClawReply()`(98-158) shell 出去调 `openclaw agent --agent sales-agent ... --json` → `parseAgentReply()`(84-96) 解析 → `session.sendText()`。目前**没有任何**下载/OCR/VIN 提取代码，只有占位符标签。

### ⚠️ 紧急更正（2026-07-14，晚于本文档其余内容）：VIN 工具选型此前判断错误

**之前本文档推荐用 `server/lib/vin/decode-route.js`（QXB）做 adapter 是错的，请忽略下面"任务四核实结果"里那条建议，改用本节的结论。**

CEO 确认：仓库里有**两套互不兼容**的 VIN 解析系统：
- **QXB（汽修宝数据开放平台）** —— 只解析**国内**车辆，专供**子龙**（QXB 供应商上传/审核训练用），**明确不接入 APSales**。`sales_core/vehicle_intelligence.py:12` 原话："QXB = 子龙 only; not wired to APSales."
- **AsiaPower Vehicle Intelligence** —— 专供 **APSales（子敬/鲁肃）**，解析链路是"AsiaPower VIN 知识库缓存 → NHTSA vPIC（海外/国际车辆，Phase 1 主力）→ corgi 离线兜底（Phase 2+，未实现）→ 人工复核"。入口函数：`sales_core/vehicle_intelligence.py:422` 的 `enrich_from_vin(text_or_vin, root=None, allow_external=True, timeout=8.0) -> VehicleSnapshot`，或更高层的 `enrich_and_decide(customer_message) -> CustomerIntelligenceResult`（562行，内部调 `enrich_from_vin` 再跑 commercial decision）。两者都有完整单测：`tests/test_vehicle_intelligence.py`、`tests/test_commercial_decision_v1.py`。

**+233 客户 = 海外客户，必须走 AsiaPower Vehicle Intelligence / NHTSA 这一套，绝对不能用 QXB/decode-route.js**，否则 CEO 警告的"结果无法解析"就会发生——QXB 只认得中国大陆车辆的 VIN 结构。

**已有现成参考实现，不用从零设计**：`scripts/whatsapp_cloud_sandbox_reply.py:278-296` 已经在用 `enrich_and_decide` + `build_whatsapp_reply` 给 WhatsApp 客户生成回复（目前只处理文字消息里正则提取的 VIN，还没接 OCR）。`bridge.mjs` 自己也已经有 spawn Python 子进程的现成写法（4/14/55/71/120行，`PYTHON = ${WORKSPACE}/.venv/bin/python3`，`spawn(PYTHON, [scriptPath], { cwd: WORKSPACE })`）。

**Task 4 的正确做法**：bridge/adapter 侧新建一个小的 Python 入口脚本（仿 `whatsapp_cloud_sandbox_reply.py` 的调用方式），接受 OCR 提取出的 VIN 候选字符串，调用 `enrich_from_vin(vin, allow_external=True)`，返回结构化 `VehicleSnapshot`（含 brand/model/year/engine_code/engine_desc/transmission/plant_country/provider_source/verification_status/confidence 等字段，`to_public_dict()` 已经做好 VIN 脱敏），再由 bridge.mjs 通过既有的 `spawn(PYTHON, ...)` 模式调用。不要碰 `server/lib/vin/decode-route.js` / `qxb-client.js`，那条链路留给子龙用。

### 任务四核实结果（⚠️ 已被上面的紧急更正覆盖，仅作背景参考，不要照此实施）

有两套，都不是"开箱即用可注册为 Gateway 工具"：
- `tools/vin_tool.py:1-107` 的 `VinTool` —— 只做**缓存命中查询**（`data/knowledge-base/vin-cache.json`），未命中时返回"未配置/未接入"提示（55-78行），**不是真正的解析器**。它注册在 `tools/registry.py:14,61`，但那是给 APCOO 用的独立 Python CLI 工具框架，跟 OpenClaw Gateway 无关。
- `server/lib/vin/decode-route.js:31-137` (`createVinDecodeHandler`) 才是**真正能工作**的 VIN→车辆信息解析器：调 QXB API（`qxb-client.js` 的 `decodeVin()`）→ `mapping-layer.js` 的 `applyMapping()` → `localize.js` 本地化，返回 `brand, model, year, engineCode, transmissionCode, gearboxModel, displacement, fuelType, drivetrain`。它现在是挂在内部库存/供应商后台服务器上的 HTTP 接口：`POST /api/vin/decode`（挂载于 `server/half-cut-local-server.js:19,33,432` 和 `deploy/inventory-site-server.js:434,1559`），**不是**一个可以直接 import 的函数或 Gateway 工具。
- 仓库自己已经在 `docs/tasks/openclaw-sales-agent/sales-agent-draft-contract.md:103` 写明这个缺口："库存、VIN、知识库、报价的生产工具尚未作为 Gateway 的受限工具注册；因此后续接入前必须为它们建立只读、参数校验、审计可追踪的 Adapter。" —— 与任务书 Task 4 的降级方案（bridge/adapter 先解析，再把结构化结果交给 sales-agent）完全吻合，**照这个降级方案做即可**，不必强行把 `decode-route.js` 注册成 Gateway 原生工具。Adapter 侧建议直接内部调用 `server/lib/vin/decode-route.js` 里的解析逻辑（同进程函数调用或本地 HTTP 调用均可），而不是新写一套 VIN 解析。

### 任务六核实结果：openclaw_reply_not_json

抛出位置：`deploy/apsales-live-draft/bridge.mjs:91`，在 `parseAgentReply()`(84-96) 里——去掉一层可选的 ```json fence 后 `JSON.parse`，失败就抛这个字符串。这个严格 JSON 校验是**统一应用**在 `runOpenClawReply()`(98-158, 调用点145行) 上的，文字消息和媒体占位符消息走的是**同一条路径**，目前没有为媒体单独放宽或收紧。失败时在 `handleMessage()` 的 try/catch(359-366) 里被捕获：记日志、写入 activity stream、发 Telegram 告警——**目前不会给客户发任何回复**（既不发错误，也不发兜底话术）。所以任务书 Task 6 要求的"可向客户发送安全的简短兜底回复"是**新增能力**，不是修复既有逻辑；根因更可能是"没把媒体上下文喂给 sales-agent，导致它生不出合法回复"，而不是 JSON 解析本身有 bug。

### 任务七背景 / 附带发现（与本次任务无直接关系，仅供知悉）

`sales_core/apsales_handler.py` 和 `customer_gateway/draft_queue.py` 都属于 **legacy Python Sales Brain** 路径（`bridge.mjs:343-358` 的 `REPLY_BRAIN==="legacy"` 分支），任务书明确不让碰。附带发现：`bridge.mjs:15-16` 引用的 legacy 兜底脚本 `scripts/apsales-live-sales-brain.py`、`scripts/apsales-record-draft-learning.py` 在本仓库工作区和 git 历史里都**不存在**（`git log --all` 查无），如果 legacy 分支真的被触发会直接报错——这是个独立于本任务的潜在隐患，仅记录，不在本任务范围内处理。

### 发布/回滚要求核实

`scripts/lib/release-manager.mjs`（623行）和 `scripts/deploy-production.mjs` 都存在且是最新的，`deploy-production.mjs` 已有 `apsales-openclaw` 部署目标（`deployApsalesOpenClaw`），带 pre-deploy validation、远程快照（`snapshotRemotePaths`）、post-deploy validation。**但没有现成的 `--rollback` 命令/flag**（grep 未命中）。目前文档化的回滚方式是手动的：翻 `docs/tasks/openclaw-sales-agent/production-cutover-2026-07-14.md:85-102` —— 改 `APSALES_REPLY_BRAIN=legacy` 的 systemd env drop-in 再 `systemctl restart`，或从 `/root/.openclaw/releases/apsales-openclaw-<timestamp>/` 恢复备份的 `bridge.mjs`。任务书要求的"回滚开关，允许只关闭媒体/VIN功能"**需要新建**——建议加一个独立的 env flag（例如 `APSALES_MEDIA_VIN_ENABLED=false`），让 bridge 在关闭时直接回退到当前的占位符文字行为，而不是牵动 `APSALES_REPLY_BRAIN` 整体切换到 legacy（那个开关粒度太大，且 legacy 分支的兜底脚本还缺失，风险更高）。

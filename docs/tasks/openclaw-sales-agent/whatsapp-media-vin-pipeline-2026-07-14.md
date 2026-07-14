# WhatsApp 图片 / VIN / 语音管线 — 最终报告（2026-07-14）

Status: **Phase 1 生产已上线**；**Phase 2 follow-ups（语音 STT / 云端 Vision / JDM 调研 / 10 场景测试）代码与调研已齐，云端密钥待 CEO 定供应商后启用**。

## 结论（先看这个）

| 项 | 状态 |
|---|---|
| +233 图片下载 → OCR → Vehicle Intelligence → 自动回复 | ✅ 已上线 |
| 只关媒体/VIN、不关文字接待 | ✅ `APSALES_MEDIA_VIN_ENABLED=false` |
| 语音消息下载 + STT 适配骨架 | ✅ 代码就绪；默认 `APSALES_STT_PROVIDER=none`（未选供应商不扣费） |
| 云端 Vision OCR（手写体 / 小铭牌） | ✅ 适配就绪；默认仍 `tesseract`，缺 key 自动回退 |
| 日系车台番号现成解码服务 | ✅ 调研完：**没有** NHTSA 级公开 API；Phase 1 继续铭牌标签解析 |
| 10 项自动化测试 | ✅ `tests/test_apsales_media_vin_pipeline.py` 12/12 通过 |
| CEO 拍板启用 Google Vision / OpenAI STT | ⏳ 待决策（见调研文档） |

---

## 今晚三个独立故障根因（勿混为一谈）

| # | 根因 | 表现 | 修复 |
|---|---|---|---|
| 1 | OCR 崩溃：`frame_no` 为 `None` 仍 `.startswith()` | 图片路径异常 / 无回复 | commit `6a9bc2929` |
| 2 | OCR 墙钟时间无上限，并发把 3.8GB VPS 打满 | 单次 OCR 到 ~306s | commit `76320d324`（20s 墙钟 / 10s 子超时） |
| 3 | 生产全局默认模型 ID 失效：`openrouter/google/gemini-2.5-flash-preview` | 大量“像限流”的失败 | **仅改生产** `~/.openclaw/openclaw.json`（不在 git）；备份 `~/.openclaw/openclaw.json.bak-20260714T080645Z` |

另：OCR 成功后 LLM 仍回“请发更清晰照片”——会话历史污染；已用**确定性铭牌成功/失败回复**绕过 LLM（commits `144dfcc65` / `11e31abdd`）。

---

## 时间线（摘要）

1. **图片丢失根因**：QA `normalizeObservedMessage` 丢掉 Baileys raw media → 新建 `apsales-whatsapp-session.mjs`（**不**迁到 monitor 生产 inbox）。
2. **管线**：下载 → tesseract OCR → `enrich_from_vin` / 日系铭牌 facts → 结构化上下文 → `sales-agent`；失败/超时客户安全兜底。
3. **CEO 实拍**：日系铭牌 `SCP90-…` / `2SZ-FE` 被误当“要更清晰 VIN”；修好 FRAME 解析 + 确定性回复。
4. **并发事故**：根因 1+2+3 叠加；分别修复。
5. **Follow-ups（本轮）**：语音 STT 骨架、Vision API 适配、JDM 调研、10 场景测试、本报告重写。

---

## 图片在哪一层丢过（任务一）

| 层 | 事实 |
|---|---|
| QA driver `normalizeObservedMessage` | 只留 `hasMedia/mediaType`，丢 mediaKey 等 raw |
| 旧 bridge | `textForRouting` 只发「客户发来图片」占位 |
| 修复 | `apsales-whatsapp-session.mjs` 保留 raw + `downloadInboundImage` / 通用 `downloadInboundMedia` |

---

## 当前架构

```
WhatsApp (+233 Business App)
  → apsales-whatsapp-bridge (QA session)
      → image? downloadInboundImage → OCR (tesseract|google|openai) → intelligence → mediaContext
      → voice? downloadInboundAudio → STT (none|openai|google|assemblyai) → transcript as text
      → 成功铭牌：deterministic reply（跳过 LLM）
      → 失败铭牌 / STT 失败：deterministic 短回复
      → 普通文字 / 成功转写：openclaw agent --agent sales-agent → JSON customer_reply
```

**不用**：Python Sales Brain、Telegram 审批闸、QXB VIN。

---

## 修改 / 新增文件

### Phase 1（已发布相关）

- `deploy/apsales-live-draft/apsales-whatsapp-session.mjs`
- `deploy/apsales-live-draft/bridge.mjs`
- `scripts/apsales-media-vin-ocr.py`
- `scripts/apsales-media-vin-intelligence.py`
- `scripts/deploy-production.mjs` / `scripts/lib/release-manager.mjs`

### Phase 2（本轮 follow-ups）

- `scripts/apsales-media-stt.py` — STT 适配（供应商 env 切换）
- `scripts/apsales-media-vin-ocr.py` — Google/OpenAI Vision + 标签化解析 + VIN 重叠扫描修复
- `deploy/apsales-live-draft/bridge.mjs` — 语音上下文 / 失败确定性回复
- `deploy/apsales-live-draft/apsales-whatsapp-session.mjs` — audio MIME + `downloadInboundAudio`
- `tests/test_apsales_media_vin_pipeline.py` — 10 场景自动化
- `docs/tasks/openclaw-sales-agent/vendor-research-vision-stt-jdm-2026-07-14.md` — 供应商/JDM 调研
- `docs/tasks/openclaw-sales-agent/whatsapp-followups-2026-07-14.md` — 任务书

---

## 能力清单

| 能力 | 说明 |
|---|---|
| 媒体下载 | jpeg/png/webp；ogg/mpeg/mp4 等音频；默认 8MB；hash 审计，不打 base64 |
| OCR | 默认 tesseract；`APSALES_OCR_PROVIDER=google\|openai` 走云端，失败回退本地 |
| 解析 | 17 位 VIN → AsiaPower VI → NHTSA；日系 FRAME → 铭牌标签 facts（非假 NHTSA） |
| 语音 | 下载 + STT；`provider=none` 时确定性请客户打字 |
| sales-agent | 结构化 `media`；短回复规则；非 JSON/超时客户安全兜底 |
| 知识库 | 仅 `vin_knowledge_pending.jsonl`（pending_confirm），不自动永久入库 |
| 防挂死 | Gateway 子进程硬超时 `timeout+15s` SIGKILL；OCR 墙钟上限 |

---

## 回滚

**只关媒体/VIN（文字接待继续）：**

```bash
# on production
Environment=APSALES_MEDIA_VIN_ENABLED=false
# systemctl daemon-reload && systemctl restart apsales-whatsapp-bridge.service
```

**只关语音 STT：**

```bash
Environment=APSALES_VOICE_STT_ENABLED=false
# 或保持 APSALES_STT_PROVIDER=none（默认）
```

**云端 OCR 未就绪时保持：**

```bash
Environment=APSALES_OCR_PROVIDER=tesseract
```

系统包回滚一般不必：`apt-get remove tesseract-ocr`。

---

## 供应商建议（待 CEO）

详见 `vendor-research-vision-stt-jdm-2026-07-14.md`。

| 决策 | 推荐 | 粗算月费（低量） |
|---|---|---|
| Vision OCR | **Google Cloud Vision** `DOCUMENT_TEXT_DETECTION` | 约 $0–8（含免费档） |
| STT | **OpenAI** `gpt-4o-mini-transcribe` | 约 $1.5–4.5 |
| JDM 车台番号 | **不买假“解码 API”**；继续铭牌 OCR；可选后期 jdmvin/Carapis | Phase 1 = $0 |

勾选请 CEO 在调研文档勾决策框；**未批密钥前生产勿改 `APSALES_OCR_PROVIDER` / `APSALES_STT_PROVIDER`。**

---

## 验证

### 本地（本轮）

| 项 | 结果 |
|---|---|
| `node --check` bridge + session | ✅ |
| `py_compile` OCR / STT / intelligence | ✅ |
| `python -m unittest tests.test_apsales_media_vin_pipeline -v` | ✅ **12/12 OK**（约 25s） |

### 10 场景覆盖

1. 清晰 VIN 铭牌（合成图 + 标签解析）
2. 倾斜
3. 低光 + 日系 FRAME 标签
4. 易混字符（O/0 等）
5. 无 VIN 图
6. 超大图不崩溃
7. 不支持格式 / MIME 闸
8. 下载失败形态（图/音频/STT disabled）
9. VIN/intelligence 失败与 jp_frame 成功
10. sales-agent 非 JSON 回复

### 生产 E2E（当晚）

- CEO 控制号实拍铭牌：OCR/确定性回复路径已验证（细节见当晚 bridge 日志）。
- **勿再用生产号当唯一回归环境**——独立测试号/沙箱是流程债（任务书已点名）。

---

## Release 记录（Phase 1 媒体管线）

- 早期媒体发布：Git `1ea65907b` / Release `REL-20260714052129-apsales-openclaw-1ea65907b`
- 后续热修链：`d52409d25` → `144dfcc65` → `11e31abdd` → `6a9bc2929` → `76320d324` 等（见 `git log`）
- 备份目录：`/root/.openclaw/releases/apsales-openclaw-*`
- Env 现状意图：`APSALES_MEDIA_VIN_ENABLED=true`，`APSALES_OCR_PROVIDER=tesseract`，`APSALES_STT_PROVIDER=none`

Phase 2 代码入生产须走：**commit → push → `node scripts/deploy-production.mjs apsales-openclaw --yes`**（CEO 批准后）。

---

## 下一步（需 CEO）

1. 选定 Vision / STT 供应商并开 key（推荐表见上）
2. 批准后部署 Phase 2 + 用控制号各测：手写登记证、小铭牌远景、一条语音
3. （流程）准备独立 WhatsApp 测试号，避免再用生产线当实验室

---

## 相关文档

- 任务书：`whatsapp-followups-2026-07-14.md`
- 调研：`vendor-research-vision-stt-jdm-2026-07-14.md`
- 当晚 cutover：`production-cutover-2026-07-14.md`
- 工程标准：`docs/architecture/ai-engineering-standard-v1.md`

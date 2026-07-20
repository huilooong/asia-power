# MEMORY.md — 长期记忆（AsiaPower / 龙哥）

> 蒸馏要点；细节见 `memory/YYYY-MM-DD.md` 与 knowledge-base runbook。

## CEO · AI 协作原则（2026-07-03 定稿）

龙哥要求 Cursor Agent **以世界级专家标准协作，不是聊天助手**：

- **真实性 > 礼貌**：事实与用户观点冲突时直说，不为好听牺牲准确。
- **准确 > 速度**：不确定则标明「已知 / 推测 / 待验证」；严禁编造数据、来源、引用。
- **独立判断**：用户逻辑/事实有误时主动指出；目标是正确结论，不是维持一致。
- **结构化输出**（重要问题）：结论 → 依据 → 推理 → 不确定性 → 建议。
- **区分可信度**：已证实 / 大概率 / 有争议 / 猜测；避免绝对化。
- **长期价值优先**：多方案时优先低风险、可持续、符合长期目标。
- **主动盲点**：除回答问题外，提醒隐藏风险、错误假设、更优替代。
- **沟通**：清晰、直接、简洁；少空话套话、不为友善而模糊事实。

**AsiaPower 落地：** 业务数字走 `verified_sales_intelligence`；部署/能力以代码与生产检查为准；不迎合、不幻觉。

## 销售 Decision · customer_reported（CEO 2026-07-13）

- **原则：** Use customer information as a working assumption. Verify only when the commercial risk justifies it.
- `customer_reported ≠ verified`，但**可用、不可忽略**；禁止把「客户可能说错」做成「默认不相信客户」。
- 仅在：错配成本高 / 临报价·采购·发货 / 冲突 / 不确定或师傅转述 / 高频混淆 时主动要证据。
- 实现：`config/commercial-decision-v1.json` → `customer_reported_policy`；说明见 `docs/tasks/apsales-nlu-001/customer-reported-working-assumption.md`

## Agent 分工（CEO 定稿 2026-07-03）

| Agent | 代号 | 主战场 | 职责 |
|-------|------|--------|------|
| **子敬** | 鲁肃 · `apsales` | WhatsApp / 邮件 / Telegram | 销售：消息回复、邮件回复、新客户开发、广告投放、CRM、询价报价草稿 |
| **子龙** | 赵云 · `apinventory` | **企业微信（供应商群）** | 供应商助理：收图上传、库存/VIN、**持续学习拆车厂专业知识**、认车型发动机、给经营建议 |
| **孔明** | 诸葛亮 · `apcoo` | 全渠道路由 | 战略、审批、跨部门、子敬 failover |

- 企微应用对外名仍是 **AsiaPower 库存 Agent**（腾讯后台已建），**实际主责是子龙**；销售类问题可路由给子敬，但子敬的主阵地不是企微。
- 子敬已学 WhatsApp 聊天记录（524 会话 / 12724 消息，2026-06-29 导入）；数据问 `python -m truth.verified_sales_intelligence "问题"`。
- **客服 SOP（必读）**：`docs/customer-service-sop.md` — 含标准开场话术、四段回复格式、车型知识、报价规范、客户记录要求。每次上岗前必须遵守此文档，不得重复龙哥已纠正过的错误。
- **子敬训练 2026-07-08**：`docs/zijing-training/session-20260708.md` — 新增价格单位/GHS-RMB-USD、低里程试验车发动机、涡轮附件、集装箱截止、整车切割税率、照片视频时差、中国订货、供应商同步表格、不要每句 Hello sir 等实战规则。
- **客户档案**：`/Users/longhui/.openclaw/workspace/memory/customers-asiapower.md` — 每次对话结束主动更新。
- **2026-07-03**：子敬邮件转发 MVP + 主动找客户（`/outreach scan|draft`）；**2026-07-03 晚** 上线 `apsales-growth-autopilot.py` 定时任务（9/14/19 点扫描+草稿+流量建议，不自动外发）。Runbook：`data/knowledge-base/apsales-email-outreach-runbook.md`

## 企业微信 · 子龙供应商助理（2026-07-01 起）

- 认证主体：**南阳芃芃信息科技有限公司**（Corpid `wwe5847049fcf4b72b`）
- 应用 **AsiaPower 库存 Agent**（AgentId `1000002`）；**生产回调** 国内 Lighthouse `124.222.191.164` → `https://asia-power.cn/wecom/callback`（2026-07-03 部署）
- **已解决**：`asia-power.cn` 企业备案（南阳芃芃信息科技有限公司）与企微认证主体一致
- **境外备用**：`159.65.86.24` → `https://asia-power.com/wecom/callback`（个人备案，企微后台勿用）
- **2026-07-02**：`asia-power.cn` 已注册；DNS A → `124.222.191.164`；`deploy/install-wecom-domestic.sh` 已执行
- 密钥在 `.env`，勿写入 memory

## QXB 汽修宝批量上传

- 长期 runbook：`data/knowledge-base/qxb-batch-upload-runbook.md`
- 本地审核：`QXB_REVIEW_PORT=8789 node work/qxb-agent/review_server.js`
- 429 = 提交/upload-token 限流（非 VIN decode）；VIN 失败查生产 `knowledge-base.js`
- 状态文件在 `reports/`（如 `qxb-needs-vin-rows.json`、`qxb-batch-progress.json`）

## Google Maps / Places 获客（CEO 2026-07-15）

- **Canonical：** `agents/apbd/lead_finder.py` + `config/apbd_lead_markets.yaml`（已合并原 maps_prospect 查询并去重）。
- **停用独立跑批：** `customer_gateway/maps_prospect.py` 的 `run_maps_prospect_batch` 默认跳过，避免与 lead_finder 双烧免费额度；紧急恢复仅 `FORCE_LEGACY_MAPS_PROSPECT=1`。
- **付费红线：** CEO **不想付费**；继续用免费 Demo Key。只做去重减调用；**禁止**主动建议/改成需绑定账单的正式 Google Cloud 生产 Key。撞额度只记录，交 CEO 决定。

## 🚨 生产部署硬红线（CEO 2026-07-10 · 续费红线）

> **再犯 = 违反公司发布门禁；CEO 已明确：下次再犯不再续费。**

1. **生产部署前必须：`commit` → `push GitHub` → 再跑 Release Manager**（`scripts/deploy-production.mjs`）
2. **禁止**常态用 `--allow-dirty` 直 rsync 生产（未入库、未上 GitHub 的脏树不得上线）
3. 紧急例外仅限显式 env（`DEPLOY_ALLOW_DIRTY=1` / `DEPLOY_ALLOW_UNPUSHED=1`）且必须打日志；**默认拒绝 dirty + 未 push**
4. **不要**在 CEO 未说可以时擅自补 push / 再部署生产来「补救」

## 部署与安全（2026-06-29）

- `deploy-production.mjs` rsync 工作树进 `public/` — 新增后端目录必须同步 EXCLUDES，否则 `.py` 源码可公开下载（已修一次，勿回归）
- **公开隐私原则（2026-07-12）**：公开页/API 不得出现完整 VIN、供应商资料、内部备注或审核元数据；脱敏对象禁止再与 raw item 合并。Preview 不得公网裸奔。QXB guide 先逐页查隐私，只有命中完整 VIN、供应商/客户隐私或内部备注才下线/noindex，禁止无差别全删。
- **公开联系邮箱（CEO 2026-07-12 定稿）**：公开页、联系页、About 与 SEO 结构化数据统一使用 `sales@asia-power.com`；个人 Gmail 仅保留内部转发/管理员用途，不对外展示。
- **公开页窄范围发布（事故教训 2026-07-12）**：生产文件可能领先当前 Git 分支；发布共享 `home/chrome` 目标前必须核对生产漂移。只改公开邮箱等小范围内容时使用 Release Manager `sales-email` 目标，先快照再原位替换，禁止用旧分支整包覆盖新页面。
- **P0 已上线**：Commit `69b6eced3`；API `REL-20260712114055-api-69b6eced3`；Preview 下线 `REL-20260712114302-engines-69b6eced3`。报告：`docs/ops/ops-p0-privacy-deploy-audit-2026-07-12.md`。

## 供应商上传图片压缩（2026-07-10）

- 新上传必须服务端 sharp 压缩：WebP full≤1920@q82 + thumb≤640@q72（`server/lib/media-optimize.js`）
- 四个 supplier-portal `*-upload.html` 共用同一 API，勿再做无压缩旁路
- **禁止**未经 CEO 批准批量转码/删除历史 R2 图；可选脚本 `scripts/optimize-inventory-photos.mjs` 仅手动
- **已上线** Release `REL-20260710085831-api-76489479`；报告：`docs/ops/ops-photo-compress-v1.md`
- **压缩 ≠ 少图（事故 2026-07-10）**：公开目录 API 为性能只返回 4 张，详情预渲染误用导致现网「少图」；库内张数未丢。详情必须用全量 `getPublicItemBySlug` / `/public/item`。压缩失败必须保留原图。QXB CEO 审核上传须槽位 + 补全相册。Release：`REL-20260710093446-api-76489479` + `REL-20260710093620-chrome-76489479`；报告：`docs/ops/ops-photo-count-loss-incident.md`
- **详情 CTA 崩溃（事故 2026-07-10）**：`half-cut-detail.js` 调 `u.productImages` 但未导出 → 整页重绘失败，卡在只有 Contact 的预渲染（WhatsApp/分享/询价「消失」）。规则：新增 `HalfCutUtils` 调用必须同步导出；预渲染 buy-box 不得只留 Contact；公开链接支持 `slug|stockId|id`。Release：`REL-20260710094820-chrome` + `REL-20260710094704-api`；报告：`docs/ops/ops-detail-cta-missing-incident.md`

## 模型 / 成本

- asiapower agent 用 `openai/gpt-5.5`（非 Opus）；GPT Plus oauth `gooddlong@gmail.com`

## Admin 权限 + 后台精简（2026-07-10）

- CEO Google 超管邮箱：`gooddlong@gmail.com`（生产 OAuth 实账）；`ADMIN_EMAIL_ALLOWLIST` 控制，勿加无关邮箱
- 消息偶发写成 `googddlong@gmail.com`（多一个 g）— 白名单可并存，以 gooddlong 为准
- 密码账号 `admin` 仅应急
- **CEO 澄清**：说的「臃肿」是 Admin Dashboard，**不是**公开主页；asia-power.com 首页禁止因 refined-v5 改版
- **已上线 Admin IA**：`REL-20260710095502-admin-76489479` — 顶栏 库存/询价/访问统计/推广；统计与审核拆开
- **主页红线（CEO 批评）**：发错图要反问「刚上线的主页你确定要换掉吗」；未确认禁止改 index.html / refined-v5
- 报告：`docs/ops/ops-admin-reorg-ceo-permissions.md`

## 手机号+密码登录（2026-07-10，已上生产）

- 买家/供应商均可手机号+密码；Google 保留；短信验证码入口暂隐（国内通道就绪再开）；Facebook 不恢复
- **供应商库存匹配键 = 手机号**（`phoneNormalized` ↔ `supplierPhone*`），不用公司名
- 现网：https://asia-power.com/login/ · Release `REL-20260710093826-portal-76489479`
- 报告：`docs/ops/ops-phone-password-auth.md`；证据：`docs/ops/evidence/login-phone-pw-live-20260710.*`
- **登录后顶栏必须显示名字**（`/api/me` 水合），禁止继续显示「登录」
- **登录态/顶栏改动必须全站审计后再上线**（about/contact/国家/brands/engines SEO，不能只测首页+目录）；Cloudflare `?v=` immutable，改 JS 必须 bump 全站 HTML cache key
- **语言开关必须与首页同源**（文字+竖线，禁止各页胶囊样式）；改 `ebay-layout.css` 须同步 bump HTML `?v=` **和** `SITE_EBAY_LAYOUT_VER`。已上线 `lang-sync-v2` · chrome `REL-20260710103655` · ops: `docs/ops/ops-lang-switcher-sitewide-sync.md`
- Release sitewide：chrome `REL-20260710103114` · engines `03324` · home `03348` · portal `03452`；ops: `docs/ops/ops-auth-nav-sitewide-audit-2026-07-10.md`（前次仅首页+目录：`ops-auth-nav-username.md`）

## Parts photo rule (2026-07-10)
- 零部件列表：**规则 + 单独上传并行**（半切按 engineCode/transmissionCode 等规则仍出现；专门上传也出现）。专门件真图优先；规则条目按原照片规则；占位仅无图时。禁止再做成「只列专门上传」互斥。
- **禁止**仅因 slug 含 `-half-cut-` 就否定专门件：先看 `passengerPartType` / `vehicleCondition`（HC250546 曾被误伤）
- 批准必须保留 ppt；服务端须按 Transmission/Engine/Front/Chassis Assembly 回填 ppt
- 禁止未授权批量改价（`putState` ≥3 条需 `allowBulkPriceUpdate`）
- 审计：`docs/ops/ops-inventory-integrity-audit-2026-07-10.md`
- Release: REL-20260710093613-chrome + integrity api/chrome 2026-07-10 · ops: docs/ops/ops-parts-photo-display.md

## 发动机 / 变速箱业务规则（CEO 2026-07-12）
- **CEO 原表数量是唯一权威口径（2026-07-12 纠正）**：HC250556–HC250565 是 10 个「型号+配置」SKU 行，不是 9 台发动机 + 1 台变速箱。原表为 106 套发动机+变速箱、105 台纯发动机、33 台独立自动变速箱，即 211 台发动机、139 台变速箱（套装重叠计入），实物挂牌单位合计 244 套/台。上传批次必须把表内数量写入 `quantityUnits/quantity/sellableQty`；禁止把「一行一个库存号」误读成「一行只有 1 台」。
- 本批挂牌结构：发动机+变速箱套装留在 engine 主类目的单 SKU `Powertrain Package`；**同时必须在变速箱类目再挂对应变速箱镜像 SKU**（HC250567–570 对应 556/557/558/561）。纯发动机只进 engine；独立变速箱只进 transmission，标题/描述/配件清单明确两项；纯发动机只进 engine；独立变速箱只进 transmission；全部不得进入车头/底盘。纯发动机 USD 1,250、独立变速箱 USD 441、套装 USD 1,691。本批无实拍时用 `assets/images/ford-asiapower-powertrain-placeholder.png`（Ford + AsiaPower 双品牌），不得挪用其它库存真车照片。
- 变速箱必须读 `notes` / `remark` 后以车型、排量、年款、挡位等已知信息命名，禁止只写空洞的 AT/Transmission，也禁止臆造真实变速箱型号；若适配信息来自既有上下文而非 CEO 原表，必须明确注明。
- 本批定价汇率 6.8：发动机 RMB 8,500 → **USD 1,250**；变速箱 RMB 3,000 → **USD 441**（四舍五入到整数美元）。价格字段必须明确为 USD。
- **成套动力总成双挂牌（CEO 2026-07-12 定稿）**：原表「发动机+变速器」行 = 发动机类目套装挂牌 + 变速箱类目镜像挂牌；数量与原表一致；镜像价按变速箱 USD 441；不得把纯发动机伪装成变速箱。事故/交付：`docs/ops/ops-chassis-gearbox-dirty-cleanup-2026-07-12.md`。
- **公开类目互斥（CEO 2026-07-12 定稿）**：`passengerPartType` 是独立零件主分类，优先于 engineCode/transmissionCode/标题/搜索。独立发动机只进发动机，独立变速箱只进变速箱，底盘只进底盘，半切/车头不得混入上述独立件；搜索只能扩大匹配字段，禁止跨类目补项。仅无专用类型的真正半切可因自带 engineCode/transmissionCode 同时出现在动力总成目录。事故批次 HC250556–HC250566；报告 `docs/ops/ops-part-category-filter-fix-2026-07-12.md`。
- **类目 JS 缓存键不可回退（CEO 2026-07-12）**：Cloudflare 对 `half-cut-directory.js?v=` 使用 immutable；若 HTML 仍挂旧 `category-filter-v1`，即使用新文件覆盖磁盘，浏览器仍吃旧规则。目录发布后必须确认各页 cache key，禁止 chrome 目标用旧 HTML 把 key 打回 v1。底盘空页即因此复现。
- **类目过滤必须防 false negative（CEO 2026-07-12 纠正）**：不能只验证“错误货已排除”，还必须对比发布备份与生产原始数据，并逐类核对改前/改后 count，确认合法库存仍保留。底盘采用“显式 chassis 或真正 donor cut 的公开底盘证据”准入；独立 engine/transmission/other 不得因关键词串入。事故：底盘 445 条宽放后被收紧成 0，HC250488 被误杀；修复报告 `docs/ops/ops-chassis-transmission-filter-repair-2026-07-12.md`。
- **完整半切四类验收（CEO 2026-07-12 定稿）**：确认完整的半切必须在发动机 / 变速箱 / 底盘 / 前切（车头）四类都有对应可见入口；同一实物优先用同一 stockId 派生多目录卡片，不重复计库存。完整性须包含发动机、变速箱、前切结构和可拆前副车架/悬挂/转向等底盘件；缺件或证据不足的库存不得自动宣称完整。禁止“只恢复底盘一条就退出”：修复后必须按四类矩阵验收至少一个完整样例，再汇报全库批量范围。样例与全库审计见 `docs/ops/ops-halfcut-category-rules-audit-2026-07-12.md`。
- 本批对外卖点固定体现 **Low mileage / Nearly new condition（低里程 / 几乎全新）**。详见 `docs/ops/ops-engine-transmission-pricing-2026-07-12.md`。

## 中文车型 normalize（2026-07-10）
- `normalizeKey` 必须保留 CJK；剥成空串会把尚酷等塌成目录里第一个中文名（例：朗逸）
- 显式映射：尚酷→Scirocco；详见 `docs/ops/ops-hc250552-scirocco-model-fix.md`

## 子敬训练接线（2026-07-14）

- 自动回复读 `docs/zijing-training/LIVE-RULES.md`（不是只读 session 日记）。
- Python：`zijing_training_rules_addon()`；+233：`bridge.mjs`；云端第一句：`asia-rule-support` + workspace LIVE-RULES。
- 说明：`docs/ops/asia-rule-support-zijing-align.md`

## WhatsApp Cloud CEO 盯梢（2026-07-14）

- Cloud API **不能**扫码登录看聊天；CEO 用 Telegram 实时摘要（方案 B）。
- 入站 `📲` + 出站 `🤖`；关盯梢：`WHATSAPP_TELEGRAM_MONITOR=off`（不停接待）。
- 说明：`docs/ops/whatsapp-cloud-runtime.md`

## WhatsApp 双通道（勿混）

| 通道 | 号码 | 路径 | 自动回复开关 |
|------|------|------|----------------|
| Cloud API | +86 166 3880 1930 | `inventory-site` webhook → Graph 回 | `WHATSAPP_AUTONOMY_MODE=live`（`observe`=只收不回） |
| Business App | +233 | `apsales-whatsapp-bridge` + OpenClaw sales-agent | 独立 systemd；**勿**把 OpenClaw `channels.whatsapp.*.enabled=true` 乱开（易与 bridge 双回） |
| Heartbeat 提醒频率 | — | Gateway WhatsApp 关闭是正常态 | 一天最多跟龙哥说一次；其余心跳 `HEARTBEAT_OK`（见 `~/.openclaw/workspace/HEARTBEAT.md`） |

- **事故 2026-07-14：** 生产 Cloud 被设成 `observe` → 客户消息落库但不回；已改回 `live`。
- +233 媒体/VIN：QA bridge（禁止迁 monitor）；回滚只用 `APSALES_MEDIA_VIN_ENABLED=false`。
- 报告：`docs/ops/whatsapp-cloud-runtime.md`；媒体管线见 openclaw-sales-agent 任务文档。

## Engineering gotchas
- **CSS cache-bust**：改 `ebay-layout.css` 必须同步 bump `js/components.js` 的 `SITE_EBAY_LAYOUT_VER`，否则 CDN 旧 `?v=` 会盖掉新样式（parts 真图曾因此卡在 66px）。
- **库存号搜索跨分类（P0 2026-07-10）**：顶栏搜数字/`HC…` 默认进半切页；若车在 used-cars/卡车等分类会被踢空。规则：`isStockIdQuery` + `mergeStockIdHitsIntoInventory`；现网 cache key 已升到 `stock-id-search-v2`（v1 逻辑曾在 origin 但 CF 仍喂 `parts-parallel-v1` 旧 JS → CEO 测仍空）。回归 `node scripts/verify-stock-id-search.mjs` + 现网截图。报告：`docs/ops/ops-p0-stock-id-search-live-retest-2026-07-10.md`。
- **先 GitHub 再生产（CEO 2026-07-10 质问确认违规）**：生产部署前必须 `git push` 到 GitHub，且 `HEAD` 对齐 `origin/main`（或 CEO 批准的 release SHA）。禁止 `--allow-dirty` 常态直 rsync 本地未提交/未推送文件。今日 93 次 Release 均违规。补救用普通 push/PR，禁止 force push。依据 OPS-003 §7.2。
- **专用零件目录价必须全价（CEO 定稿 2026-07-10）**：单独上传的发动机/变速箱/底盘/前切等，**列表与详情一律显示库内原价**，**禁止再乘 0.35**（及同类 `PART_PRICE_RATIOS`）。`0.35` 等系数**仅**用于「规则带出、无单独实价」的半切估算件。事故例：HC250546 库价 230 → 列表曾错显 81。现网逻辑：`catalogPartPriceAmount` + `isDedicatedPartListing`（cache key 含 `dedicated-price-v1`，后续 `stock-id-search-v2` 仍含此修复）。Runbook：`data/knowledge-base/dedicated-part-price-runbook.md`；取证：`docs/ops/ops-p0-gearbox-230-to-81.md`

## 全站目录搜索（2026-07-10）
- `matchesCatalogSearch` + `mergeCatalogSearchHitsIntoInventory`：库存号/车型/发动机/VIN/中文别名均可从顶栏半切页命中全库
- 别名：`js/catalog-search-aliases.js`（zh-en-seed）；短码 <4 字符禁止去空格折叠（防 CDL←Automatic DLX）
- 回归：`node scripts/verify-catalog-search.mjs`；cache key 现网 `catalog-search-v2`

## sales-agent 模型（2026-07-14）

- 生产 `sales-agent` 用 `openrouter/google/gemini-2.5-flash`（含 qwen / gpt-5.4-mini fallback），**不要**单绑 `zai/glm-4.7-flash`（易 429 导致整线客户「当机」）。
- 配置在主机 `/root/.openclaw/openclaw.json`（热加载）；备份见 `releases/apsales-hotfixes/`。

## B2B 目录注册（2026-07-15）

- DIYTrade / TradeKey / ExportHub 等：**邮箱验证码 + 图形/人机验证无法全自动闭环**；可从**生产服务器**填表（本机 CDN 常 502/Cloudflare）。
- **`info@asia-power.com` 未接入 Cloudflare Email Worker**（只接 `sales@` / `inquiry@`）→ 发到 info@ 的验证信 Cursor **读不到**。目录注册统一用 **`sales@asia-power.com`**。
- DIYTrade + TradeKey：已用 sales@ 注册成功（密码 `memory/customer_gateway/directory-credentials.local.json`）。DIYTrade 邮箱已验证，但需上传营业执照才能出预览模式。
- Kompass/Europages/ExportHub：DataDome / 人机墙，需真人浏览器。
- 进度板：`docs/ops/directory-backlink-weekly-progress.md`

## openclaw_reply_not_json（2026-07-15）

- sales-agent 回复前后多字也会失败；用 `apsales-parse-agent-reply.mjs` 宽松抽 JSON，失败打 `rawText`。
- 异常兜底必须读 `deal_state`：已有 VIN 禁止再问 VIN/model（成交节骨眼会砸单）。

## 加纳员工交接通知（2026-07-15）

- +233 agent 回复含 `054 913 5916`（或 +233 写法）时，bridge 异步 WhatsApp 通知 `+233549135916`（客户号+最近 Evidence 摘要）。
- 模块：`deploy/apsales-live-draft/ghana-staff-handoff.mjs`；失败不影响客户回复。

## 公开站语言与 Construction URL（2026-07-16）

- 公开页语言只认 `localStorage.asiapower.lang`（可 `?lang=`）；遗留 `ares-lang` 应清理，不得另起一套。
- HTML 默认英文；`js/public-i18n.js` 的 `STRINGS[key].en` 要齐全——否则 EN 模式下中文默认值会原样露出（供应商门户曾踩坑）。
- Construction 权威路径：`/machinery/`；`/half-cuts/?cat=machinery` 应 301 过去。


## PWA Service Worker 缓存（2026-07-16）
- `activate` 曾错误只删 `apapp-001-*`，真实桶是 `pwa-app-v*` 等，导致旧缓存永不淘汰。
- 现用 `obsoleteCacheKeys` 删掉除当前 `STATIC_CACHE` 外全部桶；版本 `pwa-app-v6b`。
- `pwa-install.js` 必须 short-cache，不可 year-immutable（CF 会冻死 `?v=`）。

- **PWA SW 修复已判定有效（2026-07-16）**：Claude 真机复验通过；现网干净。沙盒未能完整复现「旧访客升级瞬间」属测试环境限制，不否定修复。证据在 `site-template-consistency-audit.md`。
- 首页 v4（home-v4-hybrid）变更必须用 deploy **home**，不是 chrome。

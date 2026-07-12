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

## 🚨 生产部署硬红线（CEO 2026-07-10 · 续费红线）

> **再犯 = 违反公司发布门禁；CEO 已明确：下次再犯不再续费。**

1. **生产部署前必须：`commit` → `push GitHub` → 再跑 Release Manager**（`scripts/deploy-production.mjs`）
2. **禁止**常态用 `--allow-dirty` 直 rsync 生产（未入库、未上 GitHub 的脏树不得上线）
3. 紧急例外仅限显式 env（`DEPLOY_ALLOW_DIRTY=1` / `DEPLOY_ALLOW_UNPUSHED=1`）且必须打日志；**默认拒绝 dirty + 未 push**
4. **不要**在 CEO 未说可以时擅自补 push / 再部署生产来「补救」

## 部署与安全（2026-06-29）

- `deploy-production.mjs` rsync 工作树进 `public/` — 新增后端目录必须同步 EXCLUDES，否则 `.py` 源码可公开下载（已修一次，勿回归）
- **公开隐私原则（2026-07-12）**：公开页/API 不得出现完整 VIN、供应商资料、内部备注或审核元数据；脱敏对象禁止再与 raw item 合并。Preview 不得公网裸奔。QXB guide 先逐页查隐私，只有命中完整 VIN、供应商/客户隐私或内部备注才下线/noindex，禁止无差别全删。
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
- 今日福特试验车批次 HC250556–HC250565：发动机命名已确认正确，禁止随意改；变速箱必须读 `notes` / `remark` 后以车型、排量、年款、挡位等已知信息命名，禁止只写空洞的 AT/Transmission，也禁止臆造真实型号。
- 本批定价汇率 6.8：发动机 RMB 8,500 → **USD 1,250**；变速箱 RMB 3,000 → **USD 441**（四舍五入到整数美元）。价格字段必须明确为 USD。
- **公开类目互斥（CEO 2026-07-12 定稿）**：`passengerPartType` 是独立零件主分类，优先于 engineCode/transmissionCode/标题/搜索。独立发动机只进发动机，独立变速箱只进变速箱，底盘只进底盘，半切/车头不得混入上述独立件；搜索只能扩大匹配字段，禁止跨类目补项。仅无专用类型的真正半切可因自带 engineCode/transmissionCode 同时出现在动力总成目录。事故批次 HC250556–HC250566；报告 `docs/ops/ops-part-category-filter-fix-2026-07-12.md`。
- 本批对外卖点固定体现 **Low mileage / Nearly new condition（低里程 / 几乎全新）**。详见 `docs/ops/ops-engine-transmission-pricing-2026-07-12.md`。

## 中文车型 normalize（2026-07-10）
- `normalizeKey` 必须保留 CJK；剥成空串会把尚酷等塌成目录里第一个中文名（例：朗逸）
- 显式映射：尚酷→Scirocco；详见 `docs/ops/ops-hc250552-scirocco-model-fix.md`

## Engineering gotchas
- **CSS cache-bust**：改 `ebay-layout.css` 必须同步 bump `js/components.js` 的 `SITE_EBAY_LAYOUT_VER`，否则 CDN 旧 `?v=` 会盖掉新样式（parts 真图曾因此卡在 66px）。
- **库存号搜索跨分类（P0 2026-07-10）**：顶栏搜数字/`HC…` 默认进半切页；若车在 used-cars/卡车等分类会被踢空。规则：`isStockIdQuery` + `mergeStockIdHitsIntoInventory`；现网 cache key 已升到 `stock-id-search-v2`（v1 逻辑曾在 origin 但 CF 仍喂 `parts-parallel-v1` 旧 JS → CEO 测仍空）。回归 `node scripts/verify-stock-id-search.mjs` + 现网截图。报告：`docs/ops/ops-p0-stock-id-search-live-retest-2026-07-10.md`。
- **先 GitHub 再生产（CEO 2026-07-10 质问确认违规）**：生产部署前必须 `git push` 到 GitHub，且 `HEAD` 对齐 `origin/main`（或 CEO 批准的 release SHA）。禁止 `--allow-dirty` 常态直 rsync 本地未提交/未推送文件。今日 93 次 Release 均违规。补救用普通 push/PR，禁止 force push。依据 OPS-003 §7.2。
- **专用零件目录价必须全价（CEO 定稿 2026-07-10）**：单独上传的发动机/变速箱/底盘/前切等，**列表与详情一律显示库内原价**，**禁止再乘 0.35**（及同类 `PART_PRICE_RATIOS`）。`0.35` 等系数**仅**用于「规则带出、无单独实价」的半切估算件。事故例：HC250546 库价 230 → 列表曾错显 81。现网逻辑：`catalogPartPriceAmount` + `isDedicatedPartListing`（cache key 含 `dedicated-price-v1`，后续 `stock-id-search-v2` 仍含此修复）。Runbook：`data/knowledge-base/dedicated-part-price-runbook.md`；取证：`docs/ops/ops-p0-gearbox-230-to-81.md`

## 全站目录搜索（2026-07-10）
- `matchesCatalogSearch` + `mergeCatalogSearchHitsIntoInventory`：库存号/车型/发动机/VIN/中文别名均可从顶栏半切页命中全库
- 别名：`js/catalog-search-aliases.js`（zh-en-seed）；短码 <4 字符禁止去空格折叠（防 CDL←Automatic DLX）
- 回归：`node scripts/verify-catalog-search.mjs`；cache key 现网 `catalog-search-v2`

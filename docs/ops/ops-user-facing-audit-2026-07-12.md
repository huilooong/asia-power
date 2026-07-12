# OPS — 生产公开页「不该出现」审计（2026-07-12）

**状态：发现 P0 隐私泄露；已做本地最小修复，未部署。**
**范围：** `asia-power.com` 首页、目录、详情、About、Contact、国家页、公开 API、sitemap 与公开静态资源。
**限制：** 本任务未改生产、未删数据、未部署。

## 结论

| 项 | 状态 | 说明 |
|---|---|---|
| 公开 API 隐私 | **失败 / P0** | 无需登录的 `/api/half-cuts/public` 返回 518 条原始 approved 记录；452 条含完整 17 位 VIN，另含供应商姓名、电话/城市、内部备注、提交号等 |
| 详情页隐私 | **失败 / P0** | 抽查 HC250546、HC250552、HC250556：HTML 内嵌 JSON 与 `/public/item` 仍含原始敏感字段；正文视觉上未直接展开，但访客可查看源码/网络响应取得 |
| Preview / 内部话术 | **失败 / P1** | `/engines/g4kd-v2.html` 公开且被 sitemap 收录，正文直接显示 `Template preview` 和内部代号 `APSales` |
| 未批准 QXB SEO 页 | **失败 / P1** | sitemap 有 20 个 `qxb####` URL，`/engines/` 直接链接这些 guide；而 GROWTH-001B/1D 明确写明 0 条照片可公开、不得生成生产页 |
| 英文页中文混入 | **失败 / P2** | 全站热门搜索词含“上海 / 半切车 / 丰田”等；机械目录卡片及 engines/gearboxes 结构化数据含中文车型/变速箱文字。语言切换器的“中文”不计入问题 |
| 联系邮箱 | **待 CEO 决策 / P2** | About 与 Contact 公开显示 `weylonhui@gmail.com`；这是现有业务联系方式，不按“客户隐私泄露”定性，但 runbook 已标记“待改”，建议确认是否切换 `sales@asia-power.com` |
| Admin / WIP / TODO / localhost | **成功** | 主要页面未发现 Admin 链接、WIP/TODO、localhost/127.0.0.1 文案 |
| Source map | **成功** | 抽查 61 个公开 JS/CSS 资产，没有可下载 `.map` |
| 库存号与价格单位 | **基本成功** | 公开库存 API 的 518 条库存号均为 `HC######`；列表价格显示 `$` + `EXW`，未发现错误币种。QXB 仅在上述未批准 SEO URL 暴露 |
| 首页/目录基本可用 | **成功** | 首页、主要目录、About、Contact、国家页均 HTTP 200；主 UI 未出现空白/调试错误文案 |
| 详情页历史事故回归 | **成功** | HC250552 显示 15 张图、WhatsApp、Facebook 分享、询价 CTA；未回归“少图/CTA 消失” |

## P0：公开 API 把删除过的敏感字段重新合并回来

### 生产证据（不记录隐私原值）

URL：

- `https://asia-power.com/api/half-cuts/public`
- `https://asia-power.com/api/half-cuts/public/item?slug=volkswagen-scirocco-2011-cdl-half-cut-hc250552`
- 三个详情 HTML：HC250546 / HC250552 / HC250556

统计：

| 字段 | 受影响记录数 |
|---|---:|
| 总记录 | 518 |
| 完整 17 位 VIN | 452 |
| supplierName 非空 | 494 |
| supplierPhone 非空 | 121 |
| supplierCity 非空 | 118 |
| notes 非空 | 401 |
| 含邮件样式文本 | 1 |

Cloudflare 与源站直连结果一致，排除 CDN 缓存误判。

### 根因

`server/lib/half-cut-public.js` 的 `toPublicItem()` 先从 `copy` 删除 VIN、供应商资料、notes、submissionId 等，再调用：

`Object.assign(copy, localizePublicNames({...item}))`

`localizePublicNames()` 会返回包含 `...item` 的完整对象，因此把刚删除的字段全部合并回来。意思是：脱敏做了，但下一步又把原始记录盖回公开结果。

### 本地修复（未部署）

- 改为只对已经脱敏的 `copy` 做英文名称处理
- 新增 `tests/half-cut-public-privacy.test.js`
- 用生产 518 条快照验证本地结果：
  - 11 类敏感字段残留均为 0
  - 完整 VIN 为 0
  - 452 条仅保留掩码 VIN

## P1：公开了 preview / 未批准 SEO 页面

### 明确残留

1. `https://asia-power.com/engines/g4kd-v2.html`
   - HTTP 200、可索引、在 sitemap
   - 用户可见：`Engine buying page V2 · Template preview`
   - 用户可见内部代号：`APSales`
2. `/engines/` 公开链接 20 个带 `qxb####` 的 guide URL；sitemap 同样收录 20 个。
3. 与历史批准记录冲突：
   - `docs/agent-reports/growth-001B-halfcut-public-safe-preview.md`：100 条中 publicPhotoReady=true 为 0，禁止直接发布
   - `docs/agent-reports/growth-001D-preview-review.md`：仅本地 noindex 预览，不得生成生产页

此项未在本任务删除或 noindex，因为属于 SEO 模板/公开内容变更，需要 CEO 批准。

## 本次检查的页面

- 首页：`/`
- 目录：`/half-cuts/`、`/engines/`、`/gearboxes/`、`/trucks/`、`/machinery/`
- 详情：HC250546、HC250552、HC250556
- 公司页：`/about.html`、`/contact.html`
- 国家页：`/ghana.html`、`/kenya.html`、`/nigeria.html`
- 额外暴露页：`/engines/g4kd-v2.html`、一个 QXB guide 样本
- API：公开目录、公开详情、health 与权限路由
- sitemap 与 61 个 JS/CSS source map 候选

## 历史问题对照

- 完整 VIN / 供应商资料 / 内部 notes：**已回归（P0）**
- Preview、测试文案、内部代号：**已回归（P1）**
- 中文混入英文公开页：**已回归（P2）**
- Admin 链接：未发现
- 首页 vs 目录错误露出：主视觉列表未发现明显跨分类；engines/gearboxes 的 SEO 数据会带入含发动机/变速箱码的卡车/机械记录，当前主要问题是中文字段未英文化
- 少图 / CTA 消失：未回归
- 错误价格单位：未发现
- source map：未发现

## 证据路径

- `docs/ops/evidence/user-facing-audit-home-20260712.png`
- `docs/ops/evidence/user-facing-audit-halfcuts-20260712.png`
- `docs/ops/evidence/user-facing-audit-detail-hc250552-20260712.png`
- `docs/ops/evidence/user-facing-audit-machinery-20260712.png`
- `docs/ops/evidence/user-facing-audit-about-20260712.png`
- `docs/ops/evidence/user-facing-audit-contact-20260712.png`

为避免二次泄露，未把完整 VIN、供应商姓名、电话或内部备注写入报告/截图。

## 文件变更

- 修改：`server/lib/half-cut-public.js`
- 新增：`tests/half-cut-public-privacy.test.js`
- 新增：本报告与 6 张生产截图

## 验证

| 验证 | 结果 |
|---|---|
| `node tests/half-cut-public-privacy.test.js` | `HALF_CUT_PUBLIC_PRIVACY_PASS` |
| 生产 518 条快照经过本地 sanitizer | 敏感字段 0；完整 VIN 0；掩码 VIN 452 |
| `node --check`（修复与测试） | 通过 |
| 编辑文件 lint | 0 错误 |
| `node scripts/verify-production.mjs https://asia-power.com` | 现网基础健康检查通过；不代表隐私检查通过 |
| 截图 | 6/6 文件已生成 |

## 下一步 / CEO 决策

| 优先级 | 决策 |
|---|---|
| **立即** | 批准把 P0 本地修复按 `commit → push GitHub → Release Manager(api)` 发布；发布后必须复查公开目录、公开详情、详情 HTML，确保敏感字段为 0 |
| **今日** | 决定是否立刻下线/noindex `g4kd-v2` 与 20 个 QXB guide，并从 `/engines/`、sitemap 移除 |
| **随后** | 清理英文页热门搜索中文词、机械库存中文展示字段 |
| **可选** | 确认公开联系邮箱是否由个人 Gmail 切换为 `sales@asia-power.com` |

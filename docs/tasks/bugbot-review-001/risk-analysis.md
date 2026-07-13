# Risk Analysis — 若动手修（尚未动手）

## High-1 · 品牌页接 live 库存

### 方案选项（仅分析）

| 方案 | 做法 | 业务 | SEO | 性能 | 部署风险 |
|------|------|------|-----|------|----------|
| A. 完整 hydrate | `brands.html` 加载 inventory-store；`CATALOG_PAGES` 加 `brands`；库存就绪后 `initBrandDirectory()` | 品牌集合贴近现网 | 文案兑现；矩阵仍依赖 JS | 多拉全量 public 列表，最重 | 低–中（需验证空库存/失败） |
| B. 轻量品牌聚合 API | 新接口只返回 `{slug,count}` | 同 A，更干净 | 同 A | 最好 | 中（新 API + 权限） |
| C. 保持 seed | 不改 | 继续低估品牌数；与「动态在库」文案冲突 | 文案夸大 | 最轻 | 无 |
| D. Seed 首屏 + API 刷新 | A 的降级版 | 最佳 UX | 同 A | 首屏快，随后刷新可能闪动 | 低–中 |

### 主要风险

1. **首屏闪动**：先 9 品牌再跳到 50+（若 seed+live）
2. **API 失败**：若去掉 seed 且 API 挂，矩阵变空 → 需明确降级
3. **featured 品牌**：`featuredBrandSlugs` 里无库存者会被滤掉（如配置了但 seed/live 都没有）——这是函数既有行为，接 live 后更明显
4. **不要**为修品牌页去改首页 v4 快照逻辑

### 不修的风险

- 销售/SEO hub 引导用户「看在库品牌」，实际只看到 9 个演示品牌集合
- 现网有库存的 Ford / BYD / 卡车品牌等可能不出现在品牌目录

---

## High-2 · object-fit contain vs cover

### 方案选项

| 方案 | 做法 | 布局风险 | 视觉风险 |
|------|------|----------|----------|
| A. 全面恢复 contain（parts 四页） | 删页级 cover 对 fit-contain 的覆盖 | **高**：行高可能再参差 | 专用图完整 |
| B. 仅专用真图 contain，占位/半切 cover | 收窄选择器：有图+fit-contain → contain；`--parts-ph` 仍 cover | 中 | 对齐 parts-photo-display 预览 |
| C. 保持 cover，改 JS 注释 | 承认 chrome 决策优先 | 无 | 专用图继续被裁 |

### 主要风险

1. 回滚 contain 可能让 Jul 11「列表框高统一」回退
2. 误改全局 `.ap-listing-photo` 会影响半切 / 卡车 / 首页组件
3. Banner、品牌卡、营销图 **必须保持 cover** — 修复范围必须锁在 parts 列表

### 不修的风险

- 专用发动机/前切上传图在列表中被裁边（产品曾明确抱怨过）

---

## Medium-1 · SVG 编码

| 风险项 | 等级 | 说明 |
|--------|------|------|
| 业务 | 无 | 仅占位字幕 |
| SEO | 可忽略 | 非索引正文关键路径 |
| 缓存 | 低 | 需 bump `?v=` 或文件名若被强缓存 |
| 部署 | 低 | 单文件替换 |

---

## Medium-2 · AsiaPower-Brain symlink

| 动作 | 风险 |
|------|------|
| 当「误提交」直接删 | **高** — 破坏 APBRAIN 本地约定；CEO 已批任务产物 |
| 留在 git | 低–中 可移植性（他人 clone 断链）；前台无影响 |
| 生产误同步 symlink | 低概率；Release Manager 路径型 rsync 未以站点核心资产部署该链接；仍应避免把 Brain 当 public 资产 |

**结论：** 不在本次 Bugbot 修复范围内删除或改动。

---

## Risk matrix (summary)

| ID | 修的风险 | 不修的风险 | 建议姿态 |
|----|----------|------------|----------|
| High-1 | 性能/闪动/空目录降级要设计好 | 产品承诺与现网不符 | 应修，但要带 fallback |
| High-2 | 行高回归 | 专用图裁切 | 部分修或 CEO 定优先级 |
| Medium-1 | 极低 | 占位图不美观 | 应修 |
| Medium-2 | 乱动会伤 Brain 工作流 | 可移植性债 | 保持现状 |

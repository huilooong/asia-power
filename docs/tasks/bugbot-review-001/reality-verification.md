# Reality Verification — 逐条核对

**规则：** 不因 Bugbot 提出就默认要修。每条回答：可复现？根因？判断对不对？修了有没有副作用？是真问题还是设计如此？

---

## High-1 · `brands.html` 未接 `/api/half-cuts/public`

### 1) 是否可以稳定复现？

**可以。**

证据：

| 检查 | 结果 |
|------|------|
| `brands.html` scripts | 有 `half-cut-directory.js`，**无** `half-cut-inventory-store.js` |
| `body[data-page]` | `brands` |
| `CATALOG_PAGES`（inventory-store 自动 hydrate） | 仅 `home, halfcuts, engines, gearboxes, chassis, frontcuts, trucks, machinery` — **不含 brands** |
| `initBrandDirectory()` | 在 `DOMContentLoaded` / 空矩阵重试 / 语言切换时调用；**没有**在库存 API 就绪后刷新 |
| 数据源 | `getBrandsWithPublicStock()` → `window.HALF_CUT_LIST` → 默认 = `SEED_HALF_CUT_LIST`（约 34 条演示库存） |
| Seed 可计品牌 | **9** 个：bmw, honda, hyundai, kia, lexus, mercedes-benz, mitsubishi, nissan, toyota |
| 现网公开库存 | `/api/half-cuts/public` ≈ **525** 条 approved → 可计品牌约 **53** |
| 现网 `brands.html` | 同样只加载 seed 脚本（`brand-stock-directory-v1`），无 inventory-store |

结论：打开品牌页时，目录由 seed 推导，不是现网库存。稳定可复现。

### 2) 根因是什么？

产品逻辑已改成「只显示有公开库存信号的品牌」（`getBrandsWithPublicStock`），但库存输入仍停留在静态 seed：

1. 页面未加载 `half-cut-inventory-store.js`
2. `brands` 不在 store 的自动 bootstrap 页集合
3. `initBrandDirectory` 无「库存同步后再渲染」钩子

`js/config.js` 的 `brandsDirectory`（约 62 个品牌元数据）仍在，但只作名称/落地页/发动机搜索元数据；**能否出现在矩阵里**取决于 `HALF_CUT_LIST` 计数。

### 3) Bugbot 是否完全正确？有无误判 / 缺上下文？

**主体正确，缺三处上下文：**

| Bugbot 说的 | 核实 |
|-------------|------|
| 未接 live API / store | ✅ 对 |
| 读 seed | ✅ 对 |
| `brands` 不在 `CATALOG_PAGES` | ✅ 对 |
| 「设计目标已切到 in-stock」 | ✅ 文案与 SEO hub 明确如此 |
| 是否故意 SEO / 静态 / 降级 | ⚠️ Bugbot **未区分**；见下节 |
| Fallback 设计 | ⚠️ Bugbot **遗漏**：仓库里有「seed → store hydrate」模式，但 **brands 页没接上**，不是完整 fallback |

### 4) 修复是否会影响业务 / SEO / 部署 / 性能？

| 维度 | 影响 |
|------|------|
| 业务 | **会变好**：品牌数从 ~9 → 接近现网 ~53；与「在库品牌」承诺一致。无库存品牌会从矩阵消失（这是当前函数本意） |
| SEO | 品牌网格本身是 **JS 渲染**（`#brand-matrix` 空壳），爬虫本来也看不到完整列表。接 API **不破坏**静态 meta/canonical；hub 页文案「Dynamic brand directory from current stock」会更诚实 |
| 部署 | 需改 `brands.html` + 可能 `CATALOG_PAGES` / 刷新钩子；走常规 Release，**非**数据删除类 |
| 性能 | 若整包拉 `/api/half-cuts/public`（525 条）仅为聚合品牌，**偏重**。品牌页会多一次网络往返；首屏可能先 seed 后刷新（若保留 seed）或白一下再出（若等 API） |

### 5) 真要修，还是设计如此？

**相对当前产品目标：是真缺口，不是「故意只用 seed」。**

但「seed 存在」本身可以是降级策略的一部分——前提是之后 hydrate。现在是 **seed-only**，与页面文案矛盾。

### 重点确认（CEO 问题）

#### 当前品牌页设计目标是什么？

**在库品牌目录（in-stock directory）**，不是「全量支持品牌静态黄页」。

证据：

- `brands.html` meta / lead：「in-stock」「updates from current public inventory signals」
- 引擎 SEO hub（如 `engines/africa-half-cut-engines.html`、`engines/honda-half-cut-engines.html`）：「Dynamic brand directory from current stock」「not a static support list」
- 代码：`getBrandsWithPublicStock` 按可计库存聚合，而不是直接 `config.brandsDirectory.map(...)`

#### 为什么仍然读取 seed？

实现未完成接线：目录过滤逻辑已切到「按库存计品牌」，但库存数据源仍是 `half-cut-directory.js` 内置 `SEED_HALF_CUT_LIST`。更像是 **改造中途状态 / 漏接**，不是文档写明的长期策略。

#### 是否因为 SEO、静态生成、缓存或降级故意如此？

| 假设 | 判断 |
|------|------|
| SEO 静态生成品牌列表 | ❌ 否。列表是客户端 JS 填的，seed 并不给爬虫 SSR HTML |
| 故意缓存静态品牌 | ❌ 文案明确说动态更新 |
| 降级 / fallback | ⚠️ **半对**。全站其他目录页是 seed + inventory-store hydrate；brands **只有 seed，没有 hydrate**。Bugbot 说「遗漏 fallback」方向对：完整设计应是 fallback+live，当前缺 live |

#### 如果改为实时 API，会不会影响首页速度、SEO 或缓存策略？

| 面 | 说明 |
|----|------|
| 首页速度 | **基本不影响**。现网 `index.html` 不走 `main.js` 的 `initHomepageBrands`，也不加载这套 seed 品牌矩阵；首页用 v4 hybrid 自己的快照/脚本 |
| SEO | 改善「文案 vs 真实品牌集合」一致性；矩阵仍依赖 JS |
| 缓存 | 若接 inventory-store，会走其现有 public 拉取/缓存；需 cache-bust `brands.html` 的 script `?v=`。勿把品牌页误当成可 CDN 永久缓存的静态品牌名单 |

#### Bugbot 是否遗漏了 fallback 设计？

**是，部分遗漏。**

正确完整图景：

```
SEED_HALF_CUT_LIST  →  首屏可用（降级）
half-cut-inventory-store + /api/half-cuts/public  →  覆盖为真库存
initBrandDirectory 在库存就绪后重跑  →  品牌矩阵刷新
```

Bugbot 正确指出「没接 API」；未充分说明：**seed 在别的目录页是降级底，在 brands 页却成了唯一数据源。**

---

## High-2 · `object-fit: cover` 盖掉 contain

### 1) 是否可以稳定复现？

**可以（CSS 层面）。**

- `renderPartListingPhoto()`（`js/half-cut-directory.js`）对零部件专用图 **总是**加 `ap-listing-photo--fit-contain`，注释写明「不要裁切」
- 全局规则 `.ap-listing-photo--fit-contain … { object-fit: contain }` 存在（约 L2678）
- 但 `body[data-page="engines|gearboxes|chassis|frontcuts"] .ebay-parts-main … .ap-listing-photo--fit-contain .ap-listing-photo__img` **显式写成 `object-fit: cover`**（约 L2326–2344）
- 选择器特异性更高 → **contain 在这四页列表上不会生效**

### 2) 根因是什么？

两套「已定稿」意图打架：

| 意图 A | 意图 B |
|--------|--------|
| `parts-photo-display` 预览：专用配件图用 **contain**，完整显示 | `list-photo-uniform` / Jul 11 chrome：`4:3 + cover`，行高整齐 |
| JS 仍打 contain class | CSS 页级选择器 **连 contain class 一起强制 cover**（commit `f298ffdf7` 等） |

根因不是「忘了写 contain」，而是 **后提交的统一框高 CSS 故意覆盖了 contain**。

### 3) Bugbot 是否完全正确？

**技术结论正确，产品定性不完整。**

- ✅ cover 确实盖掉了 fit-contain
- ❌ 不是单纯疏忽：CSS 注释写明「Was … contain → uneven row heights」；ops 文档要统一 cover
- ⚠️ `ops-list-photo-uniform.md` 曾写「零部件 contain 规则保留」，随后 parts 页也被改成 cover — 文档与后继 commit 不一致

### 4) 修复影响？

| 若整页改回 contain | 风险 |
|--------------------|------|
| 发动机/变速箱/底盘/前切列表 | 竖图/异形图可能导致行高再次不齐（chrome 回归） |
| 半切列表 / Banner / 品牌图 / 首页卡片 | **不受影响**（选择器限定在四类 `data-page` + `.ebay-parts-main`） |
| 占位图 `--parts-ph` | 已有独立 `cover` 规则；应继续 cover |

### 5) 真问题还是设计如此？

**对「统一行高」来说：设计如此（后写覆盖）。**  
**对「专用配件图完整显示」来说：是相对早期预览的回归。**

不是「全站所有图都应 contain」。

### 重点确认

| 问题 | 答案 |
|------|------|
| 是否所有产品图片都应该 contain？ | **否** |
| 是否只有发动机、变速箱需要 contain？ | 预览范围是 **engines / gearboxes / chassis / front-cuts 的专用上传图**；半切车列表刻意 cover |
| Banner / 品牌图 / 商品半切图？ | **应保持 cover**（及现有半切规则） |
| 修复会不会影响其它页面？ | 若只改四类 parts 页选择器、且保留半切/banner/占位 cover → **局部**；若删全局 cover → **危险** |

---

## Medium-1 · SVG 编码乱码

### 1) 可复现？

**可以。** 文件第 50 行可见 `POWERTRAIN LOT � PHOTOS ON REQUEST`（视编辑器而定）。

### 2) 根因？

字节检查：分隔符是 **单字节 `0xB7`**（Latin-1 / Windows-1252 的 middle dot），不是 UTF-8 的 `U+00B7`（应为 `C2 B7`）。

SVG/XML 默认按 UTF-8 解析 → `B7` 非法序列 → 显示为替换字符 `�`。

来源：写文件时把「·」按 Latin-1 写入了 UTF-8 文本。

### 3) Bugbot 判断？

**完全正确。**

### 4) 修复影响？

极低。仅占位图字幕；不影响库存、SEO 结构、部署路径。注意部署后 CDN/浏览器缓存该 SVG。

### 5) 要修吗？

**是，真实瑕疵。** 非设计如此。

---

## Medium-2 · Obsidian 路径 / `AsiaPower-Brain`

### 1) 可复现？

**路径存在，但是 symlink，不是「文件里写了一行绝对路径的文档」。**

```text
AsiaPower-Brain -> /Users/longhui/Documents/Obsidian Vault/AsiaPower
```

Git mode `120000`（符号链接）。Commits：`APBRAIN-001`、`APBRAIN-002`（CEO 批准的 Brain 任务）。

### 2) 根因？

APBRAIN-002 **故意**把仓库内 vault 树换成指向本机 Obsidian Vault 的 symlink，方便本地唯一 Brain。

### 3) Bugbot 判断？

**部分正确，框架有误：**

| Bugbot 说法 | 实际 |
|-------------|------|
| 提交了本机绝对路径 | ✅ symlink 目标确实是本机路径 |
| 像误提交的笔记内容 | ❌ **不是** README/文档正文；是 **symlink** |
| 应当仓库污染清理 | ⚠️ 属于已立项的 APBRAIN 基础设施；删之前要另开 Brain 任务，不能当 Bugbot 误报直接删 |

分类：**配置 / 开发者基础设施（symlink）**，不是业务页面、不是误报「文件不存在」。

### 4) 修复/删除影响？

| 动作 | 影响 |
|------|------|
| 直接删除 symlink | 打断本地 Brain / export 脚本约定；违反「先问再删」 |
| 提交到他人机器 | 链接目标可能不存在（预期）；生产 Release Manager **通常不**把该 symlink 当站点资产全量同步（现网站点根未见该链接） |
| 业务 / SEO / 前台性能 | **无直接影响** |

### 5) 要修吗？

**现在不应修/删。** 最多记为「可移植性债」，由 APBRAIN 后续任务处理（例如 gitignore + 本地 setup 文档，或相对路径约定）。

---

## Cross-check table

| ID | 稳定复现 | 根因一句话 | Bugbot 准确度 | 真问题？ |
|----|----------|------------|---------------|----------|
| High-1 | 是 | in-stock 逻辑已上，live 数据源未接 | 高（缺 fallback 完整图） | 是（相对产品目标） |
| High-2 | 是 | 后写 chrome cover 覆盖先写 parts contain | 技术对，定性不全 | 产品冲突，非纯 bug |
| Medium-1 | 是 | Latin-1 `·` 字节进了 UTF-8 SVG | 完全正确 | 是 |
| Medium-2 | 是（symlink） | APBRAIN 故意本机 vault 链接 | 半对（误当污染文件） | 非前台 bug；保持 |

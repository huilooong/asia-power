# Google 搜索收录检查报告（任务 4）

**Date:** 2026-07-05  
**Status:** ✅ 检查完成（robots.txt 已就绪；GSC 验证待人工）  
**Task:** 检查 robots.txt、sitemap、Google Search Console 验证、GA4 覆盖，并列出 GSC 人工操作项。

---

## 结论（CEO 速览）

| 项目 | 状态 | 说明 |
|------|------|------|
| robots.txt | ✅ 已存在 | 允许公开页抓取，已指向 sitemap |
| sitemap.xml | ✅ 生产可用 | 动态生成 606 条 URL（GET 200） |
| GSC 验证 | ❌ 未配置 | 无 `google*.html`、无 meta 验证标签 |
| GA4 追踪 | ✅ 公开页全覆盖 | 客户页均有 `G-PB2J3VRX5J`；admin 无（符合预期） |

**下一步（需 CEO 人工）：** 登录 [Google Search Console](https://search.google.com/search-console) → 添加资源 `https://asia-power.com/` → 完成域名/HTML 验证 → 提交 sitemap。

---

## 1) robots.txt 状态

### 本地仓库

- **路径：** `robots.txt`（网站根目录）
- **结论：** 已存在，**无需新建**

### 内容摘要

```
User-agent: *
Allow: /

Disallow: /admin/
Disallow: /supplier-portal/*-upload.html（4 个上传页）
Disallow: /api/
Disallow: /uploads/pending/
Disallow: /data/

Sitemap: https://asia-power.com/sitemap.xml
```

### 生产验证（2026-07-05）

| 检查项 | 结果 |
|--------|------|
| `GET https://asia-power.com/robots.txt` | **200 OK** |
| 内容与仓库一致 | ✅ 是 |
| 允许所有爬虫抓取公开页 | ✅ `User-agent: *` + `Allow: /` |
| 已声明 Sitemap | ✅ 指向 `https://asia-power.com/sitemap.xml` |

**说明：** 对 `/admin/`、`/api/`、供应商上传页等的 `Disallow` 是正常 SEO 做法，不影响客户可见页面被 Google 收录。

---

## 2) sitemap.xml 位置

### 生产（Google 应使用的地址）

| 项目 | 值 |
|------|-----|
| **URL** | `https://asia-power.com/sitemap.xml` |
| **HTTP 状态** | GET → **200**（606 个 `<loc>`） |
| **生成方式** | Node 服务动态生成（`server/lib/sitemap.js`，路由在 `deploy/inventory-site-server.js`） |
| **内容** | 核心页 + 品牌页 + 引擎页 + 实时 half-cut 库存详情 |

### 本地静态快照（仅供参考，非生产源）

| 项目 | 值 |
|------|-----|
| **路径** | `sitemap.xml`（仓库根目录） |
| **URL 数量** | 124 条（最后更新 2026-07-03） |
| **说明** | 开发快照；生产以 Node 动态 sitemap 为准（`scripts/generate-sitemap.mjs` 注释已说明） |

### 技术备注

- `HEAD https://asia-power.com/sitemap.xml` 返回 **404**，但 **GET 正常 200**。Google 抓取 sitemap 使用 GET，当前不影响提交；如需修复 HEAD 可另开小任务。

---

## 3) 需人工去 Google Search Console 提交的 URL

### Google Search Console 验证（当前缺失）

| 检查项 | 结果 |
|--------|------|
| 根目录 `google*.html` 验证文件 | ❌ **未找到** |
| 全站 `google-site-verification` meta 标签 | ❌ **未找到** |

**CEO 操作步骤：**

1. 打开 [Google Search Console](https://search.google.com/search-console)
2. **添加资源** → 选择「网址前缀」→ 输入：`https://asia-power.com/`
3. **验证所有权**（任选其一，推荐 HTML 文件或 DNS）：
   - **HTML 文件：** GSC 会给出类似 `google1234567890abcdef.html` 的文件名和内容 → 放到网站根目录并部署 → 点「验证」
   - **HTML 标签：** 将 `<meta name="google-site-verification" content="…" />` 加到 `index.html` 的 `<head>` → 部署 → 点「验证」
   - **DNS TXT 记录：** 在域名 DNS 添加 GSC 提供的 TXT 记录（无需改代码）
4. 验证通过后 → **Sitemap** → **添加新的站点地图** → 提交：

```
https://asia-power.com/sitemap.xml
```

### 建议优先「请求编入索引」的核心 URL（可选，加速首页与目录页）

验证并完成 sitemap 提交后，可在 GSC「网址检查」中逐条请求索引：

| 优先级 | URL | 页面类型 |
|--------|-----|----------|
| P0 | `https://asia-power.com/` | 首页 |
| P0 | `https://asia-power.com/half-cuts/` | 半切库存目录 |
| P0 | `https://asia-power.com/engines/` | 引擎目录 |
| P1 | `https://asia-power.com/brands.html` | 品牌索引 |
| P1 | `https://asia-power.com/trucks/` | 卡车目录 |
| P1 | `https://asia-power.com/gearboxes/` | 变速箱目录 |
| P1 | `https://asia-power.com/contact.html` | 联系页 |
| P2 | `https://asia-power.com/about.html` | 关于页 |
| P2 | `https://asia-power.com/supplier-portal.html` | 供应商门户 |

**说明：** sitemap 已含 606 条 URL（含各品牌页、引擎详情、half-cut 详情），提交 sitemap 后 Google 会自动发现大部分页面，不必手动逐条提交。

---

## 4) GA4 追踪代码是否在所有页面

### 测量 ID

- **GA4 Property ID：** `G-PB2J3VRX5J`
- **实现方式：** 各 HTML 页 `<head>` 内嵌 gtag.js（Google Tag Manager 加载）

### 公开客户页面

| 范围 | 有 GA4 | 无 GA4 | 结论 |
|------|--------|--------|------|
| 首页、目录、品牌、引擎、half-cut、contact 等客户页 | ✅ 全部 | — | **已覆盖** |
| PWA 工具页 | — | `app.html`、`offline.html` | 非 SEO 页，可忽略 |

### 内部 / 非公开页（ intentionally 无 GA4）

| 页面 | 说明 |
|------|------|
| `admin/*.html`（6 页） | 管理后台，robots.txt 已 `Disallow: /admin/` |
| `reports/qxb-preview-*.html` | 内部预览，非公开 |
| `supplier-portal/*-upload.html` | 上传工具页，robots 已 disallow |

### 抽样验证

- `index.html`：✅ 含 `gtag('config', 'G-PB2J3VRX5J')`
- `half-cuts/index.html`：✅
- `engines/index.html`：✅
- `brands/toyota.html`：✅

**结论：** 所有应对外统计流量的客户页面均已安装 GA4；admin 与内部页无 GA4，符合预期。

---

## 文件清单

| 操作 | 路径 |
|------|------|
| 已检查（未修改） | `robots.txt` |
| 已检查 | `sitemap.xml`（本地快照） |
| 已检查 | `server/lib/sitemap.js`（生产动态 sitemap） |
| 新增 | `docs/agent-reports/cursor-google-index.md`（本报告） |

---

## Validation

| 检查 | 命令/方式 | 结果 |
|------|-----------|------|
| 生产 robots.txt | `curl https://asia-power.com/robots.txt` | 200，内容正确 |
| 生产 sitemap | `curl https://asia-power.com/sitemap.xml` | 200，606 URLs |
| GSC 验证文件 | 全库搜索 `google*.html`、`google-site-verification` | 未找到 |
| GA4 覆盖 | 扫描公开 HTML（排除 admin/docs/reports） | 客户页全覆盖 |

---

## Next Task

1. **CEO：** GSC 添加属性并完成验证（HTML 文件 / meta / DNS 三选一）
2. **CEO：** GSC 提交 `https://asia-power.com/sitemap.xml`
3. **可选：** 验证文件或 meta 标签准备好后，告知技术部署到根目录或 `index.html`
4. **可选：** 修复 sitemap 的 HEAD 404（低优先级，不影响 Google GET 抓取）

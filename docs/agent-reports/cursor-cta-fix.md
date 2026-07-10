# 任务3 — WhatsApp CTA 修复报告

**日期：** 2026-07-05  
**状态：** ✅ 完成（本地）  
**任务：** 在 `engines.html`、`engines/` 全部页面、`half-cuts/` 全部页面顶部区域添加醒目 WhatsApp 询盘按钮。

---

## 结论

| 项目 | 结果 |
|------|------|
| 按钮文案 | `WhatsApp Us for Price` |
| 跳转链接 | `https://wa.me/8618603773077`（中国销售号，来自 `config.js` → `chinaWhatsapp`） |
| 按钮样式 | 绿色 `#25D366`、白字、圆角 12px、大字号 1.125rem、手机端全宽 |
| 位置 | 产品标题（H1）正下方、产品图片上方 |
| `engines.html` | 仅为跳转页 → 自动跳到 `engines/`，CTA 在目标页生效 |

---

## 实现方式

采用统一模块 `js/inquiry-cta.js` 自动注入，避免逐个改 60+ 静态 HTML。

| 页面类型 | CTA 注入位置 |
|----------|-------------|
| `engines/index.html` 发动机目录 | H1 正下方 |
| `engines/*.html` 各发动机详情（63 页） | `.engine-hero h1` 下方（标题与 meta 信息之间） |
| `half-cuts/index.html` 半切目录 | H1 正下方 |
| `half-cuts/detail.html` 半切详情 | 新建 `.hc-item-detail__product-head`：标题 → 库存号 → CTA → 图片 |

---

## 本次修改的文件

### 核心逻辑 & 样式（5 个文件）

| 文件 | 改动 |
|------|------|
| `js/inquiry-cta.js` | 号码改为 `chinaWhatsapp`（8618603773077）；文案改为 `WhatsApp Us for Price`；简化为单按钮 |
| `js/half-cut-detail.js` | 标题+CTA 提到图片区上方（`product-head` 区块） |
| `js/public-i18n.js` | 更新 `inquiryCta.whatsapp` 多语言文案 |
| `css/styles.css` | 重写 `.inquiry-cta-banner` 样式（绿底白字、大按钮、移动端全宽） |
| `css/ebay-layout.css` | 新增 `.hc-item-detail__product-head` 间距 |

### 已加载 CTA 模块、无需再改的 HTML（66 个）

- `engines/index.html`
- `half-cuts/index.html`
- `half-cuts/detail.html`
- `engines/*.html` 全部 **63** 个发动机详情页（均已含 `inquiry-cta.js?v=cta-fix-v1`）

### 无需修改

- `engines.html` — 0 秒跳转到 `engines/`，无产品内容

---

## 按钮规格对照

| 要求 | 实现 |
|------|------|
| 文案 `WhatsApp Us for Price` | ✅ `inquiry-cta.js` + `public-i18n.js` |
| 链接 `https://wa.me/8618603773077` | ✅ 使用 `ASIAPOWER.chinaWhatsapp` |
| 背景 `#25D366`、白字、圆角 | ✅ `.inquiry-cta-banner__btn--whatsapp` |
| 字体大 | ✅ `1.125rem`（手机 `1.15rem`） |
| 移动端全宽 | ✅ `width: 100%`，`max-width: none` @640px |
| 标题下、图片上 | ✅ 各页 `injectAfter(h1)`；半切详情 `product-head` 在 gallery 前 |

---

## 本地验证步骤

1. 打开 `/engines/` — 标题下出现绿色 `WhatsApp Us for Price` 按钮  
2. 打开 `/engines/1az-fe.html` — 发动机名下方、内容区上方有按钮  
3. 打开 `/half-cuts/` — 目录标题下有按钮  
4. 打开任意半切详情页 — 顺序为：标题 → 按钮 → 产品图  
5. 手机模式（≤640px）— 按钮占满一行，可点区域 ≥56px  

---

## 下一步

**需 CEO 批准后再部署** — 使用 `scripts/deploy-production.mjs` 推送到 asia-power.com。

---

## 路径

| | |
|--|--|
| 报告 | `docs/agent-reports/cursor-cta-fix.md` |
| 工作区绝对路径 | `/Users/longhui/Desktop/AsiaPower/docs/agent-reports/cursor-cta-fix.md` |
| CTA 模块 | `/Users/longhui/Desktop/AsiaPower/js/inquiry-cta.js` |

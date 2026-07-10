# OPS · 全站模板统一到 v4

**Status:** Phase B 已落地 · **Phase C 部分完成（chrome + Admin）** · engines 内容仍 Phase D

## 现状

| 区域 | 模板 | 说明 |
|------|------|------|
| **公开首页** | **v4-hybrid** | `index.html` + `css/home-v4-hybrid.css` + `js/home-v4-hybrid.js` |
| 目录 / 详情 **头栏** | **v4 chrome sync** | 文字 AsiaPower + 首页风搜索（共享 `components.js` / `ebay-layout.css`） |
| 目录 **内容标题区** | **v4 listing sync（本地预览）** | 浅色 `page-hero--catalog-v4`；等 CEO 确认后部署 · `docs/previews/v4-listing-sync/` |
| 目录 / 详情 **卡片网格** | eBay 列表壳 | 侧栏/卡片布局仍 eBay（未重做内容） |
| 登录 / 买家 / 供应商工作台 | v4 portal | 已统一 |
| **Admin 审批** | **Admin · v4** | `admin-v4.css`；inventory / analytics / leads |
| 供应商上传 | 旧工具页 | 仍待后续 |

## 阶段

```text
Phase A ✅  门户/登录用 v4 壳
Phase B ✅  首页切到 v4-hybrid
Phase C ✅  目录/详情导航头对齐 v4 + Admin 升 v4（本轮）
Phase D ⏳  引擎 SEO 页内容最后迁
```

## 部署

```bash
# 首页
node scripts/deploy-production.mjs home --yes

# 公开壳（logo + 搜索）
node scripts/deploy-production.mjs chrome --yes

# Admin 皮肤
node scripts/deploy-production.mjs admin --yes
```

## 本轮文档

- 审计：`docs/ops/ops-v4-chrome-sync-audit.md`
- 预览：`docs/previews/v4-chrome-sync/`

## 回滚

Release Manager 快照对应 `chrome` / `admin` remote paths；或：

```bash
RESTORE_CONFIRM=<REL-ID> node scripts/release-restore.mjs <REL-ID>
```

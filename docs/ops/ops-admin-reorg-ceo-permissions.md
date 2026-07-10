# OPS-ADMIN-REORG · Admin 权限挂 CEO + 信息架构上线

**Date:** 2026-07-10  
**Status:** 权限已落地 · **Admin IA 已上生产**（CEO 批「审核页可以上线」）  
**CEO 红线：** 「臃肿」指 Admin Dashboard，不是公开主页；**禁止改 asia-power.com 首页 / 不上 refined-v5**。发错图须反问，勿默默改主页。

## 一句话

CEO Google（`gooddlong@gmail.com`）已是超管；Admin 顶栏改为四入口，访问统计与库存审核拆开；公开主页未动。

## 已上线（Admin IA）

| 项 | 内容 |
|---|---|
| Release ID | `REL-20260710095502-admin-76489479` |
| 目标 | `admin` only（Release Manager） |
| 顶栏 | 库存 / 询价 / 访问统计 / 推广 |
| Analytics | 只留流量；旧 `?view=pending` 等跳转库存页 |
| Inventory | 唯一审核入口（待审 / 已上架 / 已拒绝） |
| 文案 | 默认中文，少中英双写 |
| 公开主页 | **未改**；生产 `index.html` md5 仍 `4b933ad23f7e8d47cb5f5fe0e0702b4d` |

## 权限（此前已落地）

| 项 | 现状 |
|---|---|
| `gooddlong@gmail.com` | `role=admin` |
| `ADMIN_EMAIL_ALLOWLIST` | gooddlong + googddlong（防打错） |
| 密码 `admin` | 仅应急 |
| api Release | `REL-20260710093900-api-76489479` |

## 验证 URL

| 检查 | 结果 |
|---|---|
| https://asia-power.com/admin/inventory.html | HTTP 200 · 标题「库存审核」· `admin-ia-reorg-v1` |
| https://asia-power.com/admin/analytics.html | HTTP 200 · 标题「访问统计」· **无** inventory-hub 脚本 |
| https://asia-power.com/admin/leads.html | HTTP 200 · 「询价收件箱」 |
| https://asia-power.com/js/components.js | 四入口中文导航 |
| https://asia-power.com/ | 仍为 v4-hybrid；md5 未变 |
| CEO 账号 | `gooddlong@gmail.com` role=admin |

## 回滚

```bash
RESTORE_CONFIRM=REL-20260710095502-admin-76489479 node scripts/release-restore.mjs REL-20260710095502-admin-76489479
```

## 教训（须记）

1. 主页改版须先确认：「刚上线的主页你确定要换掉吗？」
2. 发错图 / 意图不清 → 反驳提醒，不要改生产首页
3. Admin 与公开站分离部署；`deploy admin` 不得 rsync `index.html`

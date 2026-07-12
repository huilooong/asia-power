# OPS — P0 隐私修复发布与公网复核（2026-07-12）

## 结论

**P0 已在生产生效。** 公开目录 API 518 条、公开详情 API 1 条及详情 HTML 已复核：完整 VIN、供应商资料、内部备注、提交/审核元数据均为 0；452 条仅保留掩码 VIN。公开 Preview 1 页已下线并从 sitemap 消失。QXB guide 共 20 页，均未命中本次定义的隐私字段，因此全部保留。

## 发布记录

| 项目 | API 隐私修复 | Preview 下线 |
|---|---|---|
| Release ID | `REL-20260712114055-api-69b6eced3` | `REL-20260712114302-engines-69b6eced3` |
| Git commit | `69b6eced3359bd721faeb6e4235691025748e69e` | 同左 |
| GitHub | `origin/chore/backfill-2026-07-10-prod` 已含该提交 | 同左 |
| Release Manager | `api`，通过 | `engines`，通过 |
| 备份 | `/root/.openclaw/workspace/inventory-site/backups/scheduled/asia-power-backup-20260712-114058.tar.gz` | `/root/.openclaw/workspace/inventory-site/backups/scheduled/asia-power-data-20260712-114304.tar.gz` |
| 快照 | `/root/.openclaw/workspace/inventory-site/releases/REL-20260712114055-api-69b6eced3/snapshots` | `/root/.openclaw/workspace/inventory-site/releases/REL-20260712114302-engines-69b6eced3/snapshots` |
| 健康检查 | nginx 配置、关键 URL、API/nginx 服务均通过 | 关键 URL、API/nginx 服务均通过 |
| 回滚 | `RESTORE_CONFIRM=REL-20260712114055-api-69b6eced3 node scripts/release-restore.mjs REL-20260712114055-api-69b6eced3` | `RESTORE_CONFIRM=REL-20260712114302-engines-69b6eced3 node scripts/release-restore.mjs REL-20260712114302-engines-69b6eced3` |

说明：全程未使用 `--allow-dirty`、未跳过 git hook、未 force push。

## 生产隐私验证

| 检查目标 | HTTP | 完整 VIN | 供应商资料 | 内部备注/审核元数据 | 结果 |
|---|---:|---:|---:|---:|---|
| `/api/half-cuts/public`（518 条） | 200 | 0 | 0 | 0 | 成功；452 条有掩码 VIN |
| `/api/half-cuts/public/item?...HC250552` | 200 | 0 | 0 | 0 | 成功；仅掩码 VIN |
| `/half-cuts/detail.html?...HC250552` | 200 | 0 个 `vin` 值 | 0 个字段 | 0 个字段 | 成功 |

详情 HTML 的通用字段名中存在 17 位英文字母组合，最初宽泛正则误报 2 次；按 `"vin": "<17位值>"` 精确复核为 0，且敏感字段键均为 0。

## 公网审计结论

| 项目 | 结果 | 证据摘要 |
|---|---|---|
| 完整 VIN | 成功 | 公开列表、详情 API、详情 HTML 均为 0 |
| 供应商资料 | 成功 | `supplierName/Phone/City/Wechat` 等均为 0 |
| 内部备注/审核资料 | 成功 | `notes/submissionId/reviewStatus/decodeMethod/decodedData` 等均为 0 |
| Admin 链接 | 成功 | 首页、About、Contact、Half-cuts、Engines 未发现公开 Admin 链接 |
| 调试信息 | 成功 | 抽查页未发现 localhost、127.0.0.1、TODO、WIP |
| Preview 残留 | 成功 | `g4kd-v2.html` 返回 404；sitemap 不再收录 |
| QXB guide | 成功 | 20/20 HTTP 200；20/20 隐私命中为 0；按 CEO 规则保留 |
| 非隐私内容问题 | 待观察 | 英文页仍有中文热门词；公开个人 Gmail 是否换业务邮箱仍需 CEO 另行决定 |

## Preview 处理

| URL | 动作 | 验证 |
|---|---|---|
| `https://asia-power.com/engines/g4kd-v2.html` | 删除公开文件；Release Manager 的 engines 目标部署时先备份整目录，再显式移除该 Preview 与旧 sitemap | HTTP 404；页面显示 `Page not found`；新 sitemap 无该 URL |

## QXB guide 盘点

“是否被索引”在本报告中严格区分为：**已被 sitemap 收录且页面允许索引**；未登录 Google Search Console，因此不声称已确认 Google 实际索引。

| URL | sitemap / 可索引 | 隐私命中 | 动作 |
|---|---|---|---|
| `/engines/honda-accord-2008-half-cut-qxb0133-guide.html` | 是 / 是 | 否 | 保留 / 待观察 |
| `/engines/honda-accord-2008-half-cut-qxb0135-guide.html` | 是 / 是 | 否 | 保留 / 待观察 |
| `/engines/honda-accord-2010-half-cut-qxb0083-guide.html` | 是 / 是 | 否 | 保留 / 待观察 |
| `/engines/honda-accord-2010-half-cut-qxb0209-guide.html` | 是 / 是 | 否 | 保留 / 待观察 |
| `/engines/honda-accord-2011-half-cut-qxb0115-guide.html` | 是 / 是 | 否 | 保留 / 待观察 |
| `/engines/honda-accord-2011-half-cut-qxb0119-guide.html` | 是 / 是 | 否 | 保留 / 待观察 |
| `/engines/kia-k2-2012-half-cut-qxb0101-guide.html` | 是 / 是 | 否 | 保留 / 待观察 |
| `/engines/kia-k5-2011-half-cut-qxb0071-guide.html` | 是 / 是 | 否 | 保留 / 待观察 |
| `/engines/kia-k5-2012-half-cut-qxb0047-guide.html` | 是 / 是 | 否 | 保留 / 待观察 |
| `/engines/kia-k5-2012-half-cut-qxb0085-guide.html` | 是 / 是 | 否 | 保留 / 待观察 |
| `/engines/mitsubishi-pajero-2011-half-cut-qxb0033-guide.html` | 是 / 是 | 否 | 保留 / 待观察 |
| `/engines/mitsubishi-pajero-2011-half-cut-qxb0057-guide.html` | 是 / 是 | 否 | 保留 / 待观察 |
| `/engines/nissan-qashqai-2011-half-cut-qxb0022-guide.html` | 是 / 是 | 否 | 保留 / 待观察 |
| `/engines/nissan-qashqai-2012-half-cut-qxb0113-guide.html` | 是 / 是 | 否 | 保留 / 待观察 |
| `/engines/nissan-qashqai-2012-half-cut-qxb0125-guide.html` | 是 / 是 | 否 | 保留 / 待观察 |
| `/engines/toyota-2009-half-cut-qxb0005-guide.html` | 是 / 是 | 否 | 保留 / 待观察 |
| `/engines/toyota-2012-half-cut-qxb0055-guide.html` | 是 / 是 | 否 | 保留 / 待观察 |
| `/engines/toyota-corolla-2008-half-cut-qxb0079-guide.html` | 是 / 是 | 否 | 保留 / 待观察 |
| `/engines/toyota-corolla-2008-half-cut-qxb0141-guide.html` | 是 / 是 | 否 | 保留 / 待观察 |
| `/engines/toyota-corolla-2011-half-cut-qxb0139-guide.html` | 是 / 是 | 否 | 保留 / 待观察 |

## 证据

- `docs/ops/evidence/p0-preview-404-postdeploy-20260712.png`
- `docs/ops/evidence/p0-detail-postdeploy-hc250552-20260712.png`
- `docs/ops/evidence/user-facing-audit-home-20260712.png`
- `docs/ops/evidence/user-facing-audit-halfcuts-20260712.png`
- `docs/ops/evidence/user-facing-audit-detail-hc250552-20260712.png`
- `docs/ops/evidence/user-facing-audit-machinery-20260712.png`
- `docs/ops/evidence/user-facing-audit-about-20260712.png`
- `docs/ops/evidence/user-facing-audit-contact-20260712.png`

证据不保存完整 VIN、供应商姓名、电话或内部备注原值，避免审计材料二次泄露。

## 失败与残留风险

| 项目 | 状态 | 说明 / 下一步 |
|---|---|---|
| 首次临时工作树发布尝试 | 已安全终止 | Release Manager 因临时工作树未绑定 upstream 拒绝，未产生部署；绑定已推送远程分支后重跑成功 |
| 生产 `npm install` | 非阻断警告 | 安装命令报 `ERR_INVALID_ARG_TYPE`，部署脚本按既有容错继续；服务重启、健康检查及实际 API 均通过。建议单独维护 npm 环境，不影响本次 P0 生效 |
| 英文页中文混入 | 未处理 | 非本次隐私 P0；另开内容清理任务 |
| 公开个人 Gmail | CEO 决策 | 不属于客户/供应商隐私泄露；如需品牌化可另批切换业务邮箱 |

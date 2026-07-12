# OPS · 公开销售邮箱与转发复核（2026-07-12）

## 结论

| 项目 | 结果 |
|---|---|
| 公开邮箱 | **成功**：现网公开联系邮箱与销售 SEO 数据已统一为 `sales@asia-power.com` |
| 个人 Gmail | **成功移除公开展示**：7 个现网 URL 均未再命中个人 Gmail；内部转发与管理员用途未改 |
| 发信能力 | **有效**：Resend 的 `asia-power.com` 域名为 `verified`，Sending 已开启 |
| 收信链路 | **有效**：测试信由 Resend 投递至 `sales@`，生产邮箱记录从 11 增至 12，并命中测试主题 |
| Gmail 最终副本 | **部分验证**：Cloudflare MX、Worker 入站与生产 API 均正常；因无可用 Gmail 登录会话，未直接读取最终收件箱 |
| CEO 是否需操作 | **无需修配置**；如需 100% 人工闭环，只需在转发目标 `we***@gmail.com` 搜索测试主题 |

## 改动范围

- `contact.html`：按钮、显示文字及 SEO 联系邮箱。
- `about.html`：公开邮箱、SEO 联系邮箱及多语言脚本缓存版本。
- `js/public-i18n.js`：About 中文、法文、阿文邮箱。
- `index.html`、`half-cuts/index.html`、`engines/index.html`、`trucks/index.html`：销售 ContactPoint 结构化数据。
- `README.md`：公开项目联系方式。
- `data/knowledge-base/apsales-email-outreach-runbook.md`：更新实际上线状态。
- `MEMORY.md`：记录长期规则。
- `scripts/deploy-production.mjs`、`scripts/lib/release-manager.mjs`：新增 `sales-email` 窄范围 Release Manager 目标，避免覆盖生产中较新的页面资产。

未改：内部通知收件人、管理员白名单、`.env`、Cloudflare 转发目标、Resend 密钥。

## 发布记录

- 分支：`fix/public-sales-email-20260712`
- 代码提交：`5a5c40c93`
- 发布机制提交：`a5a440369`
- GitHub：两个提交均已推送，发布时 `HEAD == origin/fix/public-sales-email-20260712`
- 正式 Release：`REL-20260712120007-sales-email-a5a440369`
- 备份：`/root/.openclaw/workspace/inventory-site/backups/scheduled/asia-power-backup-20260712-120009.tar.gz`
- 快照：`/root/.openclaw/workspace/inventory-site/releases/REL-20260712120007-sales-email-a5a440369/snapshots`
- 回滚：`RESTORE_CONFIRM=REL-20260712120007-sales-email-a5a440369 node scripts/release-restore.mjs REL-20260712120007-sales-email-a5a440369`
- 未使用 `--allow-dirty`，未跳过 hook，未 force push。

### 发布过程异常与处置

首次尝试使用较宽的 `home` 目标：`REL-20260712115641-home-5a5c40c93`。文件同步后，Release Manager 因首页直链校验失败而中止，未生成成功 release.json。检查发现该干净分支的首页落后于当时生产页面。

已立即使用该次 Release Manager 预部署快照恢复首页，确认首页 HTTP 200 且五类目录直链全部恢复；随后新增并使用只替换公开邮箱的 `sales-email` 目标完成正式发布。最终成功 Release 如上。

## 现网验证证据

下列 URL 均返回 HTTP 200、包含 `sales@asia-power.com`，且不包含个人 Gmail 或旧 `info@`：

1. `https://asia-power.com/`
2. `https://asia-power.com/about.html`
3. `https://asia-power.com/contact.html`
4. `https://asia-power.com/half-cuts/`
5. `https://asia-power.com/engines/`
6. `https://asia-power.com/trucks/`
7. `https://asia-power.com/js/public-i18n.js?v=sales-email-v1`

另确认首页仍保留 `/half-cuts/` 等目录直链，未因本次发布回归。

## 邮件链路证据

1. DNS MX 指向 Cloudflare Email Routing：
   - priority 2：`route3.mx.cloudflare.net`
   - priority 35：`route1.mx.cloudflare.net`
   - priority 40：`route2.mx.cloudflare.net`
2. Resend MCP：
   - `asia-power.com`：`verified`
   - Sending：enabled；Receiving：disabled（收信由 Cloudflare Worker 承担，符合现有架构）
   - DKIM / SPF：verified
3. 生产 `/api/email/health`：
   - 服务 `ok=true`
   - outbound provider=`resend`
   - from/default outbound 均为 `sales@asia-power.com`
4. 端到端测试：
   - 主题：`AsiaPower sales forwarding check 2026-07-12 11:57 UTC`
   - Resend ID：`91a37969-5985-4ae9-935c-396dd160a910`
   - Resend 状态：`delivered`
   - 生产入站：命中 1 条，邮箱总数 11 → 12

## CEO 表格

| 成功 | 失败 / 缺口 | 下一步 |
|---|---|---|
| 公开页已改并上线；SEO、多语言、联系按钮统一；Resend 发信和 Cloudflare→Worker→生产入站已跑通 | 无配置失败；仅未直接登录 Gmail 查看最终转发副本 | 无需技术操作。若要 100% 确认最终副本，在 `we***@gmail.com` 搜索上述测试主题即可 |

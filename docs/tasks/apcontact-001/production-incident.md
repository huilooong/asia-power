# APCONTACT-001 — Production Incident (2026-07-13)

**结论先行：迁移并未在公网验收意义上完成。**  
源站正式营销首页与 +86 配置已在；公网仍可能看到 +233，主因是 **Cloudflare 把旧 `js/config.js` 按 immutable 缓存了约 10 天**，叠加残留页面/JS 兜底与 Service Worker 预缓存裸路径。

## 1. 公网首页实际由谁返回？

| 项 | 事实 |
|----|------|
| 入口 | `https://asia-power.com/` → Cloudflare → Nginx → `proxy_pass http://127.0.0.1:8080` |
| 应用 | `inventory-site`（`deploy/inventory-site-server.js`） |
| 文件 | `/root/.openclaw/workspace/inventory-site/public/index.html` |
| 公网 HTML（本次 curl） | 正式营销首页：`AsiaPower \| Global Powertrain…`，`page-home-v4-hybrid` |
| 源站 localhost:8080 | 同上，WhatsApp 静态链为 `wa.me/8616638801930` |

**未发现** 源站当前首页文案为「Asia-Power Auto Parts / 库存 / 供应商上传 MVP」。  
若浏览器仍见旧 MVP，优先怀疑：**本机 Service Worker / 浏览器缓存 / 旧 PWA**，不是 Nginx 指错 root。

## 2. Nginx active server block

- `sites-enabled/asia-power.com` → `sites-available/asia-power.com`
- `server_name asia-power.com`（www 301 到 apex）
- 主流量：`proxy_pass http://127.0.0.1:8080`（inventory-site）
- `root /var/www/html` 仅出现在 **default** server，不是 asia-power 主站

## 3–4. WhatsApp href 真实来源与为何仍见 +233

| 来源 | 公网状态（事故审计时） |
|------|------------------------|
| 首页 HTML 内联 nav/footer | 已是 `8616638801930` |
| `js/config.js?v=apcontact-001` | **正确** +86（CF HIT，新 cache key） |
| **`js/config.js`（无 query）** | **错误** +233；`cf-cache-status: HIT`；`age≈872864`；`last-modified: Fri, 03 Jul 2026`；`Cache-Control: public, max-age=31536000, immutable` |
| `js/config.js?v=contact-20260625` | **错误** +233（旧 bust 被 CF 冻住） |
| 浮动按钮 | `components.js` 读 `ASIAPOWER.whatsapp`（取决于加载的哪份 config） |
| `whatsapp-crm.js` / `quote-request-form.js` 兜底 | 事故时默认 `'233540911111'` |
| `campaigns/*`、`truck-heads/` | 事故时硬编码 `wa.me/233…` |

**根因一句话：**  
服务器文件已改 +86，但 Node 曾对 JS 发 **一年 immutable**；Cloudflare 边缘仍供应 7/3 的旧 body。无 Cache Purge 权限时，裸路径无法自动刷新。

## 5. 营销首页是否被覆盖？

- 源站与公网 HTML：**否**（仍是 v4 hybrid 营销首页）
- Release `home` 此前校验偶发失败，但本次核对 `index.html` 内容正确
- 生产 `public/` 目录杂乱（含 campaigns、历史文档等），**不是**用 MVP 首页覆盖了营销首页

## 6. contact.html / config.js 公网内容

- `contact.html`：动态 HTML，渠道按钮已是 +86
- `config.js`：**有 query vs 无 query 分裂**（见上表）

## 7. Cloudflare cache

| URL | cf-cache-status | 号码 |
|-----|-----------------|------|
| `/` | DYNAMIC | HTML +86 |
| `/js/config.js` | HIT（毒） | +233 |
| `/js/config.js?v=apcontact-001` | HIT | +86 |
| `/js/config.js?v=apcontact-002`（修复后） | 预期 MISS→正确 | +86 |

生产/本地 API Token：**无 Zone Cache Purge**（verify OK，purge → Authentication error）。  
Wrangler OAuth 同样无法 purge。

## 8. 四个 Release target

| Target | 作用 | 与本事故关系 |
|--------|------|----------------|
| engines | 引擎 SEO 页 | 不负责首页 config 缓存 |
| api | server.js + lib | **Cache-Control 策略在此** |
| portal | 登录/门户 | 非首页主因 |
| apsales | growth 脚本 | 与公网 WhatsApp 无关 |
| home / chrome | 首页与 listing chrome | 需与 api 一起修缓存头 |

此前宣称「迁移完成」**过早**：只验证了部分 bust 后的 URL / 源站文件，**未验证裸 `config.js` 的 CF HIT**。

## 9. Production / GitHub / Local drift

| 项 | 状态 |
|----|------|
| `js/config.js` 号码 | 本地/源站一致 +86；CF 裸路径不一致 |
| `js/whatsapp-crm.js` 等 | **曾仅存在于生产 public，本地 git 缺失** → 现已收回仓库 |
| `campaigns/`、`truck-heads/` | 生产有、本地曾无 → 现已收回并改号 |
| `public/.claude/worktrees` | 生产残留旧 worktree（含 +233），公网 404/未作为首页 |

## 修复动作（本事故）

1. 源站清除 campaigns/truck-heads/JS 兜底中的 +233  
2. `sw.js` 升版，禁止预缓存裸 `/js/config.js`  
3. HTML cache-bust → `apcontact-002`  
4. Node：`config.js` / `components.js` / `sw.js` 等改为短缓存 `max-age=60`  
5. 文档与公网复测表见 `public-validation.md`  
6. **仍需 CEO 在 Cloudflare 控制台 Purge `js/config.js`（或 Purge Everything）** — 当前 token 无法 API 清缓存

## 未做（按要求）

- 未解除 WhatsApp 白名单  
- 未对陌生客户开放 +86 接待  
- 未继续其它功能开发

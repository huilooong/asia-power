# OPS · 买家 Google / Facebook 登录接通

**Status:** 代码与生产底座已就绪 · **阻塞：等 CEO 提供 4 个密钥**  
**Date:** 2026-07-10

## 结论

| 项 | 结果 |
|----|------|
| OAuth state 落盘 | ✅ 已上线（`data/oauth-pending-states.json`） |
| `PUBLIC_BASE_URL` | ✅ `https://asia-power.com` |
| 登录页按配置显示文案 | ✅ 未配密钥时显示「测试登录」；配齐后自动变 Continue with… |
| 生产密钥 | ❌ Google / Facebook **仍 MISSING** → `demoMode: true` |
| 真跳转验证 | ⏸ 等密钥写入后立刻验 |

## 已部署

| Release | Target |
|---------|--------|
| `REL-20260710061528-api-76489479` | api（含 `oauth-auth.js` 落盘） |
| `REL-20260710061653-portal-76489479` | portal（`login.js?v=oauth-ready-v1`） |

## 现网证据

```text
GET /api/auth/oauth/providers
→ google.configured=false, facebook.configured=false, demoMode=true
→ publicBase=https://asia-power.com
→ callbacks 正确

GET /api/auth/oauth/start?provider=google
→ demo=true, url=/api/auth/oauth/demo?...

登录页按钮：Google 测试登录 / Facebook 测试登录
```

## 写入密钥（拿到后 1 分钟）

```bash
# /tmp/asiapower-oauth.secrets.env（勿提交 git）
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...

node scripts/apply-oauth-credentials.mjs --file /tmp/asiapower-oauth.secrets.env
rm /tmp/asiapower-oauth.secrets.env
```

或把 4 行私聊发给我，我直接写入生产。

## 回调地址（创建应用时原样粘贴）

- Google：`https://asia-power.com/api/auth/oauth/google/callback`
- Facebook：`https://asia-power.com/api/auth/oauth/facebook/callback`

## CEO 操作指引

见 [`ops-oauth-ceo-setup.md`](./ops-oauth-ceo-setup.md)

## 文件变更

| 文件 | 说明 |
|------|------|
| `server/lib/oauth-auth.js` | pendingStates 落盘；按 provider 判断 demo |
| `js/login.js` | 按 configured 切换按钮文案 |
| `login/index.html` | cache bust `oauth-ready-v1` |
| `.env.example` | 回调说明 + 空密钥占位 |
| `scripts/apply-oauth-credentials.mjs` | 安全写入生产 .env |
| `docs/ops/ops-oauth-ceo-setup.md` | CEO 创建指引 |

## 验证（已做 / 待做）

| 步骤 | 结果 |
|------|------|
| providers 返回 publicBase + callbacks | ✅ |
| OAuth state 落盘 | ✅ |
| 手机 OTP demo `123456` | ✅ |
| Google/Facebook `configured:true` | ❌ 缺密钥 |
| 真跳转 accounts.google.com | ❌ 缺密钥 |

## 下一步（等 CEO）

1. 粘贴密钥，或回复「带我创建」
2. 写入后验证：`configured:true` → 点按钮进 `accounts.google.com` → 回买家门户

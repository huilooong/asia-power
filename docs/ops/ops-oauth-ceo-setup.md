# OPS · 买家 Google / Facebook OAuth 开通（CEO）

**Status:** 代码已就绪 · 等密钥写入生产  
**Date:** 2026-07-10

## 一句话

登录按钮已经接好。要弹出真 Google/Facebook，只需在控制台创建应用，把 4 个密钥给我（或自己跑写入脚本）。

## 回调地址（创建时原样粘贴）

| 平台 | Redirect / Callback URI |
|------|-------------------------|
| Google | `https://asia-power.com/api/auth/oauth/google/callback` |
| Facebook | `https://asia-power.com/api/auth/oauth/facebook/callback` |

## Google（约 10 分钟）

1. 打开 https://console.cloud.google.com/
2. 新建或选择项目（建议名：AsiaPower）
3. **APIs & Services → OAuth consent screen**
   - User type: External
   - App name: AsiaPower
   - Support email: 您的邮箱
   - 保存；测试阶段可先加测试用户（您的 Gmail）
4. **Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: AsiaPower Web
   - Authorized redirect URIs: 填上表 Google 回调
5. 复制 **Client ID** 与 **Client Secret**

## Facebook（约 10 分钟）

1. 打开 https://developers.facebook.com/
2. 创建应用（选**消费者**类型；买家登录不要用「企业版 Facebook 登录 / Facebook Login for Business」）
3. 添加产品 **Facebook 登录 → 网页**（标准 Facebook Login，不是 Business）
4. 设置 → 基本：复制 **应用编号**、**应用密钥**
5. Facebook 登录 → 设置 → 有效 OAuth 重定向 URI：填上表 Facebook 回调
6. **用例 / Use Cases → 身份验证与账号创建 → 自定义**：把 `email`、`public_profile` 都加成「可测试 / Ready」
7. 开发模式下：把您的 Facebook 账号加为**测试用户/角色**，否则外人登不了

### 若报错 `Invalid Scopes: email`

| 原因 | 怎么处理 |
|------|----------|
| 开了「企业版 Facebook 登录」 | 产品设置里改回标准 **Facebook Login**（网页） |
| 用例里没启用 `email` | Use Cases → 身份验证 → 添加 `email` |
| 现网临时规避 | 生产可只请求 `public_profile`（已默认）；Meta 开好 email 后再设 `FACEBOOK_OAUTH_SCOPE=public_profile,email` |

## 把密钥交给系统（二选一）

### 方式 A — 发给我

私聊粘贴（不要发到公开群）：

```
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...
```

我执行写入并重启。

### 方式 B — 您本地一键写入

在仓库根目录建临时文件（勿提交 git）：

```bash
# 文件：/tmp/asiapower-oauth.secrets.env
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...
```

```bash
node scripts/apply-oauth-credentials.mjs --file /tmp/asiapower-oauth.secrets.env
rm /tmp/asiapower-oauth.secrets.env
```

## 验证

```bash
curl -sS https://asia-power.com/api/auth/oauth/providers
# 期望：google.configured=true（若已配），demoMode 随配置变化

# 浏览器打开
# https://asia-power.com/login/?role=buyer
# 点 Continue with Google → 应跳到 accounts.google.com
```

## 已完成的工程侧

- OAuth state 落盘：`data/oauth-pending-states.json`（防重启丢回调）
- 登录页按「是否已配置」显示真按钮 / 测试登录
- `PUBLIC_BASE_URL` 写入生产
- 写入脚本：`scripts/apply-oauth-credentials.mjs`

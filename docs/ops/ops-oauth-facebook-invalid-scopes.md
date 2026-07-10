# OPS · Facebook Invalid Scopes: email

**Status:** 代码已修并部署 · 现网 scope=`public_profile` 已验证 · Meta 后台权限仍需人工点开  
**Date:** 2026-07-10  
**App:** AsiaPower Customer Connect (`1026929409720165`)  
**相关：** `docs/ops/ops-oauth-facebook-meta-console-2026-07-10.md`（右侧浏览器操作失败记录）

## 根因

| 项 | 说明 |
|----|------|
| 现网原 scope | `email,public_profile` |
| 报错 | `Invalid Scopes: email`（开发者账号会看到；普通用户可能静默忽略） |
| 含义 | Meta App 当前未把消费者 `email` 权限挂到可用用例，或开了「企业版 Facebook 登录」导致 consumer email 无效 |
| 代码侧 | scope 写法本身没错；问题在 Meta 控制台权限/产品类型 |

## 已改代码

| 文件 | 改动 |
|------|------|
| `server/lib/oauth-auth.js` | 默认 scope=`public_profile`；可用 `FACEBOOK_OAUTH_SCOPE` 覆盖；无 email 时用 `fb-{id}@facebook.oauth.local` 兜底；Graph 拉 email 失败则降级 id/name |
| `.env.example` | 补充 `FACEBOOK_OAUTH_SCOPE` 说明 |
| `docs/ops/ops-oauth-ceo-setup.md` | 补充 Invalid Scopes 处理步骤 |

## CEO 在 Meta 后台要做的（约 3 分钟）

1. 打开 https://developers.facebook.com/apps/1026929409720165/
2. 确认产品是 **Facebook 登录（网页）**，不是「企业版 Facebook 登录 / Login for Business」
3. **用例 → 身份验证与账号创建 → 自定义**：添加 `email`、`public_profile`，状态为可测试
4. Facebook 登录 → 设置：确认回调  
   `https://asia-power.com/api/auth/oauth/facebook/callback`
5. 开好后告诉我，我再把生产设为  
   `FACEBOOK_OAUTH_SCOPE=public_profile,email`

## 验证

```bash
curl -sS 'https://asia-power.com/api/auth/oauth/start?provider=facebook&next=/portal/'
# 期望 scope=public_profile（临时）或 public_profile%2Cemail（Meta 开好后）
```

浏览器：https://asia-power.com/login/?role=buyer → Continue with Facebook → 不应再出现 Invalid Scopes。

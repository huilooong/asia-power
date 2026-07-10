# OPS · Facebook 登录入口下线（2026-07-10）

**Status:** 已下线（CEO 明确决定）  
**原因：** Meta 权限难维护；反复操作 Meta/浏览器导致 CEO 电脑无法正常使用。

## 决定

- 买家登录页**不再显示** Facebook 按钮
- 保留 Google + 手机验证码
- 后端 `/api/auth/oauth/start?provider=facebook` 返回 **410**（`facebook_login_disabled`）
- 禁止再打开 Meta 开发者后台做登录权限调试

## 改动

| 文件 | 变更 |
|------|------|
| `login/index.html` | 删除 Facebook 按钮 |
| `js/login.js` | 去掉 Facebook UI / 点击逻辑；文案只提 Google |
| `server/lib/oauth-auth.js` | `FACEBOOK_LOGIN_ENABLED` 默认关；start/demo/callback 拒绝 Facebook |
| `.env.example` | 注明 Facebook 入口已退役 |

## 重新开启（不推荐）

仅当 CEO 明确要求时：生产 `.env` 设 `FACEBOOK_LOGIN_ENABLED=1`，并恢复登录页按钮。

## 验证

- https://asia-power.com/login/?role=buyer — 无 Facebook 按钮，有 Google
- `curl -sS 'https://asia-power.com/api/auth/oauth/start?provider=facebook&next=/buyer-portal/'` → 410 / disabled

## 生产 Release

| Target | Release ID |
|--------|------------|
| portal | REL-20260710091706-portal-76489479 |
| api | REL-20260710091829-api-76489479 |

# OPS — Portal auth: buyer login + OAuth honesty

**Date:** 2026-07-10  
**Status:** Deploying

## CEO issues

| Issue | Root cause |
|-------|------------|
| 注册页「没落地」 | `/login/` 已上线；营销页曾写「verified」造成误解 |
| 供应商验证发布了信息 | 文案写「Verified Supplier」，但注册后并无人工认证闸门 |
| 买家登录失败 | 演示验证码限流返回 429；提示不清晰 |
| 没调动 Google/Facebook | 生产 `.env` **没有** `GOOGLE_OAUTH_*` / `FACEBOOK_*` 密钥 → 只能走站内测试登录 |

## Fixes shipped

1. Login UI：明确标注「Google/Facebook 测试登录」；手机验证码提示 `123456`
2. OTP：演示模式下冷却期内重发同一码，不再 429 卡死
3. 已登录用户：显示「进入工作台 / 退出」，不再静默跳走导致以为注册页没了
4. 供应商营销页：去掉「Verified / 验证供应商」误导文案

## Real Google / Facebook (needs CEO)

在生产 `.env` 配置后重启 API：

```
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...
PUBLIC_BASE_URL=https://asia-power.com
```

控制台回调 URL：
- `https://asia-power.com/api/auth/oauth/google/callback`
- `https://asia-power.com/api/auth/oauth/facebook/callback`

## How to login now (buyer)

1. https://asia-power.com/login/?role=buyer
2. 填手机号 → Send → 自动填入 `123456` → Sign in
3. 或点「Google 测试登录 / Facebook 测试登录」进入买家门户

## Supplier register

https://asia-power.com/login/?role=supplier&mode=register  
Demo OTP: `888888`（点 Send 后自动填入）

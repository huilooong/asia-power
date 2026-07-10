# OPS · Facebook Meta 后台权限（右侧浏览器操作）

**Status:** 阻塞 — 必须 CEO 完成 Facebook 登录 / 两步验证  
**Date:** 2026-07-10  
**App:** AsiaPower Customer Connect (`1026929409720165`)

## 结论（给 CEO）

| 项 | 结果 |
|----|------|
| 行不行 | **现在不行** — 卡在登录，不是权限菜单找不到 |
| 做到哪 | 已打开 Meta App 链接；系统 Safari 已到登录/两步验证页 |
| Meta 后台权限 | **未操作** — 进不去控制台 |
| 现网登录实测 | **未测** |
| 还要 CEO 什么 | **请现在在前台 Safari/浏览器完成 Facebook 登录 + 两步验证**，完成后回「好了」 |

## 本轮真实动作（非空转）

1. Cursor 右侧 `browser_tabs` `new` + `position=side` → 得到 viewId，下一秒 `browser_navigate` 报 `Browser view not found`（标签闪没，与上次同病）
2. `open` / Safari 打开 `https://developers.facebook.com/apps/1026929409720165/`
3. Safari 实际落到：
   - `web.facebook.com/two_step_verification/authentication/...`（两步验证）
   - `business.facebook.com/business/loginpage/?next=...developers.facebook.com/apps/1026929409720165/`

## CEO 登录完成后我继续做

1. 用例 / Use cases → Authenticate… / 身份验证 → Customize → `public_profile`（+`email`）
2. 或 Products → Facebook Login → Settings（确认回调 URI）
3. 或 App Review → Permissions and Features
4. 测：https://asia-power.com/login/?role=buyer → Continue with Facebook

## 已验证（命令，此前）

```text
GET /api/auth/oauth/start?provider=facebook
→ ok=true
→ scope=public_profile
→ client_id=1026929409720165
→ callback=https://asia-power.com/api/auth/oauth/facebook/callback
```

## 不做

- 不部署 photo compress
- 不删数据
- 未登录前不假装已开权限

# OPS · 修好 Facebook「使用 Google 验证」（redirect_uri_mismatch）

**Status:** www→web 是 Facebook 强制跳转，不要对抗  
**Date:** 2026-09-10  
**实测：** `redirect_uri=https://web.facebook.com/oauth2/redirect/` → 必须在 **Google 请求里**改成 www；Facebook 页面可以留在 web。

## 结论

| 项 | 说明 |
|----|------|
| www 自动变 web | **正常**，再改地址栏会打转 |
| 正确修法 | 人留在 `web.facebook.com`，只改发给 Google 的 `redirect_uri` |
| 怎么改 | Chrome 加载插件 `integrations/social_browser/chrome-facebook-www-guard`（不要无痕） |
| 不要 | 去 Google Cloud Console 登记 facebook.com；不要跟 www↔web 对着干 |

## CEO 步骤

1. 关无痕  
2. `chrome://extensions` → 开发者模式 → 加载已解压 → `chrome-facebook-www-guard`  
3. 打开 https://web.facebook.com/  
4. 点「使用 Google 验证」

备用：https://mbasic.facebook.com/

## Agent

Playwright 只拦截 `accounts.google.com`，不把 Facebook 从 web 打回 www。

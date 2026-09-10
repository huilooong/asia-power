# OPS · 修好 Facebook「使用 Google 验证」（redirect_uri_mismatch）

**Status:** 已提供本机修复（书签 / Chrome 插件 / Playwright 改写）  
**Date:** 2026-09-10  
**实测错误详情（CEO 2026-09-10）：**  
`redirect_uri=https://web.facebook.com/oauth2/redirect/`  
必须变成 `https://www.facebook.com/oauth2/redirect/` 后再点 Google。红字页本身改不了 Google 云后台；要先回 www 再验证。

## 结论

| 项 | 说明 |
|----|------|
| 能不能修 Google 这一步 | **能，在你电脑浏览器里改回跳地址**（Facebook/Google 云后台我们进不去） |
| 手机 App 已登录 | 不能给 Agent 用；电脑必须过验证才能存会话 |
| Graph Explorer | 备用；你说走不通就先不用 |
| 不要用无痕窗口 | 无痕会当成新设备，更容易触发 Google 验证 |

## 你现在怎么做（办法 A · 最快）

1. 打开预览页（可双击 `docs/打开-Facebook修好Google验证.command`）：  
   `docs/previews/ops-meta-google-verify/fix-google-redirect.html`
2. 把蓝色按钮 **「修好Facebook回跳」拖到书签栏**
3. 关闭所有无痕窗口
4. 普通 Chrome 打开 https://www.facebook.com/
5. 出现「使用 Google 验证」→ 点下去如果变成红字，**立刻点书签**
6. 选 `gooddlong@gmail.com` 完成验证

## 办法 B · 装插件（Agent / 以后每次自动改）

Chrome → `chrome://extensions` → 开发者模式 → 加载已解压：  
`integrations/social_browser/chrome-facebook-www-guard`

## Agent 浏览器

`integrations/social_browser/facebook_host.py` 会把 Google OAuth 的 `redirect_uri` 从 `web.facebook.com` 改成 `www.facebook.com`。  
本机过验证：

```bash
APSALES_SOCIAL_BROWSER_HEADLESS=0 .venv/bin/python3 scripts/apsales-facebook-google-verify.py
```

## 验证

`python3 -m unittest tests.test_facebook_host`

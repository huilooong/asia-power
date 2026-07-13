# PWA App Shell — 真正像 APP

## 用户反馈

「还是个浏览器页面，哪里像个 app」——仅「添加到桌面」不够；打开后仍是营销网站。

## 本次改动

Standalone / `?app=1` 预览时启用 **App 壳**：

- 顶部：品牌 + 搜索栏（无网站顶栏）
- 底部：首页 / 库存 / 发动机 / 卡车 / 询价 Tab
- 隐藏：页脚、WhatsApp 悬浮球、安装按钮、网站导航
- 首页压缩营销 Hero，更像 APP 首页

## 如何验证（重要）

1. **浏览器里直接看首页** → 仍是网站（正常）
2. 预览 APP 模式：打开 `https://asia-power.com/?app=1` → 应出现顶栏+底栏
3. 真正 APP：安装到桌面后，**从桌面图标打开**（无地址栏）→ 自动 App 壳

## Tests

`node scripts/test-pwa-install.mjs` → FAIL 0

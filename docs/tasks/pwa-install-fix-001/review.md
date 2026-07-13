# PWA Install Fix — 2026-07-13

## Problem

首页「添加到桌面」在 `beforeinstallprompt` 未触发时会显示 **disabled** 按钮，点击无反应，看起来像坏了。

## Fix

- 可点击 FAB（图标 + 文案），打开底部安装面板
- Chrome/Edge：有系统弹窗则一键安装
- iOS/其它：显示可操作步骤（不再灰掉按钮）
- 样式更像 APP 安装卡；manifest theme `#0a1628`
- `deploy:home` 同步 `pwa-install.js/css`、`manifest.json`、`app.html`、`sw.js`

## Tests

```bash
node scripts/test-pwa-install.mjs
```

Result: **TOTAL FAIL 0** (31 checks)

#!/bin/bash
# 双击运行：在浏览器打开「国内同事 · 腾讯云操作清单」
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="$ROOT/docs/wecom-domestic-colleague-checklist.html"

open "$FILE"

clear
echo "══════════════════════════════════════════════════════════"
echo "  国内同事 · 腾讯云操作清单（asia-power.cn）"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "✅ 已在浏览器打开图文清单"
echo ""
echo "文件位置（备用）："
echo "  $FILE"
echo ""
echo "发给国内同事：把这个 .command 文件一起转发，对方双击即可。"
echo ""
echo "按回车关闭本窗口…"
read -r

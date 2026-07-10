#!/bin/bash
# 双击运行：在浏览器打开「腾讯云购域名 + 备案」CEO 清单
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="$ROOT/docs/wecom-tencent-buy-checklist.html"

open "$FILE"

clear
echo "══════════════════════════════════════════════════════════"
echo "  企业微信 · 腾讯云购域名 + 备案 — CEO 一步一步"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "✅ 已在浏览器打开图文清单"
echo ""
echo "文件位置（备用）："
echo "  $FILE"
echo ""
echo "若浏览器没弹出：Finder 进入 AsiaPower/docs，双击本文件再试一次。"
echo ""
echo "按回车关闭本窗口…"
read -r

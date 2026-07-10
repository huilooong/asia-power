#!/bin/bash
# 双击运行：用「文本编辑」打开子龙群内上传 CEO 说明
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="$ROOT/docs/子龙-群内上传-CEO简明版.md"

open -a "TextEdit" "$FILE"

clear
echo "══════════════════════════════════════════════════════════"
echo "  企业微信 · 子龙群内上传 — CEO 简明说明"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "✅ 已在「文本编辑」打开说明"
echo ""
echo "文件位置（备用）："
echo "  $FILE"
echo ""
echo "按回车关闭本窗口…"
read -r

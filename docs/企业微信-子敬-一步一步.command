#!/bin/bash
# 双击运行：打开管理后台 + 检查清单 + 启动子敬回调服务（端口 8791）
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ADMIN_URL="https://work.weixin.qq.com/wework_admin/frame"
CHECKLIST="$ROOT/docs/wecom-ceo-checklist.html"
PORT=8791
VENV_PY="$ROOT/.venv/bin/python3"
CALLBACK="$ROOT/integrations/wecom_callback_server.py"

clear
echo "══════════════════════════════════════════════════════════"
echo "  AsiaPower · 企业微信「AsiaPower 库存 Agent」一步一步"
echo "  （我们内部叫「子敬」）"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "【CEO 检查清单】"
echo "  1. 浏览器会打开：企业微信管理后台"
echo "  2. 另一页会打开：中文图文清单（wecom-ceo-checklist.html）"
echo "  3. 若还没填密钥，先在终端运行："
echo "       $VENV_PY scripts/wecom-setup-wizard.py"
echo ""
echo "【管理后台要做的事】"
echo "  □ 我的企业 → 复制「企业 ID」"
echo "  □ 应用管理 → 创建/打开「AsiaPower 库存 Agent」→ 复制 AgentId 和 Secret"
echo "  □ 接收消息 → 设置 API 接收（Token + EncodingAESKey 与 .env 一致）"
echo "  □ 把 AsiaPower 库存 Agent 拉进测试群 → 群里 @AsiaPower 库存 Agent 发 /ping"
echo ""
echo "【本机回调】"
echo "  端口: $PORT（避免与 8790 预览页冲突）"
echo "  管理后台填的 URL = WECOM_PUBLIC_BASE_URL + /wecom/callback"
echo "  开发时需另开终端: ngrok http $PORT"
echo ""
echo "══════════════════════════════════════════════════════════"
echo ""

open "$ADMIN_URL"
open "$CHECKLIST"

export WECOM_CALLBACK_PORT=$PORT

if [ ! -x "$VENV_PY" ]; then
  echo "❌ 找不到 Python: $VENV_PY"
  echo "按回车关闭…"
  read -r
  exit 1
fi

if lsof -i :"$PORT" >/dev/null 2>&1; then
  echo "⚠️  端口 $PORT 已被占用，可能回调已在运行。"
  echo "按回车关闭本窗口（不影响已在跑的服务）…"
  read -r
  exit 0
fi

echo "正在启动子敬回调服务（Ctrl+C 可停止）…"
echo ""
"$VENV_PY" "$CALLBACK"

echo ""
echo "回调已停止。按回车关闭窗口…"
read -r

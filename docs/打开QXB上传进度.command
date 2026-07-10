#!/bin/bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PORT=8790
if lsof -i :$PORT >/dev/null 2>&1; then
  echo "预览服务已在运行 (端口 $PORT)"
else
  python3 -m http.server "$PORT" >/dev/null 2>&1 &
  sleep 1
fi
open "http://127.0.0.1:$PORT/docs/qxb-upload-progress.html"
echo "已打开 QXB 上传进度: http://127.0.0.1:$PORT/docs/qxb-upload-progress.html"

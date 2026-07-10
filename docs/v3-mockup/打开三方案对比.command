#!/bin/bash
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
PORT=8790
if lsof -i :$PORT >/dev/null 2>&1; then
  echo "预览服务已在运行 :$PORT"
else
  python3 -m http.server "$PORT" >/dev/null 2>&1 &
  sleep 0.5
  echo "已启动预览服务 :$PORT"
fi
open "http://127.0.0.1:$PORT/docs/v3-mockup/home-schemes-compare.html"
echo "已在浏览器打开三套首页方案对比"

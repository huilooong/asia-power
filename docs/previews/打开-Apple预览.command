#!/bin/bash
cd "$(dirname "$0")/../.."
echo "启动本地预览服务器…"
echo "浏览器打开: http://127.0.0.1:8899/docs/previews/apple-pure-preview.html"
python3 -m http.server 8899

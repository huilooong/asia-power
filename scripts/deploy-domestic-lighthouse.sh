#!/usr/bin/env bash
# Deploy AsiaPower WeCom callback to domestic Lighthouse (Mac → 124.222.191.164).
# Usage:
#   bash scripts/deploy-domestic-lighthouse.sh ~/.ssh/skey-qaee9b07.pem
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IP="${DOMESTIC_LIGHTHOUSE_IP:-124.222.191.164}"
EMAIL="${CERTBOT_EMAIL:-289106218@qq.com}"
KEY="${1:-}"

if [[ -z "$KEY" || ! -f "$KEY" ]]; then
  echo "用法: bash scripts/deploy-domestic-lighthouse.sh ~/.ssh/你的腾讯云私钥.pem" >&2
  echo "私钥: Lighthouse 控制台 → 密钥 lhkp-i2jbkbhg → 下载" >&2
  exit 1
fi

chmod 600 "$KEY"
SSH=(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "root@${IP}")
RSYNC=(rsync -az -e "ssh -i $KEY -o StrictHostKeyChecking=accept-new")

echo "[deploy] rsync → root@${IP}:/opt/AsiaPower"
"${RSYNC[@]}" \
  --exclude '.venv*' --exclude '.git' --exclude 'node_modules' \
  --exclude 'memory/' --exclude 'docs/' --exclude 'output/' --exclude 'reports/' --exclude 'assets/' \
  --exclude 'data/' --exclude 'work/' \
  "${ROOT}/" "root@${IP}:/opt/AsiaPower/"

echo "[deploy] copy .env"
scp -i "$KEY" -o StrictHostKeyChecking=accept-new "${ROOT}/.env" "root@${IP}:/opt/AsiaPower/.env"

echo "[deploy] install on server"
"${SSH[@]}" "WECOM_ROOT=/opt/AsiaPower CERTBOT_EMAIL=${EMAIL} bash /opt/AsiaPower/deploy/install-wecom-domestic.sh"

echo "[deploy] verify"
curl -sS -o /dev/null -w "HTTPS callback HTTP %{http_code}\n" "https://asia-power.cn/wecom/callback" || true
echo "Done. CEO: 企微后台 URL → https://asia-power.cn/wecom/callback · 可信 IP → ${IP}"

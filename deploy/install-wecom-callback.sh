#!/usr/bin/env bash
# Install WeCom callback as systemd service + optional nginx snippet hint.
# Run on production as root after AsiaPower code is synced to WECOM_ROOT.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
WECOM_ROOT="${WECOM_ROOT:-/root/.openclaw/workspace/AsiaPower}"
SERVICE_NAME="wecom-callback"
TEMPLATE="$DEPLOY_DIR/wecom-callback.service"
TARGET="/etc/systemd/system/${SERVICE_NAME}.service"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Error: run as root (sudo bash deploy/install-wecom-callback.sh)" >&2
  exit 1
fi

if [[ ! -d "$WECOM_ROOT/integrations" ]]; then
  echo "Error: $WECOM_ROOT/integrations missing — sync AsiaPower repo first." >&2
  exit 1
fi

if [[ -x "$WECOM_ROOT/.venv/bin/python" ]]; then
  PYTHON="$WECOM_ROOT/.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON="$(command -v python3)"
else
  echo "Error: python3 not found." >&2
  exit 1
fi

if [[ ! -f "$WECOM_ROOT/.env" ]]; then
  echo "Error: $WECOM_ROOT/.env missing — add WECOM_* vars first." >&2
  exit 1
fi

echo "[install] Verifying WeCom config..."
if ! (cd "$WECOM_ROOT" && "$PYTHON" scripts/wecom-verify-config.py); then
  echo "Error: wecom-verify-config failed — fix .env before install." >&2
  exit 1
fi

echo "[install] Installing ${SERVICE_NAME}.service"
sed \
  -e "s|@@WECOM_ROOT@@|${WECOM_ROOT}|g" \
  -e "s|@@PYTHON@@|${PYTHON}|g" \
  "$TEMPLATE" > "$TARGET"

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

echo "[install] Done. Status:"
systemctl status "$SERVICE_NAME" --no-pager || true
echo ""
CALLBACK_URL="$(grep -E '^WECOM_PUBLIC_BASE_URL=' "$WECOM_ROOT/.env" 2>/dev/null | cut -d= -f2-)/wecom/callback" || true
echo "Callback URL should be: ${CALLBACK_URL:-https://asia-power.cn/wecom/callback}"
echo "Logs: journalctl -u ${SERVICE_NAME} -f"
echo "Ensure nginx location = /wecom/callback → 127.0.0.1:8791 (see deploy/nginx-asia-power.com)"

#!/usr/bin/env bash
# Install APCOO as a systemd service (requires root).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_NAME="apcoo"
TEMPLATE="$DEPLOY_DIR/apcoo.service"
TARGET="/etc/systemd/system/${SERVICE_NAME}.service"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Error: run as root (sudo bash deploy/install_service.sh)" >&2
  exit 1
fi

if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON="$(command -v python3)"
else
  echo "Error: python3 not found. Create venv: python3 -m venv .venv && pip install -r requirements-ai-os.txt" >&2
  exit 1
fi

if [[ ! -f "$ROOT/.env" ]]; then
  echo "Error: $ROOT/.env missing. Copy .env.example and configure secrets first." >&2
  exit 1
fi

echo "[install] Running healthcheck before install..."
if ! (cd "$ROOT" && "$PYTHON" -m runtime.healthcheck); then
  echo "Error: healthcheck failed — service will not be installed." >&2
  exit 1
fi

echo "[install] Installing ${SERVICE_NAME}.service"
sed \
  -e "s|@@APCOO_ROOT@@|${ROOT}|g" \
  -e "s|@@PYTHON@@|${PYTHON}|g" \
  "$TEMPLATE" > "$TARGET"

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl start "$SERVICE_NAME"

echo "[install] Done. Status:"
systemctl status "$SERVICE_NAME" --no-pager || true
echo ""
echo "Logs: journalctl -u ${SERVICE_NAME} -f"
echo "Or:   bash deploy/tail_logs.sh"

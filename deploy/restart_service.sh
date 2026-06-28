#!/usr/bin/env bash
# Restart APCOO systemd service.
set -euo pipefail

SERVICE_NAME="apcoo"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Error: run as root (sudo bash deploy/restart_service.sh)" >&2
  exit 1
fi

if ! systemctl list-unit-files "$SERVICE_NAME.service" --no-legend 2>/dev/null | grep -q "$SERVICE_NAME"; then
  echo "Error: ${SERVICE_NAME}.service not installed. Run: sudo bash deploy/install_service.sh" >&2
  exit 1
fi

systemctl restart "$SERVICE_NAME"
echo "[restart] ${SERVICE_NAME} restarted."
systemctl status "$SERVICE_NAME" --no-pager || true

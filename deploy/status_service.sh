#!/usr/bin/env bash
# Show APCOO systemd service status.
set -euo pipefail

SERVICE_NAME="apcoo"

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemctl not available on this host (macOS/local dev)."
  echo "Production: run on Linux server with systemd."
  exit 0
fi

if ! systemctl list-unit-files "${SERVICE_NAME}.service" --no-legend 2>/dev/null | grep -q "${SERVICE_NAME}"; then
  echo "APCOO service not installed."
  echo "Install: sudo bash deploy/install_service.sh"
  exit 0
fi

systemctl status "$SERVICE_NAME" --no-pager

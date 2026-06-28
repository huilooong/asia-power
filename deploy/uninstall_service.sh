#!/usr/bin/env bash
# Uninstall APCOO systemd service (requires root).
set -euo pipefail

SERVICE_NAME="apcoo"
TARGET="/etc/systemd/system/${SERVICE_NAME}.service"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Error: run as root (sudo bash deploy/uninstall_service.sh)" >&2
  exit 1
fi

if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
  echo "[uninstall] Stopping ${SERVICE_NAME}..."
  systemctl stop "$SERVICE_NAME"
fi

if systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
  echo "[uninstall] Disabling ${SERVICE_NAME}..."
  systemctl disable "$SERVICE_NAME"
fi

if [[ -f "$TARGET" ]]; then
  echo "[uninstall] Removing $TARGET"
  rm -f "$TARGET"
fi

systemctl daemon-reload
systemctl reset-failed "$SERVICE_NAME" 2>/dev/null || true

echo "[uninstall] APCOO service removed."

#!/usr/bin/env bash
# Tail APCOO logs from journalctl.
set -euo pipefail

SERVICE_NAME="apcoo"
LINES="${1:-100}"

if ! command -v journalctl >/dev/null 2>&1; then
  echo "journalctl not available on this host (macOS/local dev)."
  echo "Local logs: logs/dispatch-*.log and memory/daily_logs/"
  ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  if [[ -d "$ROOT/logs" ]]; then
    echo ""
    echo "Recent dispatch logs:"
    ls -lt "$ROOT/logs" 2>/dev/null | head -5 || true
  fi
  if [[ -f "$ROOT/memory/daily_logs/runtime-heartbeat.md" ]]; then
    echo ""
    echo "Runtime heartbeat (last 20 lines):"
    tail -20 "$ROOT/memory/daily_logs/runtime-heartbeat.md"
  fi
  exit 0
fi

if ! systemctl list-unit-files "${SERVICE_NAME}.service" --no-legend 2>/dev/null | grep -q "${SERVICE_NAME}"; then
  echo "APCOO service not installed."
  echo "Install: sudo bash deploy/install_service.sh"
  exit 0
fi

if [[ "${1:-}" == "-f" || "${1:-}" == "--follow" ]]; then
  journalctl -u "$SERVICE_NAME" -f --no-pager
else
  journalctl -u "$SERVICE_NAME" -n "$LINES" --no-pager
fi

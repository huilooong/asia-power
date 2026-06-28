#!/bin/bash
# Restart inventory-site if the health endpoint stops responding.
set -euo pipefail
URL="${1:-http://127.0.0.1:8080/api/half-cuts/health}"
LOG="/var/log/asiapower-health-watch.log"
if curl -sf --max-time 5 "$URL" >/dev/null; then
  exit 0
fi
{
  echo "$(date -Is) health check failed — restarting inventory-site"
  free -h | sed 's/^/  /'
  systemctl show inventory-site.service --property=MemoryCurrent,MemoryMax --value 2>/dev/null | awk 'NR==1{printf "  node_mem=%s\n", $0} NR==2{printf "  node_max=%s\n", $0}'
} >> "$LOG"
systemctl restart inventory-site.service

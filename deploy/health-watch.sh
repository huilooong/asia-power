#!/bin/bash
# Restart inventory-site if the health endpoint stops responding.
# Also alert via Telegram when root disk usage exceeds DISK_WARN_PCT (default 80%).
set -euo pipefail

URL="${1:-http://127.0.0.1:8080/api/half-cuts/health}"
LOG="/var/log/asiapower-health-watch.log"
DISK_WARN_PCT="${DISK_WARN_PCT:-80}"
DISK_ALERT_STATE="${DISK_ALERT_STATE:-/var/tmp/asiapower-disk-alert.state}"
DISK_ALERT_COOLDOWN_SEC="${DISK_ALERT_COOLDOWN_SEC:-21600}" # 6 hours between repeats
ENV_FILE="/root/.openclaw/workspace/AsiaPower/.env"

env_val() {
  local key="$1"
  [ -f "$ENV_FILE" ] || return 0
  grep -E "^${key}=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '[:space:]' || true
}

send_telegram() {
  local text="$1"
  local token chat
  token="$(env_val ASIAPOWER_TELEGRAM_BOT_TOKEN)"
  [ -n "$token" ] || token="$(env_val TELEGRAM_BOT_TOKEN)"
  if [ -z "$token" ] && [ -f /root/.openclaw/credentials/telegram-bot-token ]; then
    token="$(tr -d '[:space:]' </root/.openclaw/credentials/telegram-bot-token || true)"
  fi
  chat="$(env_val ASIAPOWER_TELEGRAM_CHAT_ID)"
  [ -n "$chat" ] || chat="$(env_val TELEGRAM_CHAT_ID)"
  if [ -z "$token" ] || [ -z "$chat" ]; then
    return 0
  fi
  curl -sf --max-time 10 -X POST "https://api.telegram.org/bot${token}/sendMessage" \
    -d "chat_id=${chat}" \
    --data-urlencode "text=${text}" \
    -d "disable_web_page_preview=true" >/dev/null 2>&1 || true
}

# --- Disk usage alert (runs every cron tick; cooldown prevents spam) ---
usage="$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
if [ -n "${usage:-}" ] && [ "$usage" -ge "$DISK_WARN_PCT" ] 2>/dev/null; then
  now="$(date +%s)"
  last=0
  if [ -f "$DISK_ALERT_STATE" ]; then
    last="$(tr -d '[:space:]' <"$DISK_ALERT_STATE" 2>/dev/null || echo 0)"
  fi
  if ! [[ "$last" =~ ^[0-9]+$ ]]; then last=0; fi
  if [ $((now - last)) -ge "$DISK_ALERT_COOLDOWN_SEC" ]; then
    df_line="$(df -h / | awk 'NR==2 {print $3 " used / " $2 " (" $5 ")"}')"
    msg="⚠️ AsiaPower disk ${usage}% (threshold ${DISK_WARN_PCT}%) on $(hostname) — ${df_line}"
    echo "$(date -Is) disk alert: ${usage}% — ${df_line}" >>"$LOG"
    send_telegram "$msg"
    echo "$now" >"$DISK_ALERT_STATE"
  fi
fi

# --- HTTP health ---
if curl -sf --max-time 5 "$URL" >/dev/null; then
  exit 0
fi
{
  echo "$(date -Is) health check failed — restarting inventory-site"
  free -h | sed 's/^/  /'
  systemctl show inventory-site.service --property=MemoryCurrent,MemoryMax --value 2>/dev/null | awk 'NR==1{printf "  node_mem=%s\n", $0} NR==2{printf "  node_max=%s\n", $0}'
} >>"$LOG"
systemctl restart inventory-site.service

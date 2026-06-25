#!/usr/bin/env bash
# Asia-Power — scheduled inventory-site backup
# Full: server.js, public/ (excluding venvs), data/, uploads/, lib/, nginx config.
# Light (--data-only): data/, uploads/, lib/, server.js only — for pre-deploy (fast).
set -euo pipefail

SITE="/root/.openclaw/workspace/inventory-site"
BACKUP_DIR="${SITE}/backups/scheduled"
NGINX_SITE="/etc/nginx/sites-available/asia-power.com"
STAMP="$(date +%Y%m%d-%H%M%S)"
MODE="${1:-full}"
KEEP=5
TMPDIR="$(mktemp -d)"
ALERT_SCRIPT="${SITE}/scripts/telegram-backup-alert.js"

if [[ "${MODE}" == "--data-only" || "${MODE}" == "data-only" ]]; then
  ARCHIVE_NAME="asia-power-data-${STAMP}.tar.gz"
else
  ARCHIVE_NAME="asia-power-backup-${STAMP}.tar.gz"
fi
ARCHIVE_PATH="${BACKUP_DIR}/${ARCHIVE_NAME}"

cleanup() {
  rm -rf "${TMPDIR}"
}

on_error() {
  if [[ -x "${ALERT_SCRIPT}" || -f "${ALERT_SCRIPT}" ]]; then
    /usr/bin/node "${ALERT_SCRIPT}" "Scheduled backup failed: ${ARCHIVE_NAME:-unknown archive}" || true
  fi
  exit 1
}

trap cleanup EXIT
trap on_error ERR

log() {
  printf '[%s] %s\n' "$(date -Iseconds)" "$*"
}

mkdir -p "${BACKUP_DIR}" "${TMPDIR}/backup-root"

copy_if_exists() {
  local src="$1"
  local dest="$2"
  if [[ -e "${src}" ]]; then
    cp -a "${src}" "${dest}"
  else
    log "WARN: missing ${src} (skipped)"
  fi
}

log "Starting ${MODE} backup -> ${ARCHIVE_NAME}"

copy_if_exists "${SITE}/server.js" "${TMPDIR}/backup-root/server.js"
copy_if_exists "${SITE}/data" "${TMPDIR}/backup-root/data"
copy_if_exists "${SITE}/uploads" "${TMPDIR}/backup-root/uploads"
copy_if_exists "${SITE}/lib" "${TMPDIR}/backup-root/lib"

if [[ "${MODE}" == "--data-only" || "${MODE}" == "data-only" ]]; then
  MANIFEST_MODE="data-only (pre-deploy)"
else
  MANIFEST_MODE="full scheduled"
  copy_if_exists "${SITE}/public" "${TMPDIR}/backup-root/public"
  copy_if_exists "${NGINX_SITE}" "${TMPDIR}/backup-root/nginx-asia-power.com"
  # Drop dev artifacts that should never live under public/
  rm -rf "${TMPDIR}/backup-root/public/.venv"* \
    "${TMPDIR}/backup-root/public/gfpgan" \
    "${TMPDIR}/backup-root/public/.git" 2>/dev/null || true
fi

cat > "${TMPDIR}/backup-root/BACKUP-MANIFEST.txt" <<EOF
Asia-Power inventory-site backup
Mode: ${MANIFEST_MODE}
Created: $(date -Iseconds)
Host: $(hostname)
Archive: ${ARCHIVE_NAME}
Site root: ${SITE}
EOF

tar -C "${TMPDIR}/backup-root" -czf "${ARCHIVE_PATH}" .

log "Created ${ARCHIVE_PATH} ($(du -h "${ARCHIVE_PATH}" | awk '{print $1}'))"

if [[ "${MODE}" == "--data-only" || "${MODE}" == "data-only" ]]; then
  mapfile -t OLD_BACKUPS < <(ls -1t "${BACKUP_DIR}"/asia-power-data-*.tar.gz 2>/dev/null || true)
  DATA_KEEP=20
  if ((${#OLD_BACKUPS[@]} > DATA_KEEP)); then
    for old in "${OLD_BACKUPS[@]:DATA_KEEP}"; do
      log "Removing old data backup ${old}"
      rm -f "${old}"
    done
  fi
else
  mapfile -t OLD_BACKUPS < <(ls -1t "${BACKUP_DIR}"/asia-power-backup-*.tar.gz 2>/dev/null || true)
  if ((${#OLD_BACKUPS[@]} > KEEP)); then
    for old in "${OLD_BACKUPS[@]:KEEP}"; do
      log "Removing old backup ${old}"
      rm -f "${old}"
    done
  fi
  log "Retention: keeping newest ${KEEP} full backups"
fi

log "Done"

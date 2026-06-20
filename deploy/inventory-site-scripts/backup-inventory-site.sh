#!/usr/bin/env bash
# Asia-Power — scheduled inventory-site backup
# Backs up server.js, public/, data/, uploads/, lib/, and nginx site config.
set -euo pipefail

SITE="/root/.openclaw/workspace/inventory-site"
BACKUP_DIR="${SITE}/backups/scheduled"
NGINX_SITE="/etc/nginx/sites-available/asia-power.com"
STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE_NAME="asia-power-backup-${STAMP}.tar.gz"
ARCHIVE_PATH="${BACKUP_DIR}/${ARCHIVE_NAME}"
KEEP=14
TMPDIR="$(mktemp -d)"
ALERT_SCRIPT="${SITE}/scripts/telegram-backup-alert.js"

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

log "Starting backup -> ${ARCHIVE_NAME}"

copy_if_exists "${SITE}/server.js" "${TMPDIR}/backup-root/server.js"
copy_if_exists "${SITE}/public" "${TMPDIR}/backup-root/public"
copy_if_exists "${SITE}/data" "${TMPDIR}/backup-root/data"
copy_if_exists "${SITE}/uploads" "${TMPDIR}/backup-root/uploads"
copy_if_exists "${SITE}/lib" "${TMPDIR}/backup-root/lib"
copy_if_exists "${NGINX_SITE}" "${TMPDIR}/backup-root/nginx-asia-power.com"

cat > "${TMPDIR}/backup-root/BACKUP-MANIFEST.txt" <<EOF
Asia-Power inventory-site backup
Created: $(date -Iseconds)
Host: $(hostname)
Archive: ${ARCHIVE_NAME}
Site root: ${SITE}
Contents:
  - server.js
  - public/
  - data/
  - uploads/
  - lib/
  - nginx-asia-power.com
EOF

tar -C "${TMPDIR}/backup-root" -czf "${ARCHIVE_PATH}" .

log "Created ${ARCHIVE_PATH} ($(du -h "${ARCHIVE_PATH}" | awk '{print $1}'))"

mapfile -t OLD_BACKUPS < <(ls -1t "${BACKUP_DIR}"/asia-power-backup-*.tar.gz 2>/dev/null || true)
if ((${#OLD_BACKUPS[@]} > KEEP)); then
  for old in "${OLD_BACKUPS[@]:KEEP}"; do
    log "Removing old backup ${old}"
    rm -f "${old}"
  done
fi

log "Retention: keeping newest ${KEEP} scheduled backups"
log "Done"

#!/usr/bin/env bash
# AsiaPower — pull production analytics, filter internal QA IPs, emit markdown + CSV.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE="${ANALYTICS_REMOTE:-root@159.65.86.24}"
REMOTE_DATA="/root/.openclaw/workspace/inventory-site/data"
OUT_DIR="${ROOT}/reports"
DATE_TAG="$(date -u +%F)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$OUT_DIR"

echo "[analytics-weekly] fetching site-analytics-daily.json …"
scp -q "${REMOTE}:${REMOTE_DATA}/site-analytics-daily.json" "${TMP}/site-analytics-daily.json"
scp -q "${REMOTE}:${REMOTE_DATA}/site-search-trends.json" "${TMP}/site-search-trends.json" 2>/dev/null || echo '{"queries":{}}' > "${TMP}/site-search-trends.json"

PYTHON="${ROOT}/.venv/bin/python3"
if [[ ! -x "$PYTHON" ]]; then PYTHON="${ROOT}/.venv-qxb/bin/python3"; fi
if [[ ! -x "$PYTHON" ]]; then PYTHON="python3"; fi

"$PYTHON" "${ROOT}/scripts/analytics-weekly-report.py" \
  --daily "${TMP}/site-analytics-daily.json" \
  --search "${TMP}/site-search-trends.json" \
  --out-dir "${OUT_DIR}" \
  --date-tag "${DATE_TAG}"

echo "[analytics-weekly] done → ${OUT_DIR}/asia-power-traffic-report-${DATE_TAG}.md"

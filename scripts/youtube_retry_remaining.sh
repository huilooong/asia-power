#!/usr/bin/env bash
# Retry remaining inventory YouTube uploads until success or max attempts.
# Safe to re-run; skips already-uploaded stockIds.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LOG="$ROOT/work/youtube-inventory-migrate/retry.log"
PY="${ROOT}/.venv/bin/python3"
MAX_ATTEMPTS="${YOUTUBE_RETRY_MAX:-12}"
SLEEP_SEC="${YOUTUBE_RETRY_SLEEP_SEC:-7200}" # 2h
PENDING=(HC250067 HC250063 HC250036)

mkdir -p "$(dirname "$LOG")"
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] retry watcher start max=$MAX_ATTEMPTS sleep=${SLEEP_SEC}s" | tee -a "$LOG"

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] attempt $attempt/$MAX_ATTEMPTS" | tee -a "$LOG"
  set +e
  out="$("$PY" scripts/youtube_inventory_upload.py --upload-all 2>&1)"
  code=$?
  set -e
  echo "$out" | tee -a "$LOG"
  remaining=0
  for sid in "${PENDING[@]}"; do
    if ! echo "$out" | grep -q "skip $sid" && ! "$PY" - <<PY
import json
from pathlib import Path
r=json.loads(Path("work/youtube-inventory-migrate/upload-results.json").read_text())
ok=any(x.get("stockId")=="$sid" and x.get("youtubeId") for x in r)
raise SystemExit(0 if ok else 1)
PY
    then
      remaining=$((remaining + 1))
    fi
  done
  # Count remaining via results file
  remaining="$("$PY" - <<'PY'
import json
from pathlib import Path
need={"HC250067","HC250063","HC250036"}
r=json.loads(Path("work/youtube-inventory-migrate/upload-results.json").read_text())
done={x["stockId"] for x in r if x.get("youtubeId")}
print(len(need - done))
PY
)"
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] remaining=$remaining exit=$code" | tee -a "$LOG"
  if [[ "$remaining" -eq 0 ]]; then
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ALL DONE — patch production JSON next" | tee -a "$LOG"
    # Try patch production half-cut if path exists locally; else remind
    if [[ -f "$ROOT/data/half-cut-approved.json" ]]; then
      "$PY" scripts/youtube_inventory_upload.py --patch-json "$ROOT/data/half-cut-approved.json" | tee -a "$LOG" || true
    fi
    exit 0
  fi
  if [[ "$attempt" -ge "$MAX_ATTEMPTS" ]]; then
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] giving up after $MAX_ATTEMPTS attempts" | tee -a "$LOG"
    exit 1
  fi
  sleep "$SLEEP_SEC"
done

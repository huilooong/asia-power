#!/usr/bin/env bash
# Syntax-check admin JS and guard against known regressions (e.g. deleted renderLeadCard).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0

echo "[check-admin-js] node --check on js/admin-*.js"
for f in "$ROOT"/js/admin-*.js; do
  if ! node --check "$f"; then
    echo "[check-admin-js] FAIL: $f"
    fail=1
  fi
done

echo "[check-admin-js] structure guard on js/admin-leads.js"
if ! grep -q 'function buildSummaryText' "$ROOT/js/admin-leads.js"; then
  echo "[check-admin-js] FAIL: missing function buildSummaryText"
  fail=1
fi
if ! grep -q 'function renderLeadCard' "$ROOT/js/admin-leads.js"; then
  echo "[check-admin-js] FAIL: missing function renderLeadCard (breaks Lead Inbox page)"
  fail=1
fi

echo "[check-admin-js] inline <script> blocks in admin/*.html"
while IFS= read -r html; do
  inline="$(awk '/<script[^>]*>/,/<\/script>/' "$html" | grep -v 'src=' || true)"
  if [ -n "$inline" ]; then
    tmp="$(mktemp "${TMPDIR:-/tmp}/admin-inline-src.XXXXXX.js")"
    awk '
      /<script[^>]*>/ && !/src=/ { capture=1; buf="" }
      capture { buf = buf $0 "\n" }
      /<\/script>/ && capture {
        gsub(/<script[^>]*>/, "", buf)
        gsub(/<\/script>/, "", buf)
        print buf
        capture=0
      }
    ' "$html" > "$tmp"
    if [ -s "$tmp" ]; then
      wrapped="$(mktemp "${TMPDIR:-/tmp}/admin-inline.XXXXXX.js")"
      printf '(function(){\n%s\n})();\n' "$(cat "$tmp")" > "$wrapped"
      if ! node --check "$wrapped" 2>/dev/null; then
        echo "[check-admin-js] FAIL: inline script in $html"
        fail=1
      fi
      rm -f "$wrapped"
    fi
    rm -f "$tmp"
  fi
done < <(find "$ROOT/admin" -name '*.html' -print)

if [ "$fail" -ne 0 ]; then
  echo "[check-admin-js] FAILED"
  exit 1
fi

echo "[check-admin-js] all checks passed"

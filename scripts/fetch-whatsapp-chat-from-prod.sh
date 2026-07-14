#!/usr/bin/env bash
# 从生产服务器只读拉取指定 WhatsApp 号码的聊天记录（CEO 本机执行，需 SSH 密钥）
# 用法:
#   bash scripts/fetch-whatsapp-chat-from-prod.sh "+243 999 955 067"
#   bash scripts/fetch-whatsapp-chat-from-prod.sh 243999955067

set -euo pipefail

PHONE_RAW="${1:-}"
if [[ -z "$PHONE_RAW" ]]; then
  echo "用法: bash scripts/fetch-whatsapp-chat-from-prod.sh \"+243 999 955 067\""
  exit 1
fi

HOST="${PRODUCTION_SSH:-root@159.65.86.24}"
AP_ROOT="/root/.openclaw/workspace/AsiaPower"
INV_ROOT="/root/.openclaw/workspace/inventory-site"
DIGITS="$(echo "$PHONE_RAW" | tr -cd '0-9')"
TAIL9="${DIGITS: -9}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="${OUT_DIR:-./runtime/whatsapp-chat-fetch-$STAMP}"
mkdir -p "$OUT_DIR"

echo "=============================================="
echo "AsiaPower — 生产 WhatsApp 聊天记录拉取（只读）"
echo "号码: $PHONE_RAW  (digits=$DIGITS)"
echo "服务器: $HOST"
echo "输出目录: $OUT_DIR"
echo "=============================================="

REMOTE_SCRIPT="$(cat <<'EOS'
set -euo pipefail
DIGITS="$1"
TAIL9="$2"
AP_ROOT="/root/.openclaw/workspace/AsiaPower"
INV_ROOT="/root/.openclaw/workspace/inventory-site"

search_dirs() {
  for d in \
    "$AP_ROOT/memory/sales_intelligence/conversations" \
    "$AP_ROOT/memory/customer_gateway/live_inbox" \
    "$AP_ROOT/memory/customer_gateway/whatsapp_parsed" \
    "$AP_ROOT/memory/customer_gateway/whatsapp_raw" \
    "$AP_ROOT/memory/customer_gateway/inbound_messages" \
    "$AP_ROOT/memory/customer_gateway/customer_profiles" \
    "$AP_ROOT/memory/conversations/normalized" \
    "$AP_ROOT/memory/conversations/raw" \
    "$AP_ROOT/memory/customer_gateway" \
    "$AP_ROOT/reports" \
    "$INV_ROOT/data"
  do
    [[ -d "$d" ]] && echo "$d"
  done
}

echo "== 1) 服务器上搜索含该号码的文件 =="
FOUND=0
while IFS= read -r dir; do
  while IFS= read -r f; do
    echo "$f"
    FOUND=$((FOUND + 1))
  done < <(grep -rilE "${DIGITS}|${TAIL9}" "$dir" 2>/dev/null || true)
done < <(search_dirs)

if [[ "$FOUND" -eq 0 ]]; then
  echo "(未在常见目录找到匹配文件)"
fi

echo ""
echo "== 2) contact-leads.json 里是否有该号码 =="
if [[ -f "$INV_ROOT/data/contact-leads.json" ]]; then
  python3 - "$DIGITS" "$TAIL9" <<'PY'
import json, sys
from pathlib import Path
digits, tail9 = sys.argv[1], sys.argv[2]
path = Path("/root/.openclaw/workspace/inventory-site/data/contact-leads.json")
raw = json.loads(path.read_text(encoding="utf-8"))
leads = raw if isinstance(raw, list) else raw.get("leads") or []
hits = []
for lead in leads:
    blob = json.dumps(lead, ensure_ascii=False)
    if digits in blob.replace(" ", "").replace("+", "") or tail9 in blob.replace(" ", ""):
        hits.append(lead)
print(f"匹配 leads: {len(hits)}")
for item in hits[:20]:
    print(json.dumps(item, ensure_ascii=False, indent=2))
PY
else
  echo "(无 contact-leads.json)"
fi

echo ""
echo "== 3) sales_intelligence 会话 JSON（按号码过滤） =="
CONV_DIR="$AP_ROOT/memory/sales_intelligence/conversations"
if [[ -d "$CONV_DIR" ]]; then
  python3 - "$DIGITS" "$TAIL9" "$CONV_DIR" <<'PY'
import json, sys
from pathlib import Path
digits, tail9, conv_dir = sys.argv[1], sys.argv[2], Path(sys.argv[3])
hits = []
for path in sorted(conv_dir.glob("*.json")):
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        continue
    compact = text.replace(" ", "").replace("+", "")
    if digits not in compact and tail9 not in compact:
        continue
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        continue
    contact = data.get("contact") or data.get("contact_name") or path.stem
    msgs = data.get("messages") or []
    hits.append((path, contact, len(msgs), data))

print(f"匹配会话文件: {len(hits)}")
for path, contact, count, data in hits:
    print(f"\n--- FILE: {path} | contact={contact} | messages={count} ---")
    for m in (data.get("messages") or [])[-40:]:
        ts = m.get("timestamp") or m.get("sync_time") or ""
        sender = m.get("sender") or m.get("direction") or "?"
        text = (m.get("text") or m.get("message") or "").strip()
        if text:
            print(f"[{ts}] {sender}: {text}")
PY
else
  echo "(无 conversations 目录)"
fi

echo ""
echo "== 4) live_inbox 最近消息（按号码过滤） =="
INBOX="$AP_ROOT/memory/customer_gateway/live_inbox"
if [[ -d "$INBOX" ]]; then
  python3 - "$DIGITS" "$TAIL9" "$INBOX" <<'PY'
import json, sys
from pathlib import Path
digits, tail9, inbox = sys.argv[1], sys.argv[2], Path(sys.argv[3])
files = sorted(inbox.rglob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
hits = []
for path in files:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        continue
    blob = json.dumps(data, ensure_ascii=False).replace(" ", "").replace("+", "")
    if digits in blob or tail9 in blob:
        hits.append((path, data))
print(f"匹配 inbox 文件: {len(hits)}")
for path, data in hits[:30]:
    contact = data.get("contact_name") or data.get("chat_id") or path.name
    body = (data.get("message") or data.get("text") or "").strip()
    ts = data.get("sync_time") or data.get("timestamp") or ""
    print(f"\n[{ts}] {contact}")
    print(body)
PY
else
  echo "(无 live_inbox 目录)"
fi
EOS
)"

ssh -o ConnectTimeout=15 "$HOST" "bash -s" "$DIGITS" "$TAIL9" <<< "$REMOTE_SCRIPT" | tee "$OUT_DIR/report.txt"

echo ""
echo "== 5) 尝试把匹配到的 JSON 文件拉回本机 =="
PULL_LIST="$(ssh -o ConnectTimeout=15 "$HOST" "bash -s" "$DIGITS" "$TAIL9" <<'EOS'
set -euo pipefail
DIGITS="$1"
TAIL9="$2"
AP_ROOT="/root/.openclaw/workspace/AsiaPower"
for d in \
  "$AP_ROOT/memory/sales_intelligence/conversations" \
  "$AP_ROOT/memory/customer_gateway/live_inbox" \
  "$AP_ROOT/memory/customer_gateway/whatsapp_parsed" \
  "$AP_ROOT/memory/customer_gateway/inbound_messages"
do
  [[ -d "$d" ]] || continue
  grep -rilE "${DIGITS}|${TAIL9}" "$d" 2>/dev/null || true
done
EOS
)" || true

if [[ -n "${PULL_LIST// }" ]]; then
  while IFS= read -r remote; do
    [[ -z "$remote" ]] && continue
    base="$(basename "$remote")"
    scp -o ConnectTimeout=15 "$HOST:$remote" "$OUT_DIR/$base" 2>/dev/null && echo "已下载: $base" || echo "下载失败: $remote"
  done <<< "$PULL_LIST"
else
  echo "(无可下载的 JSON 文件)"
fi

echo ""
echo "完成。请把以下内容发回 Cloud Agent 分析："
echo "  1) $OUT_DIR/report.txt"
echo "  2) 或直接把终端输出复制粘贴"
echo ""
echo "下一步（可选，在本机 Cursor Agent 里继续）："
echo "  python3 -c \"print(open('$OUT_DIR/report.txt', encoding='utf-8').read())\""

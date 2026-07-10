#!/bin/bash
# overnight-batch2.sh — 夜间自动运行，不依赖 AI 会话
# 1. 跑 APBD leadfinder 发现 Kenya/UAE/Tanzania 新线索
# 2. 生成第二批 WhatsApp 发送脚本
# 3. 记录日志

LOG=/Users/longhui/Desktop/AsiaPower/docs/agent-reports/overnight-batch2.log
cd /Users/longhui/Desktop/AsiaPower

echo "[$(date)] === overnight-batch2 started ===" >> "$LOG"

# Step 1: 发现新线索
echo "[$(date)] Running APBD leadfinder batch2..." >> "$LOG"
python3 -c "
import sys, asyncio, json
from pathlib import Path
sys.path.insert(0, '/Users/longhui/Desktop/AsiaPower')
from agents.apbd.lead_finder import run_lead_finder

async def main():
    result = await run_lead_finder()
    out = Path('runtime/apbd/batch2-leads.json')
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=2, default=str))
    print(f'Found {len(result) if isinstance(result, list) else \"?\"} leads')

asyncio.run(main())
" >> "$LOG" 2>&1

echo "[$(date)] Leadfinder done" >> "$LOG"

# Step 2: 把新线索发给自己 Telegram 通知
curl -s -X POST "https://api.telegram.org/bot\${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=8918522756" \
  -d "text=✅ 夜间任务完成：APBD batch2 线索发现完成，结果在 runtime/apbd/batch2-leads.json" \
  >> "$LOG" 2>&1

echo "[$(date)] === overnight-batch2 done ===" >> "$LOG"

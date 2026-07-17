/**
 * systemd ExecStopPost for apsales-whatsapp-bridge.service.
 * Logs crash context + Telegram-notifies on real failures (not clean stop/deploy).
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

const LOG = "/root/.openclaw/state/apsales-whatsapp-bridge-crashes.jsonl";
const TELEGRAM_TOKEN_PATH =
  process.env.TELEGRAM_BOT_TOKEN_FILE || "/root/.openclaw/credentials/telegram-bot-token";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "8918522756";

const result = process.env.SERVICE_RESULT || "unknown";
const exitCode = process.env.EXIT_CODE || "";
const exitStatus = process.env.EXIT_STATUS || "";

// SERVICE_RESULT=success means a clean stop (manual systemctl restart / deploy) — not a crash.
if (result === "success") process.exit(0);

let context = "";
try {
  context = execSync(
    "journalctl -u apsales-whatsapp-bridge.service -n 100 --no-pager -o cat",
    { encoding: "utf8", maxBuffer: 1024 * 1024 },
  );
} catch (err) {
  context = `journalctl read failed: ${err instanceof Error ? err.message : String(err)}`;
}

const lines = context.split("\n");
const errorIdx = [];
lines.forEach((l, i) => {
  if (/^Error(?:\s|\[)/.test(l) || /^node:internal/.test(l) || /^\s+at .*\(node:/.test(l)) {
    errorIdx.push(i);
  }
});
const stackStart = errorIdx.length ? Math.min(...errorIdx.slice(-15)) : -1;
const stack = stackStart >= 0 ? lines.slice(stackStart, stackStart + 15).join("\n") : null;

let lastAppLog = null;
for (let i = lines.length - 1; i >= 0; i--) {
  const l = lines[i].trim();
  if (l.startsWith("{") && (l.includes('"error"') || l.includes('"message"'))) {
    try {
      lastAppLog = JSON.parse(l);
      break;
    } catch {
      // keep scanning
    }
  }
}

const record = {
  ts: new Date().toISOString(),
  service_result: result,
  exit_code: exitCode,
  exit_status: exitStatus,
  last_app_log: lastAppLog,
  node_stack: stack,
};

try {
  fs.mkdirSync("/root/.openclaw/state", { recursive: true });
  fs.appendFileSync(LOG, `${JSON.stringify(record)}\n`);
} catch {
  // best-effort
}

const summary = lastAppLog?.message || lastAppLog?.error || result;
const text = [
  "🔴 apsales-whatsapp-bridge 进程异常退出，systemd 将按 on-failure 自动拉起",
  `SERVICE_RESULT=${result} EXIT_CODE=${exitCode} EXIT_STATUS=${exitStatus}`,
  `last: ${String(summary).slice(0, 300)}`,
  "说明：若是 WhatsApp 登出(401)，bridge 会 clean exit 且本通知通常不会走这条路径；",
  "登出要人工扫码，会话冲突(440)是另一条独立通知。",
].join("\n");

try {
  const token = fs.readFileSync(TELEGRAM_TOKEN_PATH, "utf8").trim();
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    console.error("telegram notify failed", res.status, await res.text());
  }
} catch (err) {
  console.error("telegram notify error", err instanceof Error ? err.message : String(err));
}

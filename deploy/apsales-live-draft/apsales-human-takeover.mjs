import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Register the exact outgoing id BEFORE the transport can emit its fromMe echo.
export function trackedTransport(sock, { beforeSend, noteBotMessage }) {
  return new Proxy(sock, {
    get(target, key) {
      if (key !== "sendMessage") return Reflect.get(target, key);
      return (jid, content, options = {}) => {
        const messageId = options.messageId || `3EB0${crypto.randomBytes(9).toString("hex").toUpperCase()}`;
        beforeSend?.(jid);
        noteBotMessage?.(messageId);
        return target.sendMessage(jid, content, { ...options, messageId });
      };
    },
  });
}

export function createHumanTakeover({ workspace, pause, isInternal = () => false, now = Date.now }) {
  const file = path.join(workspace, "memory/customer_gateway/ai_bot_message_ids.json");
  let botIds = new Set();
  let enabledAtMs = now();
  try {
    const stored = JSON.parse(fs.readFileSync(file, "utf8"));
    botIds = new Set(stored.ids);
    enabledAtMs = stored.enabledAtMs;
    if (!Number.isFinite(enabledAtMs) || !Array.isArray(stored.ids)) throw Error("invalid_bot_tracking_state");
  }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const save = () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify({ enabledAtMs, ids: [...botIds] }), { mode: 0o600 });
    fs.renameSync(temp, file);
  };
  save();
  const failures = new Map();
  return {
    failures,
    noteBotMessage(messageId) {
      botIds.add(messageId);
      save();
    },
    observe(message) {
      const customer = message.fromPhoneE164;
      if (!message.fromMe || !/^\+[1-9][0-9]{7,14}$/.test(customer || "") || isInternal(customer)) return false;
      if (!["text", "media", "location"].includes(message.kind)) return false;
      if (!message.sentAtMs || message.sentAtMs < enabledAtMs - 1000 || message.sentAtMs > now() + 60000) return false;
      if (botIds.has(message.messageId)) return false;
      try { pause(customer, message.messageId); failures.delete(customer); }
      catch {
        failures.set(customer, now());
        // Durable fail-closed marker if the Python writer is unavailable.
        const dir = path.join(workspace, "memory/customer_gateway/ai_takeover_failed");
        try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, customer), "pause persistence failed\n", { mode: 0o600 }); } catch {}
      }
      return true;
    },
  };
}

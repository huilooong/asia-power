'use strict';

/**
 * CEO Telegram → WhatsApp Cloud quote bridge (safe path).
 *
 * Hard rules:
 * - Never guess the customer from "latest chat"
 * - Plain chat text is ignored
 * - Only reply-to a bound monitor message can start a quote
 * - Outbound WhatsApp requires explicit Confirm button
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { sendText } = require('./whatsapp-cloud-send');
const {
  notifyWhatsApp,
  answerCallbackQuery,
  editMessageText,
  whatsappConfig,
} = require('./telegram-notify');

const BINDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PENDING_TTL_MS = 30 * 60 * 1000;
const MAX_BINDINGS = 800;
const MAX_PENDING = 200;

function env(...keys) {
  for (const key of keys) {
    const v = String(process.env[key] || '').trim();
    if (v) return v;
  }
  return '';
}

function quoteEnabled() {
  const flag = env('WHATSAPP_TELEGRAM_QUOTE', 'WHATSAPP_CLOUD_TELEGRAM_QUOTE').toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'off' || flag === 'no') return false;
  return true;
}

function maskWa(waId) {
  const digits = String(waId || '').replace(/\D/g, '');
  if (!digits) return '????';
  return digits.length > 4 ? `…${digits.slice(-4)}` : digits;
}

function clip(text, max = 120) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function storePaths(rootDir) {
  const dir = path.join(rootDir, 'data', 'whatsapp_cloud', 'telegram_quote');
  return {
    dir,
    bindings: path.join(dir, 'bindings.json'),
    pending: path.join(dir, 'pending.json'),
    audit: path.join(dir, 'audit.ndjson'),
  };
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

function appendAudit(rootDir, row) {
  try {
    const { dir, audit } = storePaths(rootDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(audit, `${JSON.stringify({ ts: new Date().toISOString(), ...row })}\n`, 'utf8');
  } catch {
    /* optional */
  }
}

function pruneBindings(map) {
  const now = Date.now();
  const entries = Object.entries(map || {}).filter(([, v]) => {
    const created = Date.parse(v.created_at || '') || 0;
    return created && now - created < BINDING_TTL_MS && v.wa_id;
  });
  entries.sort((a, b) => String(a[1].created_at).localeCompare(String(b[1].created_at)));
  while (entries.length > MAX_BINDINGS) entries.shift();
  return Object.fromEntries(entries);
}

function prunePending(map) {
  const now = Date.now();
  const entries = Object.entries(map || {}).filter(([, v]) => {
    const created = Date.parse(v.created_at || '') || 0;
    return created && now - created < PENDING_TTL_MS && v.wa_id && !v.consumed;
  });
  entries.sort((a, b) => String(a[1].created_at).localeCompare(String(b[1].created_at)));
  while (entries.length > MAX_PENDING) entries.shift();
  return Object.fromEntries(entries);
}

function registerBinding(rootDir, telegramMessageId, binding) {
  if (!quoteEnabled()) return { ok: false, skipped: true, reason: 'quote_off' };
  const msgId = String(telegramMessageId || '');
  const waId = String(binding?.wa_id || '').replace(/\D/g, '');
  if (!msgId || !waId) return { ok: false, reason: 'missing_ids' };

  const paths = storePaths(rootDir);
  const map = pruneBindings(readJson(paths.bindings, {}));
  map[msgId] = {
    wa_id: waId,
    profile_name: String(binding.profile_name || '').slice(0, 80),
    phone_number_id: String(binding.phone_number_id || '').trim(),
    inbound_snippet: clip(binding.inbound_snippet || '', 160),
    mode: String(binding.mode || ''),
    source: String(binding.source || 'monitor'),
    created_at: new Date().toISOString(),
  };
  writeJsonAtomic(paths.bindings, map);
  return { ok: true, message_id: msgId, wa_id: waId };
}

function getBinding(rootDir, telegramMessageId) {
  const paths = storePaths(rootDir);
  const map = pruneBindings(readJson(paths.bindings, {}));
  const hit = map[String(telegramMessageId || '')];
  if (!hit) return null;
  const created = Date.parse(hit.created_at || '') || 0;
  if (!created || Date.now() - created > BINDING_TTL_MS) return null;
  return hit;
}

/**
 * Parse CEO reply into a quote draft.
 * Accepts: 450 | $450 | 450 USD | USD 450 | EXW 450 | EXW $450 USD
 * Optional custom body after | or newline.
 */
function parseQuoteInput(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  let custom = '';
  let head = raw;
  if (raw.includes('|')) {
    const i = raw.indexOf('|');
    head = raw.slice(0, i).trim();
    custom = raw.slice(i + 1).trim();
  } else if (raw.includes('\n')) {
    const i = raw.indexOf('\n');
    head = raw.slice(0, i).trim();
    custom = raw.slice(i + 1).trim();
  }

  const lower = head.toLowerCase();
  let incoterm = '';
  for (const term of ['exw', 'fob', 'cif', 'cfr']) {
    if (lower.startsWith(`${term} `) || lower === term) {
      incoterm = term.toUpperCase();
      head = head.slice(term.length).trim();
      break;
    }
  }

  const m = head.match(
    /^(?:usd\s*)?\$?\s*([0-9]{1,7}(?:\.[0-9]{1,2})?)\s*(?:usd|\$)?$/i,
  );
  if (!m) return null;
  const amount = m[1];
  const currency = 'USD';
  const label = `${incoterm ? `${incoterm} ` : ''}${currency} ${amount}`.trim();
  const outbound = custom
    || `${label} for your inquiry. Let me know if you want to proceed.`;
  return {
    amount,
    currency,
    incoterm,
    label,
    outbound: outbound.slice(0, 3500),
    raw,
  };
}

function defaultPhoneNumberId(binding) {
  return (
    String(binding?.phone_number_id || '').trim()
    || env('WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_CLOUD_PHONE_NUMBER_ID')
  );
}

function allowedChatId() {
  return String(whatsappConfig().chatId || '').trim();
}

function isAllowedChat(chatId) {
  const allowed = allowedChatId();
  if (!allowed) return false;
  return String(chatId) === allowed;
}

function shortId() {
  return crypto.randomBytes(4).toString('hex');
}

function confirmKeyboard(id) {
  return {
    inline_keyboard: [[
      { text: '✅ 确认发送', callback_data: `wqc:${id}` },
      { text: '❌ 取消', callback_data: `wqx:${id}` },
    ]],
  };
}

async function promptConfirmSend(rootDir, {
  binding,
  replyToMessageId,
  fromUser,
  label,
  outbound,
  amount = '',
  currency = '',
  incoterm = '',
  kind = 'message',
}) {
  const id = shortId();
  const paths = storePaths(rootDir);
  const pending = prunePending(readJson(paths.pending, {}));
  pending[id] = {
    wa_id: binding.wa_id,
    profile_name: binding.profile_name || '',
    phone_number_id: defaultPhoneNumberId(binding),
    inbound_snippet: binding.inbound_snippet || '',
    amount,
    currency,
    incoterm,
    label,
    outbound,
    kind,
    created_at: new Date().toISOString(),
    created_by: String(fromUser || ''),
    reply_to_message_id: String(replyToMessageId),
  };
  writeJsonAtomic(paths.pending, pending);

  const title = kind === 'quote' ? '🧾 报价确认（尚未发给客户）' : '✉️ 发消息确认（尚未发给客户）';
  const confirmText = [
    title,
    `客户: ${maskWa(binding.wa_id)}${binding.profile_name ? ` (${binding.profile_name})` : ''}`,
    binding.inbound_snippet ? `客户原话: ${binding.inbound_snippet}` : null,
    label ? `摘要: ${label}` : null,
    '',
    '—— 将发送的 WhatsApp 原文 ——',
    outbound,
    '',
    '确认无误再点「确认发送」。点错对象请「取消」。',
  ].filter(Boolean).join('\n');

  const result = await notifyWhatsApp(confirmText, { reply_markup: confirmKeyboard(id) });
  appendAudit(rootDir, {
    event: 'confirm_prompted',
    pending_id: id,
    wa_id_mask: maskWa(binding.wa_id),
    label,
    kind,
    telegram_ok: Boolean(result?.ok),
  });
  return { handled: true, reason: 'confirm_prompted', pending_id: id };
}

async function startQuoteFromReply(rootDir, { replyToMessageId, text, chatId, fromUser }) {
  if (!quoteEnabled()) {
    return { handled: false, reason: 'quote_off' };
  }
  if (!isAllowedChat(chatId)) {
    return { handled: false, reason: 'chat_not_allowed' };
  }

  const binding = getBinding(rootDir, replyToMessageId);
  if (!binding) {
    await notifyWhatsApp(
      [
        '⚠️ 未绑定客户，已忽略（防发错）',
        '',
        '请「回复」某条 WhatsApp 盯梢消息，再写要发给客户的内容。',
        '例：回复客户原文 → 直接写英文话术，或写 450 USD',
        '空白聊天里下指令不会发送（也不会猜尾号）。',
      ].join('\n'),
    );
    appendAudit(rootDir, {
      event: 'reply_unbound',
      reply_to: String(replyToMessageId || ''),
      text: clip(text, 80),
      from: fromUser || '',
    });
    return { handled: true, reason: 'unbound' };
  }

  const raw = String(text || '').trim();
  if (!raw) {
    return { handled: false, reason: 'empty_text' };
  }

  const quote = parseQuoteInput(raw);
  if (quote) {
    return promptConfirmSend(rootDir, {
      binding,
      replyToMessageId,
      fromUser,
      label: quote.label,
      outbound: quote.outbound,
      amount: quote.amount,
      currency: quote.currency,
      incoterm: quote.incoterm || '',
      kind: 'quote',
    });
  }

  // Any other reply-to-bound text = custom WhatsApp message (CEO instruction / stock note / etc.)
  return promptConfirmSend(rootDir, {
    binding,
    replyToMessageId,
    fromUser,
    label: clip(raw, 60),
    outbound: raw.slice(0, 3500),
    kind: 'message',
  });
}

async function explainPlainChatHelp() {
  await notifyWhatsApp(
    [
      'ℹ️ 本 Bot 不会执行空白聊天里的指令（防发错人）',
      '',
      '正确做法：',
      '1. 找到该客户的 📲/🤖 盯梢消息',
      '2. 点「回复」那一条',
      '3. 写下要发给客户的原文（英文/中文都行）',
      '4. 核对确认卡里的尾号 → 点「确认发送」',
      '',
      '报价简写仍可用：450 / 450 USD / EXW 450',
    ].join('\n'),
  );
}

async function handleCallback(rootDir, callbackQuery) {
  if (!quoteEnabled()) return { handled: false, reason: 'quote_off' };

  const data = String(callbackQuery?.data || '');
  const chatId = callbackQuery?.message?.chat?.id;
  const messageId = callbackQuery?.message?.message_id;
  const callbackId = callbackQuery?.id;

  if (!isAllowedChat(chatId)) {
    if (callbackId) await answerCallbackQuery(callbackId, { text: '未授权会话', show_alert: true });
    return { handled: false, reason: 'chat_not_allowed' };
  }

  const m = data.match(/^wq([cx]):([a-f0-9]{8})$/i);
  if (!m) return { handled: false, reason: 'not_quote_callback' };

  const action = m[1].toLowerCase() === 'c' ? 'confirm' : 'cancel';
  const id = m[2].toLowerCase();
  const paths = storePaths(rootDir);
  const pendingMap = prunePending(readJson(paths.pending, {}));
  const pending = pendingMap[id];

  if (!pending || pending.consumed) {
    if (callbackId) await answerCallbackQuery(callbackId, { text: '已失效，请重新回复盯梢消息报价', show_alert: true });
    return { handled: true, reason: 'pending_missing' };
  }

  if (action === 'cancel') {
    pending.consumed = true;
    pending.consumed_at = new Date().toISOString();
    pending.consume_action = 'cancel';
    pendingMap[id] = pending;
    writeJsonAtomic(paths.pending, pendingMap);
    if (callbackId) await answerCallbackQuery(callbackId, { text: '已取消' });
    if (messageId) {
      await editMessageText(
        [
          '❌ 已取消，未发送给客户',
          `客户: ${maskWa(pending.wa_id)}${pending.profile_name ? ` (${pending.profile_name})` : ''}`,
          `金额: ${pending.label}`,
        ].join('\n'),
        { message_id: messageId, chat_id: chatId },
      );
    }
    appendAudit(rootDir, { event: 'cancelled', pending_id: id, wa_id_mask: maskWa(pending.wa_id) });
    return { handled: true, reason: 'cancelled' };
  }

  // confirm
  const phoneNumberId = defaultPhoneNumberId(pending);
  if (!phoneNumberId) {
    if (callbackId) await answerCallbackQuery(callbackId, { text: '缺少 phone_number_id', show_alert: true });
    return { handled: true, reason: 'no_phone_id' };
  }

  try {
    const sent = await sendText({
      phoneNumberId,
      to: pending.wa_id,
      text: pending.outbound,
    });
    pending.consumed = true;
    pending.consumed_at = new Date().toISOString();
    pending.consume_action = 'confirm';
    pending.wa_message_id = sent.messageId || '';
    pendingMap[id] = pending;
    writeJsonAtomic(paths.pending, pendingMap);

    if (callbackId) await answerCallbackQuery(callbackId, { text: '已发送' });
    if (messageId) {
      await editMessageText(
        [
          '✅ 已发送到 WhatsApp',
          `客户: ${maskWa(pending.wa_id)}${pending.profile_name ? ` (${pending.profile_name})` : ''}`,
          `金额: ${pending.label}`,
          sent.messageId ? `WA id: ${sent.messageId}` : null,
          '',
          '—— 已发原文 ——',
          pending.outbound,
        ].filter(Boolean).join('\n'),
        { message_id: messageId, chat_id: chatId },
      );
    }
    appendAudit(rootDir, {
      event: 'sent',
      pending_id: id,
      wa_id_mask: maskWa(pending.wa_id),
      label: pending.label,
      wa_message_id: sent.messageId || '',
    });
    return { handled: true, reason: 'sent', wa_message_id: sent.messageId || '' };
  } catch (err) {
    if (callbackId) {
      await answerCallbackQuery(callbackId, {
        text: `发送失败: ${String(err.message || err).slice(0, 80)}`,
        show_alert: true,
      });
    }
    await notifyWhatsApp(
      [
        '⚠️ WhatsApp 报价发送失败（未标记已发送）',
        `客户: ${maskWa(pending.wa_id)}`,
        `金额: ${pending.label}`,
        `原因: ${String(err && err.message ? err.message : err).slice(0, 200)}`,
      ].join('\n'),
    );
    appendAudit(rootDir, {
      event: 'send_fail',
      pending_id: id,
      wa_id_mask: maskWa(pending.wa_id),
      error: String(err && err.message ? err.message : err).slice(0, 200),
    });
    return { handled: true, reason: 'send_fail', error: String(err.message || err) };
  }
}

async function handleTelegramUpdate(rootDir, update) {
  if (!quoteEnabled()) return { handled: false, reason: 'quote_off' };

  if (update?.callback_query) {
    return handleCallback(rootDir, update.callback_query);
  }

  const message = update?.message || update?.edited_message;
  if (!message) return { handled: false, reason: 'no_message' };
  if (message.from?.is_bot) return { handled: false, reason: 'from_bot' };

  const replyTo = message.reply_to_message?.message_id;
  const text = message.text || message.caption || '';
  if (!replyTo) {
    // Safety: never guess customer from free-floating text — but explain how to use.
    if (isAllowedChat(message.chat?.id) && String(text || '').trim()) {
      await explainPlainChatHelp();
      appendAudit(rootDir, {
        event: 'plain_chat_help',
        text: clip(text, 120),
        from: message.from?.username || message.from?.first_name || '',
      });
      return { handled: true, reason: 'plain_chat_help' };
    }
    return { handled: false, reason: 'not_reply' };
  }
  if (!String(text || '').trim()) {
    return { handled: false, reason: 'empty_text' };
  }

  return startQuoteFromReply(rootDir, {
    replyToMessageId: replyTo,
    text,
    chatId: message.chat?.id,
    fromUser: message.from?.username || message.from?.first_name || '',
  });
}

function createTelegramQuoteWebhook(rootDir) {
  const secret = env('TELEGRAM_WEBHOOK_SECRET', 'WHATSAPP_TELEGRAM_WEBHOOK_SECRET');

  return async function handleTelegramQuoteWebhook(req, res, _url, json) {
    if (req.method !== 'POST') {
      return json(res, 405, { error: 'Method not allowed' });
    }
    if (secret) {
      const got = String(req.headers['x-telegram-bot-api-secret-token'] || '');
      if (got !== secret) {
        return json(res, 403, { error: 'Invalid telegram secret' });
      }
    }

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    let update;
    try {
      update = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    } catch {
      return json(res, 400, { error: 'Invalid JSON' });
    }

    try {
      const result = await handleTelegramUpdate(rootDir, update);
      return json(res, 200, { ok: true, ...result });
    } catch (err) {
      console.error('[telegram-quote]', err);
      return json(res, 200, { ok: false, error: String(err.message || err) });
    }
  };
}

module.exports = {
  quoteEnabled,
  maskWa,
  parseQuoteInput,
  registerBinding,
  getBinding,
  startQuoteFromReply,
  handleCallback,
  handleTelegramUpdate,
  createTelegramQuoteWebhook,
  storePaths,
};

'use strict';

/**
 * WhatsApp Cloud API → CEO Telegram monitor (option B, 2026-07-14)
 * - inbound: every real customer message (observe / sandbox / live / off)
 * - outbound: after auto-reply send attempt
 * Kill switch: WHATSAPP_TELEGRAM_MONITOR=off
 */

const { notifyAsync, isEnabled } = require('./telegram-notify');

function env(...keys) {
  for (const key of keys) {
    const v = String(process.env[key] || '').trim();
    if (v) return v;
  }
  return '';
}

function monitorEnabled() {
  const flag = env('WHATSAPP_TELEGRAM_MONITOR', 'WHATSAPP_CLOUD_TELEGRAM_MONITOR').toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'off' || flag === 'no') return false;
  return isEnabled();
}

function maskWa(waId) {
  const digits = String(waId || '').replace(/\D/g, '');
  if (!digits) return '????';
  return digits.length > 4 ? `…${digits.slice(-4)}` : digits;
}

function clip(text, max = 280) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function inboundBody(msg) {
  const text = clip(msg.text || msg.body || '');
  if (text) return text;
  const t = String(msg.message_type || msg.type || 'media').trim() || 'media';
  return `[${t}]`;
}

function formatInboundLines(normalizedMessages, mode) {
  const lines = [`📲 WhatsApp 客户消息 · ${mode || 'unknown'}`];
  for (const msg of (normalizedMessages || []).slice(0, 5)) {
    const name = msg.profile_name ? ` (${clip(msg.profile_name, 40)})` : '';
    lines.push(`- ${maskWa(msg.wa_id)}${name}: ${inboundBody(msg)}`);
  }
  return lines.join('\n');
}

function formatOutboundLines({
  mode,
  decision,
  waId,
  profileName,
  inboundType,
  inboundText,
  replyText,
  sent,
  riskBlocked,
}) {
  const name = profileName ? ` (${clip(profileName, 40)})` : '';
  const status = sent ? '发送成功' : '发送失败';
  const risk = riskBlocked ? ' · 风控改写' : '';
  return [
    `🤖 子敬已回复 · ${mode || 'unknown'} · ${decision || 'reply'}${risk}`,
    `客户: ${maskWa(waId)}${name}`,
    `客户说: ${inboundText ? clip(inboundText) : `[${inboundType || 'media'}]`}`,
    `回复: ${clip(replyText, 500) || '(空)'}`,
    `结果: ${status}`,
  ].join('\n');
}

function notifyInbound(normalizedMessages, mode) {
  if (!monitorEnabled() || !normalizedMessages || !normalizedMessages.length) return;
  try {
    notifyAsync(formatInboundLines(normalizedMessages, mode));
  } catch {
    /* optional */
  }
}

function notifyOutbound(payload) {
  if (!monitorEnabled()) return;
  try {
    notifyAsync(formatOutboundLines(payload || {}));
  } catch {
    /* optional */
  }
}

function notifySkip(payload) {
  if (!monitorEnabled()) return;
  const reason = String((payload && payload.reason) || 'skipped');
  // Only surface skips that mean "customer wrote but we did not reply"
  const interesting = new Set([
    'NO_ACCESS_TOKEN',
    'missing_wa_id',
    'autonomy_off',
    'observe_mode',
  ]);
  if (!interesting.has(reason) && !String(reason).startsWith('mode_')) return;
  try {
    const name = payload.profileName ? ` (${clip(payload.profileName, 40)})` : '';
    notifyAsync(
      [
        `⚠️ WhatsApp 未自动回复 · ${payload.mode || 'unknown'}`,
        `客户: ${maskWa(payload.waId)}${name}`,
        `原因: ${reason}`,
        `客户说: ${payload.inboundText ? clip(payload.inboundText) : `[${payload.inboundType || 'media'}]`}`,
      ].join('\n'),
    );
  } catch {
    /* optional */
  }
}

module.exports = {
  monitorEnabled,
  maskWa,
  clip,
  formatInboundLines,
  formatOutboundLines,
  notifyInbound,
  notifyOutbound,
  notifySkip,
};
